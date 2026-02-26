# n8n-nodes-deerapi-plus 项目交接文档

## 1. 项目概述

- 包名：`n8n-nodes-deerapi-plus`
- 版本：v0.5.0
- 用途：n8n 社区节点，封装 DeerAPI 全能力 — AI 文字/图片/视频生成、深度推理、向量嵌入、背景移除、提示词增强、虚拟试穿
- 语言：TypeScript (strict mode)
- 测试框架：Jest（183 tests，15 test suites）
- 目标安装路径：`~/.n8n/nodes/`

## 2. 操作矩阵

| Resource | Operation | 说明 | 端点路由 |
|----------|-----------|------|----------|
| Chat | generate | 文字生成，支持 20+ 模型 | 模型决定：OpenAI `/v1/chat/completions` 或 Anthropic `/v1/messages` |
| Thinking | generate | 深度推理，支持 thinking/reasoning_content | 同 Chat，120s 超时 |
| Image | generate | 文生图，支持提示词自动增强 + 宽高比 + 分辨率 | 模型决定：`/v1/chat/completions` 或 `/v1/images/generations` (doubao) |
| Image | removeBackground | 移除/替换图片背景 | 同 Image generate |
| Prompt | enhance | 电商专用提示词优化，JSON 结构化输出 | 模型决定（同 Chat） |
| Virtual Try-On | generate | AI 虚拟试穿（人像+服装合成） | 模型决定（同 Image） |
| Embeddings | generate | 向量嵌入 | `/v1/embeddings` |
| Video | create/retrieve/download/list | 视频生成完整生命周期 | `/v1/videos/generations` |

## 3. 项目结构

```
n8n-nodes-deerapi-plus/
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── README.md
├── CHANGELOG.md
├── credentials/
│   └── DeerApiPlusApi.credentials.ts    # 凭证：API Key + Base URL
├── nodes/
│   └── DeerApi/
│       ├── DeerApi.node.ts              # 主节点（Router 模式 + loadOptions 动态模型）
│       ├── DeerApi.node.json            # 节点元数据
│       ├── deerapi.svg                  # 节点图标
│       └── actions/
│           ├── router.ts                # 操作路由分发
│           ├── chat.ts                  # 文字生成
│           ├── thinking.ts              # 深度推理
│           ├── generateImage.ts         # 图片生成
│           ├── removeBackground.ts      # 背景移除
│           ├── enhancePrompt.ts         # 提示词增强
│           ├── virtualTryOn.ts          # 虚拟试穿
│           ├── embeddings.ts            # 向量嵌入
│           └── video/                   # 视频生成
│               ├── index.ts
│               ├── create.ts
│               ├── retrieve.ts
│               ├── download.ts
│               └── list.ts
├── transport/
│   ├── request.ts                       # HTTP 请求（重试+熔断）
│   ├── response.ts                      # 响应解析（safeExtractChatContent + extractImageUrl）
│   ├── endpoint-map.ts                  # 模型→端点映射 + buildRequestForModel（OpenAI/Anthropic 格式）
│   └── error.ts                         # 错误清洗（凭证脱敏 + 友好消息映射）
├── shared/
│   └── constants.ts                     # 模型列表 + capability 类型定义
└── tests/
    ├── unit/
    │   ├── transport/                   # endpoint-map / request / response / error
    │   ├── credentials/                 # 凭证测试
    │   └── actions/                     # 每个操作的单元测试
    └── integration/
        └── router.test.ts              # 路由集成测试
```

## 4. 凭证系统

- 文件：`credentials/DeerApiPlusApi.credentials.ts`
- 类名：`DeerApiPlusApi`
- 内部名：`deerApiPlusApi`
- 显示名：`DeerAPI Plus API`
- 字段：`apiKey` (password) + `baseUrl` (默认 `https://api.deerapi.com`)

## 5. 命名规则

- 文件名：`DeerApi.node.ts` — n8n 根据文件名推断类名
- 类名：`DeerApi`（不是 `DeerApiPlus`）
- 节点内部名：`deerApiPlus`（package.json `n8n.nodes` 引用）
- 凭证内部名：`deerApiPlusApi`（节点 `credentials` 数组引用）

## 6. Transport 层

- `request.ts`: 指数退避重试（3 次，1s/2s/4s），可重试状态码 429/500/502/503/504，熔断器（5 次失败/30s 窗口）
- `endpoint-map.ts`: 模型 ID → 端点路由（正则匹配），`buildRequestForModel()` 自动处理 OpenAI vs Anthropic 请求体格式
- `error.ts`: 从错误信息中移除 API Key，映射 HTTP 状态码到友好消息
- `response.ts`: `safeExtractChatContent()` 安全提取 + `extractImageUrl()` 正则提取图片 URL

## 7. 关键设计模式

- Router 模式：单节点 + resource/operation 分发
- 动态模型加载：loadOptions 从 `/v1/models` 拉取，按 capability 过滤，本地 FALLBACK_MODELS 兜底
- 端点路由：`resolveEndpoint()` 根据模型 ID 自动选择端点和 API 格式
- Anthropic 格式适配：`buildRequestForModel()` 自动将 system message 提取到顶层
- continueOnFail：批处理容错，单项失败不中断
- pairedItem：数据血缘追踪
- extraBodyFields：JSON 扩展字段（黑名单过滤 model/messages/stream/tools/function_call/functions/tool_choice）
- __custom 逃生舱：每个模型下拉都支持自定义输入
- usableAsTool：AI Agent 兼容

## 8. 构建与测试

```bash
npm run build    # tsc 编译 + 复制 SVG
npm test         # Jest 单元测试（183 tests）
npm run lint     # ESLint 检查
npm run test:coverage  # 覆盖率报告
```

安装到本地 n8n：
```bash
npm run build
npm link
cd ~/.n8n/nodes
npm link n8n-nodes-deerapi-plus
```
