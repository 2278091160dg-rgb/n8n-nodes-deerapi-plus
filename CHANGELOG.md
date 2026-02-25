# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-02-25

### Added
- **Chat text generation** — New resource with full model support (Gemini, GPT-4o, Claude, DeepSeek)
- **Dynamic model loading** — Models fetched from `/v1/models` API with local fallback
- **Aspect ratio selector** — 10 presets (1:1, 16:9, 9:16, 4:5, etc.) for image generation
- **Resolution selector** — 1K/2K output resolution
- **Mode selector foundation** — Cost/speed tier metadata on all models
- **Safe response parsing** — `safeExtractChatContent()` and `extractImageUrl()` utilities
- **Endpoint mapping** — Model ID → API endpoint routing (foundation for Phase 2)
- **AI Agent compatibility** — `usableAsTool: true` for n8n AI Agent integration

### Fixed
- **D-01**: Router now reads resource/operation per-item instead of hardcoded index 0
- **D-02**: Image model ID corrected from `gemini-3-pro-preview` to `gemini-3-pro-image-preview`
- **D-03**: URL regex excludes `)` to handle Markdown `![](url)` format correctly
- **D-04**: `extraBodyFields` blacklist expanded with `stream`, `tools`, `tool_choice`, `function_call`, `functions`
- **D-05**: HANDOVER.md rewritten with accurate API endpoints and credential names

### Changed
- All model dropdowns now use `loadOptionsMethod` for dynamic loading
- All action files use centralized `safeExtractChatContent` and `extractImageUrl`

## [0.4.0] - 2026-02-24

### Added
- Initial release with 4 operations: Image Generate, Remove Background, Enhance Prompt, Virtual Try-On
- Retry with exponential backoff (3 retries)
- Circuit breaker (5 failures / 30s window)
- Error sanitization (API key masking)
- 96% test coverage (114 tests)
