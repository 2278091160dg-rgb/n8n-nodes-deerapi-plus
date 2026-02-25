# Transport 层代码参考

## 1. HTTP 请求封装 (transport/request.ts)

```typescript
import {
  IExecuteFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  NodeApiError,
} from 'n8n-workflow';

interface DeerApiRequestOptions {
  method: IHttpRequestMethods;
  endpoint: string;
  body?: object;
  qs?: object;
  headers?: object;
  timeout?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1s
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// 熔断器状态
let circuitBreakerFailures = 0;
let circuitBreakerOpenUntil = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 30000; // 30s

export async function deerApiRequest(
  this: IExecuteFunctions,
  options: DeerApiRequestOptions,
): Promise<any> {
  const credentials = await this.getCredentials('deerApiApi');
  const baseUrl = (credentials.baseUrl as string) || 'https://api.deerapi.com';
  const apiKey = credentials.apiKey as string;

  // 熔断器检查
  if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    if (Date.now() < circuitBreakerOpenUntil) {
      throw new NodeApiError(this.getNode(), {
        message: 'Circuit breaker is open. Too many consecutive failures.',
        description: `Service will retry after ${Math.ceil((circuitBreakerOpenUntil - Date.now()) / 1000)}s`,
      });
    }
    // 半开状态，重置计数器
    circuitBreakerFailures = 0;
  }

  const requestOptions: IHttpRequestOptions = {
    method: options.method,
    url: `${baseUrl}${options.endpoint}`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body,
    qs: options.qs,
    timeout: options.timeout || 60000,
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await this.helpers.httpRequest(requestOptions);
      // 成功，重置熔断器
      circuitBreakerFailures = 0;
      return response;
    } catch (error: any) {
      lastError = error;
      const statusCode = error.statusCode || error.httpCode;

      // 4xx 错误（非 429）不重试
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        circuitBreakerFailures++;
        throw sanitizeError(this, error, apiKey);
      }

      // 可重试错误
      if (RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      circuitBreakerFailures++;
      if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_RESET_MS;
      }
    }
  }

  throw sanitizeError(this, lastError!, apiKey);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

## 2. 错误清洗 (transport/error.ts)

```typescript
import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';

const ERROR_MESSAGES: Record<number, string> = {
  400: 'Bad Request: Please check your input parameters',
  401: 'Unauthorized: Invalid API Key',
  403: 'Forbidden: Your API Key does not have access to this resource',
  404: 'Not Found: The requested endpoint does not exist',
  429: 'Rate Limited: Too many requests, please try again later',
  500: 'Internal Server Error: DeerAPI service error',
  502: 'Bad Gateway: DeerAPI service temporarily unavailable',
  503: 'Service Unavailable: DeerAPI is under maintenance',
};

export function sanitizeError(
  context: IExecuteFunctions,
  error: any,
  apiKey: string,
): NodeApiError {
  // 从错误消息中清除 API Key
  let message = error.message || 'Unknown error';
  let description = error.description || '';

  if (apiKey) {
    const masked = apiKey.substring(0, 4) + '****';
    message = message.replace(new RegExp(escapeRegex(apiKey), 'g'), masked);
    description = description.replace(new RegExp(escapeRegex(apiKey), 'g'), masked);
  }

  const statusCode = error.statusCode || error.httpCode || 0;
  const friendlyMessage = ERROR_MESSAGES[statusCode] || message;

  return new NodeApiError(context.getNode(), {
    message: friendlyMessage,
    description,
    httpCode: String(statusCode),
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

## 3. 响应解析 (transport/response.ts)

```typescript
import { IExecuteFunctions, IBinaryData } from 'n8n-workflow';

export interface DeerApiResponse {
  success: boolean;
  data?: any;
  error?: { code: string; message: string };
  taskId?: string;
}

export async function parseResponse(
  context: IExecuteFunctions,
  response: any,
  itemIndex: number,
): Promise<any> {
  // 如果返回的是图片 URL，下载并转为 Binary Data
  if (response.data?.image_url) {
    const imageData = await context.helpers.httpRequest({
      method: 'GET',
      url: response.data.image_url,
      encoding: 'arraybuffer',
    });

    const binary: IBinaryData = await context.helpers.prepareBinaryData(
      Buffer.from(imageData),
      'output.png',
      'image/png',
    );

    return {
      json: response.data,
      binary: { data: binary },
    };
  }

  // 如果返回的是 base64 图片
  if (response.data?.image_base64) {
    const buffer = Buffer.from(response.data.image_base64, 'base64');
    const binary = await context.helpers.prepareBinaryData(
      buffer,
      'output.png',
      'image/png',
    );

    return {
      json: response.data,
      binary: { data: binary },
    };
  }

  // 纯 JSON 响应
  return { json: response.data || response };
}
```
