# n8n-nodes-deerapi-plus 项目交接文档

## 1. 项目概述

- 包名：`n8n-nodes-deerapi-plus`
- 版本：v0.4.0
- 用途：n8n 社区节点，封装 DeerAPI 的 AI 电商图片能力
- 语言：TypeScript (strict mode)
- 测试框架：Jest（96% 覆盖率）
- 目标安装路径：`~/.n8n/nodes/`

## 2. 四个操作

所有操作统一走 DeerAPI 的 OpenAI 兼容端点 `/v1/chat/completions`，模型 ID 决定行为。

| 操作 | Resource | Operation | 说明 |
|------|----------|-----------|------|
| 图片生成 | image | generate | 文生图，支持提示词自动增强 |
| 背景移除 | image | removeBackground | 移除/替换图片背景 |
| 提示词增强 | prompt | enhance | 电商专用提示词优化，JSON 结构化输出 |
| 虚拟试穿 | virtualTryOn | generate | AI 虚拟试穿（人像+服装合成） |

**API 端点**: 全部 `POST /v1/chat/completions`
**请求格式**: `{ model, messages: [{role, content}], max_tokens?, temperature? }`
**响应格式**: `{ choices: [{ message: { content } }] }`
**图片提取**: 从响应 content 中正则匹配图片 URL

## 3. 项目结构

```
n8n-nodes-deerapi-plus/
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── credentials/
│   └── DeerApiPlusApi.credentials.ts    # 凭证：API Key + Base URL
├── nodes/
│   └── DeerApi/
│       ├── DeerApi.node.ts              # 主节点（Router 模式）
│       ├── DeerApi.node.json            # 节点元数据
│       ├── deerapi.svg                  # 节点图标
│       └── actions/
│           ├── router.ts                # 操作路由分发
│           ├── generateImage.ts         # 图片生成
│           ├── removeBackground.ts      # 背景移除
│           ├── enhancePrompt.ts         # 提示词增强
│           └── virtualTryOn.ts          # 虚拟试穿
├── transport/
│   ├── request.ts                       # HTTP 请求（重试+熔断）
│   ├── response.ts                      # 响应解析
│   └── error.ts                         # 错误清洗（凭证脱敏）
└── tests/
    ├── unit/
    │   ├── transport/
    │   ├── credentials/
    │   └── actions/
    └── integration/
        └── router.test.ts
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
- `error.ts`: 从错误信息中移除 API Key，映射 HTTP 状态码到友好消息
- `response.ts`: 响应解析工具函数

## 7. 关键设计模式

- Router 模式：单节点 + resource/operation 分发
- continueOnFail：批处理容错，单项失败不中断
- pairedItem：数据血缘追踪
- extraBodyFields：JSON 扩展字段（黑名单过滤 model/messages/stream/tools/function_call/functions）
- __custom 逃生舱：每个模型下拉都支持自定义输入

## 8. 构建与测试

```bash
npm run build    # tsc 编译 + 复制 SVG
npm test         # Jest 单元测试
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
