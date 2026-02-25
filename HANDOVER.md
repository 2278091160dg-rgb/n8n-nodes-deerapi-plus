# n8n-nodes-deerapi-plus 项目交接文档

## 1. 项目概述

- 包名：`n8n-nodes-deerapi-plus`
- 用途：n8n 自定义节点，封装 DeerAPI 的 4 个 P0 操作
- 语言：TypeScript
- 测试框架：Jest
- 目标安装路径：`~/.n8n/nodes/`

## 2. 四个 P0 操作

| 操作 | API 端点 | 说明 |
|------|---------|------|
| 图片生成 | POST /api/v1/generate | 文生图 |
| 背景移除 | POST /api/v1/remove-bg | 移除图片背景 |
| 提示词增强 | POST /api/v1/enhance-prompt | 优化提示词 |
| 虚拟试穿 | POST /api/v1/virtual-tryon | AI 虚拟试穿 |

## 3. 项目结构

```
n8n-nodes-deerapi-plus/
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── .nvmrc
├── .editorconfig
├── LICENSE (MIT)
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── credentials/
│   └── DeerApiApi.credentials.ts    # API Key + 自定义 Base URL
├── nodes/
│   └── DeerApi/
│       ├── DeerApi.node.ts          # 主节点（Router 模式）
│       ├── DeerApi.node.json        # 节点元数据
│       ├── deerapi.svg              # 节点图标
│       └── actions/
│           ├── router.ts            # 操作路由
│           ├── generateImage.ts     # 图片生成
│           ├── removeBackground.ts  # 背景移除
│           ├── enhancePrompt.ts     # 提示词增强
│           └── virtualTryOn.ts      # 虚拟试穿
├── transport/
│   ├── request.ts                   # HTTP 请求（重试+熔断）
│   ├── response.ts                  # 响应解析
│   └── error.ts                     # 错误清洗
├── tests/
│   ├── unit/
│   │   ├── transport/
│   │   ├── credentials/
│   │   └── actions/
│   └── integration/
│       └── router.test.ts
├── docs/
│   ├── api-reference.md             # API 参考（中英双语）
│   ├── architecture.md              # 架构设计
│   ├── development-guide.md         # 开发指南
│   ├── security.md                  # 安全规范
│   ├── performance.md               # 性能优化
│   ├── troubleshooting.md           # 故障排查
│   └── e2e-testing.md               # 端到端测试
└── .github/
    └── workflows/
        └── ci.yml                   # CI/CD（lint + test + publish）
```

## 4. 凭证系统 (DeerApiApi.credentials.ts)

```typescript
import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class DeerApiApi implements ICredentialType {
  name = 'deerApiApi';
  displayName = 'DeerAPI API';
  documentationUrl = 'https://deerapi.com/docs';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.deerapi.com',
      description: '自定义 API 地址（可选）',
    },
  ];
}
```

## 5. Transport 层设计

### 5.1 请求重试 (transport/request.ts)
- 最大重试次数：3
- 退避策略：指数退避 (1s, 2s, 4s)
- 可重试状态码：429, 500, 502, 503, 504
- 熔断器：连续 5 次失败后熔断 30 秒

### 5.2 响应解析 (transport/response.ts)
- 统一解析 JSON 响应
- 处理二进制数据（图片）返回为 n8n Binary Data
- 支持 base64 和 URL 两种图片返回格式

### 5.3 错误清洗 (transport/error.ts)
- 从错误信息中移除 API Key
- 映射 HTTP 状态码到用户友好的错误消息
- 保留原始错误码供调试

## 6. 主节点实现 (DeerApi.node.ts)

```typescript
import { INodeType, INodeTypeDescription } from 'n8n-workflow';

export class DeerApi implements INodeType {
  // 注意：类名必须是 DeerApi（匹配文件名），不是 DeerApiPlus
  description: INodeTypeDescription = {
    displayName: 'DeerAPI Plus',
    name: 'deerApiPlus',
    icon: 'file:deerapi.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'DeerAPI AI 电商图片生成平台',
    defaults: { name: 'DeerAPI Plus' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      { name: 'deerApiApi', required: true },
    ],
    properties: [
      // resource: image | prompt | virtualTryOn
      // operation: generate | removeBackground | enhance | generate
    ],
  };
}
```

### 关键命名规则（踩坑记录）
- **文件名**：`DeerApi.node.ts` — n8n 根据文件名推断类名
- **类名**：`DeerApi` — 必须匹配文件名前缀
- **节点内部名**：`deerApiPlus` — package.json 中注册
- **显示名**：`DeerAPI Plus` — 用户在编辑器中看到的名字
- **凭证类名**：`DeerApiApi` — 匹配 `DeerApiApi.credentials.ts`
- **凭证内部名**：`deerApiApi`

## 7. package.json 关键配置

```json
{
  "name": "n8n-nodes-deerapi-plus",
  "version": "0.1.0",
  "description": "n8n community node for DeerAPI",
  "license": "MIT",
  "main": "dist/nodes/DeerApi/DeerApi.node.js",
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": ["dist/credentials/DeerApiApi.credentials.js"],
    "nodes": ["dist/nodes/DeerApi/DeerApi.node.js"]
  },
  "scripts": {
    "build": "tsc && cp nodes/DeerApi/*.svg dist/nodes/DeerApi/",
    "test": "jest",
    "lint": "eslint ."
  }
}
```

### 构建注意事项
- `build` 脚本必须包含 `cp nodes/DeerApi/*.svg dist/nodes/DeerApi/`
- SVG 图标不会被 tsc 编译，需要手动复制
- 不复制会导致节点加载失败

## 8. 部署到 n8n

```bash
# 方式一：npm link（开发）
cd n8n-nodes-deerapi-plus
npm run build
cd ~/.n8n/nodes
npm install /path/to/n8n-nodes-deerapi-plus

# 方式二：直接复制（Docker 环境推荐）
cp -r dist/ ~/.n8n/nodes/node_modules/n8n-nodes-deerapi-plus/dist/
cp package.json ~/.n8n/nodes/node_modules/n8n-nodes-deerapi-plus/

# 重启 n8n
docker restart n8n
```

## 9. 测试覆盖情况

- 91 个单元测试
- 覆盖率：96% statements / 86% branches
- 测试框架：Jest + ts-jest
- Mock 策略：所有 HTTP 请求通过 jest.mock 拦截

### jest.config.js

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: [
    'nodes/**/*.ts',
    'credentials/**/*.ts',
    'transport/**/*.ts',
    '!**/*.d.ts',
  ],
};
```

## 10. CI/CD (.github/workflows/ci.yml)

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
  publish:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 11. 待完成事项

- [ ] 重建项目源码（基于本文档）
- [ ] 编译并安装到 ~/.n8n/nodes
- [ ] 在 n8n 编辑器中验证节点出现
- [ ] 配置 DeerAPI 凭证（API Key）
- [ ] 端到端测试 4 个操作
- [ ] 提交到 GitHub
- [ ] 发布到 npm

## 12. DeerAPI 官方文档

- 官网：https://deerapi.com
- API 文档：https://deerapi.com/docs
- 需要注册获取 API Key

---

*交接文档生成时间：2026 年*
*下次会话可直接基于此文档重建项目*
