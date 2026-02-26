# n8n-nodes-deerapi-plus

[DeerAPI](https://deerapi.com) 的 n8n 社区节点 — 支持 AI 文本生成、图片生成、视频生成、深度推理、向量嵌入、背景移除、提示词优化和虚拟试衣。

支持 20+ 模型（Gemini、GPT-4o、Claude、DeepSeek、豆包、Sora），模型列表动态加载，始终保持最新。

## 安装

在 n8n 中：

1. 进入 **Settings** → **Community Nodes**
2. 输入 `n8n-nodes-deerapi-plus`
3. 点击 **Install**

或通过命令行：

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-deerapi-plus
```

## 配置凭证

1. 在 [deerapi.com](https://deerapi.com) 获取 API Key
2. 在 n8n 中进入 **Credentials** → **New** → **DeerAPI Plus API**
3. 填入你的 API Key

## 功能列表

| 资源 | 操作 | 说明 |
|------|------|------|
| 对话 | 生成 | AI 文本生成（Gemini、GPT-4o、Claude、DeepSeek） |
| 图片 | 生成 | 文生图，支持宽高比和分辨率控制 |
| 图片 | 移除背景 | 移除或替换图片背景（透明/白色/自定义） |
| 提示词 | 优化 | 电商产品图提示词优化，输出结构化 JSON |
| 虚拟试衣 | 生成 | AI 虚拟换装（人物 + 服装合成） |
| 视频 | 创建 | 文生视频，支持异步轮询 |
| 视频 | 查询 | 查询视频生成状态和下载链接 |
| 视频 | 下载 | 下载生成的视频文件（video/mp4） |
| 视频 | 列表 | 分页查看已生成的视频 |
| 深度推理 | 生成 | 深度推理，可配置思考预算（1–10000 tokens） |
| 向量嵌入 | 生成 | 文本转向量，用于语义搜索 |

## 特性

- **动态模型加载** — 从 DeerAPI `/v1/models` 接口获取模型列表，始终最新
- **模式选择器** — 推荐/快速/高质量/经济/自定义五种模式，自动选择最优模型
- **视觉理解** — 对话中可附加图片，支持多模态对话
- **费用和速度标识** — 下拉列表中每个模型显示费用（💰）和速度（⚡）等级
- **自定义模型** — 可手动输入列表中尚未收录的模型 ID
- **宽高比预设** — 图片生成支持 1:1、3:2、16:9、9:16、4:5 等比例
- **重试 + 熔断** — 指数退避重试（3 次）+ 熔断器保护
- **错误脱敏** — API Key 不会出现在错误信息中
- **AI Agent 兼容** — 可作为 n8n AI Agent 工作流的工具节点使用
- **continueOnFail** — 批量处理时单条失败不影响整体执行

## 开发

```bash
npm install
npm test          # 运行测试
npm run build     # 编译 TypeScript
npm run lint      # ESLint 检查
```

## 许可证

[MIT](LICENSE)
