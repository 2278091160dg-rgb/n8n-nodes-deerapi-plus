import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	NodeApiError,
} from 'n8n-workflow';
import { sanitizeError } from './error';

export interface DeerApiRequestOptions {
	method: IHttpRequestMethods;
	endpoint: string;
	body?: IDataObject;
	qs?: IDataObject;
	headers?: IDataObject;
	timeout?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// Circuit breaker state
let circuitBreakerFailures = 0;
let circuitBreakerOpenUntil = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 30000;

// Exported for testing
export function resetCircuitBreaker(): void {
	circuitBreakerFailures = 0;
	circuitBreakerOpenUntil = 0;
}

export function getCircuitBreakerState(): {
	failures: number;
	openUntil: number;
} {
	return { failures: circuitBreakerFailures, openUntil: circuitBreakerOpenUntil };
}

export function setCircuitBreakerState(failures: number, openUntil: number): void {
	circuitBreakerFailures = failures;
	circuitBreakerOpenUntil = openUntil;
}

export async function deerApiRequest(
	this: IExecuteFunctions,
	options: DeerApiRequestOptions,
): Promise<any> {
	const credentials = await this.getCredentials('deerApiPlusApi');
	const baseUrl = (credentials.baseUrl as string) || 'https://api.deerapi.com';
	const apiKey = credentials.apiKey as string;

	// Circuit breaker check
	if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
		if (Date.now() < circuitBreakerOpenUntil) {
			throw new NodeApiError(this.getNode(), {
				message: 'Circuit breaker is open. Too many consecutive failures.',
				description: `Service will retry after ${Math.ceil((circuitBreakerOpenUntil - Date.now()) / 1000)}s`,
			});
		}
		// Half-open: reset counter
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
			// Success: reset circuit breaker
			circuitBreakerFailures = 0;
			return response;
		} catch (error: any) {
			lastError = error;
			const statusCode = error.statusCode || error.httpCode;

			// 4xx errors (except 429) are not retryable
			if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
				circuitBreakerFailures++;
				throw sanitizeError(this, error, apiKey);
			}

			// Retryable errors
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