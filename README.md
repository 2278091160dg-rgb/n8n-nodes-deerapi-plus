# n8n-nodes-deerapi-plus

n8n community node for [DeerAPI](https://deerapi.com) — AI text generation, image generation, video generation, deep reasoning, vector embeddings, background removal, prompt enhancement, and virtual try-on.

Supports 20+ models (Gemini, GPT-4o, Claude, DeepSeek, Doubao, Sora) with dynamic model loading.

## Installation

In your n8n instance:

1. Go to **Settings** → **Community Nodes**
2. Enter `n8n-nodes-deerapi-plus`
3. Click **Install**

Or via CLI:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-deerapi-plus
```

## Credentials

1. Get an API key from [deerapi.com](https://deerapi.com)
2. In n8n, go to **Credentials** → **New** → **DeerAPI Plus API**
3. Enter your API key

Note: This node uses credential type `deerApiPlusApi`. If you also have `n8n-nodes-deerapi` installed, you'll need separate credentials for each node (same API key works for both).

## Operations

| Resource | Operation | Description |
|----------|-----------|-------------|
| Chat | Generate | Text generation with AI models (Gemini, GPT-4o, Claude, DeepSeek) |
| Image | Generate | Text-to-image generation with aspect ratio and resolution control |
| Image | Remove Background | Remove or replace image backgrounds (transparent/white/custom) |
| Prompt | Enhance | E-commerce product image prompt optimization with structured JSON output |
| Virtual Try-On | Generate | AI virtual clothing try-on (person + garment compositing) |
| Video | Create | Generate videos from text prompts with async polling |
| Video | Retrieve | Check video generation status and get download URL |
| Video | Download | Download generated video as binary (video/mp4) |
| Video | List | List your generated videos with pagination |
| Thinking | Generate | Deep reasoning with configurable thinking budget (1–10000 tokens) |
| Embeddings | Generate | Text-to-vector embedding generation for semantic search |

## Features

- **Dynamic model loading** — Models fetched from DeerAPI `/v1/models` API, always up-to-date
- **Cost/speed indicators** — Each model shows cost tier (💰) and speed tier (⚡) in the dropdown
- **Custom model escape hatch** — Enter any model ID not yet in the list
- **Aspect ratio presets** — 1:1, 3:2, 16:9, 9:16, 4:5, and more for image generation
- **Retry + circuit breaker** — Exponential backoff (3 retries) with circuit breaker protection
- **Error sanitization** — API keys never appear in error messages
- **AI Agent compatible** — Works as a tool in n8n AI Agent workflows
- **continueOnFail** — Batch processing continues even if individual items fail

## Comparison with alternatives

| Feature | DeerAPI Plus | n8n-nodes-deerapi (毛淞淮) | n8n-nodes-qiyu-deerapi (七鱼) |
|---------|:-----------:|:-----------:|:-----------:|
| Chat text generation | ✅ | ✅ | ✅ |
| Image generation | ✅ | ✅ | ✅ |
| Video generation | ✅ | ❌ | ❌ |
| Deep reasoning (thinking) | ✅ | ❌ | ❌ |
| Embeddings | ✅ | ❌ | ❌ |
| Prompt enhancement | ✅ (e-commerce) | ❌ | ❌ |
| Background removal | ✅ | ❌ | ❌ |
| Virtual try-on | ✅ | ❌ | ❌ |
| Dynamic model loading | ✅ | ❌ | ❌ |
| Retry + circuit breaker | ✅ | ❌ | Partial |
| Error sanitization | ✅ | ❌ | ❌ |
| Test coverage | 174 tests | 0% | 0% |
| AI Agent compatible | ✅ | ❌ | ❌ |

## Development

```bash
npm install
npm test          # Run tests
npm run build     # Compile TypeScript
npm run lint      # ESLint check
```

## License

[MIT](LICENSE)
