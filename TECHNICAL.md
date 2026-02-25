# DeerAPI Plus — 技术总结

## 1. 项目概述

**包名**: `n8n-nodes-deerapi-plus`
**版本**: v0.4.0
**定位**: n8n 社区节点，集成 DeerAPI 的 AI 电商图像能力。

核心功能（4 个 Operation）：

- **Image → Generate**: 文本生成图像，支持可选的 prompt 增强
- **Image → Remove Background**: 图像去背景，支持 URL / 二进制输入
- **Prompt → Enhance**: 电商场景 prompt 优化，输出结构化 JSON
- **Virtual Try-On → Generate**: AI 虚拟试穿，人物 + 服装图合成

跨操作通用能力：

- 自定义模型选择（预设 + Custom）
- Simplify Output 开关
- Binary 输出（下载图片为二进制）
- System Prompt Override（覆盖内置系统提示词）
- Extra Body Fields（JSON 扩展请求体）
- 统一输出信封（success / operation / model / processing_time_ms）

## 2. 架构设计

### 目录结构

```
n8n-nodes-deerapi/
├── credentials/
│   └── DeerApiPlusApi.credentials.ts   # 凭证定义（API Key + Base URL）
├── nodes/DeerApi/
│   ├── DeerApi.node.ts                 # 节点入口，注册 resource/operation/fields
│   ├── DeerApi.node.json               # n8n codex 元数据（分类、别名）
│   ├── deerapi.svg                     # 节点图标
│   └── actions/
│       ├── router.ts                   # 路由分发：resource + operation → handler
│       ├── generateImage.ts            # 生图逻辑 + 字段定义
│       ├── removeBackground.ts         # 去背景逻辑 + 字段定义
│       ├── enhancePrompt.ts            # Prompt 增强逻辑 + 字段定义
│       └── virtualTryOn.ts            # 虚拟试穿逻辑 + 字段定义
├── transport/
│   ├── request.ts                      # HTTP 请求层（重试 + 熔断器）
│   ├── error.ts                        # 错误清洗（脱敏 API Key）
│   └── response.ts                     # 响应处理工具
├── tests/
│   ├── unit/actions/                   # 4 个 action 单元测试
│   ├── unit/transport/                 # request / error / response 单元测试
│   ├── unit/credentials/               # 凭证测试
│   └── integration/                    # router 集成测试
├── package.json
├── tsconfig.json
└── jest.config.js
```

### 代码分层

```
DeerApi.node.ts (入口)
  → router.ts (路由)
    → generateImage.ts / removeBackground.ts / enhancePrompt.ts / virtualTryOn.ts (业务)
      → transport/request.ts (HTTP 请求 + 重试 + 熔断)
        → transport/error.ts (错误脱敏)
```

### 关键模块职责

| 模块 | 职责 |
|------|------|
| `DeerApi.node.ts` | 声明节点元数据（displayName、resource/operation 枚举、字段注册） |
| `router.ts` | 遍历输入 items，按 resource + operation 分发到对应 handler，支持 continueOnFail |
| `request.ts` | 统一 HTTP 请求：Bearer 认证、指数退避重试（最多 3 次）、熔断器（5 次失败后断路 30s） |
| `error.ts` | 从错误信息中清除 API Key，防止凭证泄露到日志 |
| 各 action 文件 | 定义 n8n 字段（INodeProperties[]）+ 导出执行函数 |

## 3. API 接口说明

所有操作统一调用 DeerAPI 的 `/v1/chat/completions` 端点。

### 3.1 Image → Generate (`generateImage.ts`)

**输入参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| model | options | ✅ | gemini-2.5-flash-image | 生图模型（支持 Custom） |
| prompt | string | ✅ | — | 图像描述 |
| enhancePrompt | boolean | ✅ | true | 是否先增强 prompt |
| additionalOptions.negativePrompt | string | — | — | 负面提示词 |
| additionalOptions.width | number | — | 1024 | 图像宽度 (256-2048) |
| additionalOptions.height | number | — | 1024 | 图像高度 (256-2048) |
| additionalOptions.numberOfImages | number | — | 1 | 生成数量 (1-4) |
| additionalOptions.outputType | options | — | url | url / binary |
| additionalOptions.enhancementModel | string | — | gemini-2.5-flash | 增强步骤使用的模型 |
| additionalOptions.temperature | number | — | 0.7 | 增强温度 (0-2) |
| additionalOptions.maxTokens | number | — | 2048 | 增强最大 token |
| additionalOptions.simplify | boolean | — | true | 简化输出 |
| additionalOptions.systemPromptOverride | string | — | — | 覆盖增强系统提示词 |
| additionalOptions.extraBodyFields | string(JSON) | — | — | 合并到生图请求体 |

**输出**:

```json
{
  "success": true,
  "operation": "generate",
  "model": "gemini-2.5-flash-image",
  "original_prompt": "a red dress",
  "enhanced_prompt": "...",
  "image_url": "https://...",
  "processing_time_ms": 1234,
  "raw_content": "..."          // simplify=false 时
}
```

### 3.2 Image → Remove Background (`removeBackground.ts`)

**输入参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| model | options | ✅ | gemini-2.5-flash-image | 去背景模型 |
| inputMethod | options | ✅ | url | url / binary |
| imageUrl | string | 条件 | — | inputMethod=url 时必填 |
| binaryProperty | string | 条件 | data | inputMethod=binary 时的属性名 |
| additionalOptions.outputFormat | options | — | png | png / webp |
| additionalOptions.outputType | options | — | url | url / binary |
| additionalOptions.backgroundColor | options | — | transparent | transparent / white / custom |
| additionalOptions.customBackgroundColor | string | — | #FFFFFF | 自定义背景色 |
| additionalOptions.simplify | boolean | — | true | 简化输出 |
| additionalOptions.systemPromptOverride | string | — | — | 注入系统提示词 |
| additionalOptions.extraBodyFields | string(JSON) | — | — | 合并到请求体 |

**输出**:

```json
{
  "success": true,
  "operation": "removeBackground",
  "model": "gemini-2.5-flash-image",
  "input_method": "url",
  "image_url": "https://...",
  "processing_time_ms": 890,
  "raw_content": "..."          // simplify=false 时
}
```

### 3.3 Prompt → Enhance (`enhancePrompt.ts`)

**输入参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| model | options | ✅ | gemini-2.5-flash | LLM 模型 |
| prompt | string | ✅ | — | 原始提示词 |
| category | options | ✅ | product_photo | 8 种电商场景分类 |
| additionalOptions.style | string | — | — | 目标视觉风格 |
| additionalOptions.language | options | — | en | 输出语言 (en/zh) |
| additionalOptions.temperature | number | — | 0.7 | 温度 |
| additionalOptions.maxTokens | number | — | 2048 | 最大 token |
| additionalOptions.simplify | boolean | — | true | 简化输出 |
| additionalOptions.systemPromptOverride | string | — | — | 覆盖系统提示词 |
| additionalOptions.extraBodyFields | string(JSON) | — | — | 合并到请求体 |

**输出**:

```json
{
  "success": true,
  "operation": "enhance",
  "model": "gemini-2.5-flash",
  "original_prompt": "red shoes",
  "enhanced_prompt": "Professional product photography...",
  "suggestions": ["Add rim lighting", "..."],
  "category": "product_photo",
  "processing_time_ms": 567,
  "raw_content": "..."          // simplify=false 时
}
```

### 3.4 Virtual Try-On → Generate (`virtualTryOn.ts`)

**输入参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| model | options | ✅ | gemini-2.5-flash-image | 试穿模型 |
| personImageUrl | string | ✅ | — | 人物图片 URL |
| garmentImageUrl | string | ✅ | — | 服装图片 URL |
| category | options | ✅ | upper | upper / lower / full |
| enhancePrompt | boolean | ✅ | true | 是否增强试穿指令 |
| additionalOptions.outputType | options | — | url | url / binary |
| additionalOptions.enhancementModel | string | — | gemini-2.5-flash | 增强模型 |
| additionalOptions.temperature | number | — | 0.7 | 增强温度 |
| additionalOptions.maxTokens | number | — | 2048 | 增强最大 token |
| additionalOptions.simplify | boolean | — | true | 简化输出 |
| additionalOptions.systemPromptOverride | string | — | — | 覆盖增强系统提示词 |
| additionalOptions.extraBodyFields | string(JSON) | — | — | 合并到生成请求体 |

**输出**:

```json
{
  "success": true,
  "operation": "generate",
  "model": "gemini-2.5-flash-image",
  "person_image_url": "https://...",
  "garment_image_url": "https://...",
  "category": "upper",
  "result_image_url": "https://...",
  "processing_time_ms": 2345,
  "raw_content": "..."          // simplify=false 时
}
```

## 4. N8N 集成

### package.json 的 n8n 字段

```json
{
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": ["dist/credentials/DeerApiPlusApi.credentials.js"],
    "nodes": ["dist/nodes/DeerApi/DeerApi.node.js"]
  }
}
```

- `n8nNodesApiVersion: 1` — 使用 n8n 节点 API v1
- `credentials` — 指向编译后的凭证类
- `nodes` — 指向编译后的节点类

### 凭证定义

`DeerApiPlusApi` 凭证包含两个字段：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| apiKey | string (password) | ✅ | — | DeerAPI API Key |
| baseUrl | string | — | `https://api.deerapi.com` | 自定义 API 地址 |

### 节点注册方式

- 节点类 `DeerApi` 实现 `INodeType` 接口
- `description` 声明 resource/operation 枚举和所有字段
- `execute()` 方法委托给 `router.ts`
- `usableAsTool: true` — 支持作为 AI Agent 工具调用
- codex 元数据（`DeerApi.node.json`）定义分类为 `AI > Image` 和 `Marketing & Content`

## 5. 测试覆盖

### 数据

| 指标 | 数值 |
|------|------|
| 测试总数 | 114 |
| 测试套件 | 9 |
| 语句覆盖率 | 97.77% |
| 分支覆盖率 | 91.51% |
| 函数覆盖率 | 100% |
| 行覆盖率 | 97.75% |

### 测试策略

- **Mock 方式**: 使用 `jest.mock()` 模拟 `transport/request.ts` 的 `deerApiRequest`，不发起真实 HTTP 请求
- **mockContext**: 手动构造 `IExecuteFunctions` 的 mock 对象，通过 `mockReturnValueOnce` 按顺序模拟 `getNodeParameter` 调用
- **单元测试**: 每个 action 独立测试，覆盖正常流程、边界情况（空响应、JSON 解析失败、增强失败回退）、新功能（systemPromptOverride、extraBodyFields）
- **集成测试**: `router.test.ts` 验证路由分发、多 item 处理、continueOnFail 错误处理
- **Transport 测试**: 覆盖重试逻辑、熔断器状态转换、错误脱敏

## 6. 构建与部署

### 构建命令

```bash
npm run build         # tsc 编译 + 复制 SVG 图标到 dist/
npm test              # 运行所有测试
npm run test:coverage # 运行测试 + 覆盖率报告
```

### 安装到本地 N8N

**方式一：npm link（开发环境）**

```bash
cd /Users/denggui/2026code/n8n-nodes-deerapi
npm run build
npm link
cd ~/.n8n/nodes
npm link n8n-nodes-deerapi-plus
docker restart n8n
```

**方式二：rsync 直接部署**

```bash
cd /Users/denggui/2026code/n8n-nodes-deerapi
npm run build
rsync -av --delete \
  dist/ package.json \
  ~/.n8n/nodes/node_modules/n8n-nodes-deerapi-plus/
docker restart n8n
```

**方式三：npm 安装（发布后）**

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-deerapi-plus
docker restart n8n
```

## 7. 已知限制

1. **单端点依赖**: 所有操作都通过 `/v1/chat/completions` 端点，依赖模型的多模态能力解析图片 URL
2. **图片 URL 提取**: 使用正则从响应文本中提取图片 URL，如果模型输出格式变化可能提取失败
3. **无流式输出**: 所有请求同步等待完整响应，大图生成可能耗时较长
4. **虚拟试穿仅支持 URL 输入**: 人物和服装图片必须提供 URL，不支持二进制输入
5. **extraBodyFields 静默忽略错误**: 无效 JSON 不会报错，用户可能不知道配置未生效
6. **numberOfImages 字段**: 已定义但未实际传入 API 请求体（依赖模型自身支持）
7. **熔断器为进程级全局状态**: 多个节点实例共享同一个熔断器计数器

## 8. 后续开发计划

- [ ] **i18n 国际化**: 节点 displayName、description 支持中英文切换
- [ ] **Logo 优化**: 替换当前 SVG 为正式品牌 Logo
- [ ] **npm 社区发布**: 创建 GitHub 仓库 → push → `npm publish`
- [ ] **Webhook 回调**: 支持异步生图，通过 webhook 接收结果
- [ ] **批量处理优化**: 支持单次请求生成多张图片
- [ ] **图片编辑操作**: 新增 Image → Edit（局部修改、风格迁移）
- [ ] **历史记录**: 记录生成历史，支持重新生成
- [ ] **费用追踪**: 在输出中返回 token 用量和预估费用
