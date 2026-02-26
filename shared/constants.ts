/**
 * Model capability types for DeerAPI.
 * Used to filter models per operation in loadOptions.
 */
export type ModelCapability = 'text' | 'image' | 'video' | 'embedding' | 'thinking';

export interface ModelInfo {
	id: string;
	name: string;
	capabilities: ModelCapability[];
	costTier: 'low' | 'medium' | 'high';
	speedTier: 'fast' | 'medium' | 'slow';
}

/**
 * Fallback model list — used when /v1/models API is unavailable.
 * Source: DeerAPI模型配置规范 v1.1 (2026-02-25)
 */
/**
 * Mode → default model mapping per capability.
 * Used by the mode selector to auto-pick a model.
 */
export const MODE_DEFAULTS: Record<string, Record<ModelCapability, string>> = {
	recommended: {
		text: 'gemini-2.5-flash',
		image: 'gemini-2.5-flash-image',
		video: 'sora-2-all',
		embedding: 'text-embedding-3-small',
		thinking: 'gemini-3-flash-preview-thinking',
	},
	fast: {
		text: 'gemini-2.5-flash',
		image: 'gemini-2.5-flash-image',
		video: 'veo-3-fast',
		embedding: 'text-embedding-3-small',
		thinking: 'gemini-3-flash-preview-thinking',
	},
	quality: {
		text: 'claude-opus-4-5',
		image: 'gemini-3-pro-image-preview',
		video: 'sora-2-pro-all',
		embedding: 'text-embedding-3-large',
		thinking: 'claude-opus-4-5-thinking',
	},
	budget: {
		text: 'deepseek-chat',
		image: 'gemini-2.5-flash-image',
		video: 'veo-3-fast',
		embedding: 'text-embedding-3-small',
		thinking: 'gemini-3-flash-preview-thinking',
	},
};

/**
 * Resolve model ID from mode + capability.
 * Returns undefined for 'custom' mode (user picks manually).
 */
export function resolveModelFromMode(mode: string, capability: ModelCapability): string | undefined {
	if (mode === 'custom') return undefined;
	return MODE_DEFAULTS[mode]?.[capability];
}

export const FALLBACK_MODELS: ModelInfo[] = [
	// Text models
	{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capabilities: ['text'], costTier: 'low', speedTier: 'fast' },
	{ id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', capabilities: ['text'], costTier: 'medium', speedTier: 'medium' },
	{ id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', capabilities: ['text'], costTier: 'medium', speedTier: 'medium' },
	{ id: 'gpt-4o', name: 'GPT-4o', capabilities: ['text'], costTier: 'high', speedTier: 'slow' },
	{ id: 'gpt-4o-mini', name: 'GPT-4o Mini', capabilities: ['text'], costTier: 'low', speedTier: 'fast' },
	{ id: 'deepseek-v3.1', name: 'DeepSeek V3.1', capabilities: ['text'], costTier: 'low', speedTier: 'fast' },
	{ id: 'deepseek-v3', name: 'DeepSeek V3', capabilities: ['text'], costTier: 'low', speedTier: 'fast' },
	{ id: 'deepseek-chat', name: 'DeepSeek Chat', capabilities: ['text'], costTier: 'low', speedTier: 'fast' },
	{ id: 'claude-opus-4-5', name: 'Claude Opus 4.5', capabilities: ['text'], costTier: 'high', speedTier: 'slow' },
	{ id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', capabilities: ['text'], costTier: 'medium', speedTier: 'medium' },
	// Image models
	{ id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', capabilities: ['image'], costTier: 'low', speedTier: 'fast' },
	{ id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview', capabilities: ['image'], costTier: 'high', speedTier: 'slow' },
	{ id: 'doubao-seedream-4-5-251128', name: 'Doubao Seedream 4.5', capabilities: ['image'], costTier: 'medium', speedTier: 'fast' },
	// Video models (Phase 2)
	{ id: 'sora-2-all', name: 'Sora 2', capabilities: ['video'], costTier: 'high', speedTier: 'slow' },
	{ id: 'sora-2-pro-all', name: 'Sora 2 Pro', capabilities: ['video'], costTier: 'high', speedTier: 'slow' },
	{ id: 'veo-3', name: 'Veo 3', capabilities: ['video'], costTier: 'high', speedTier: 'slow' },
	{ id: 'veo-3-fast', name: 'Veo 3 Fast', capabilities: ['video'], costTier: 'medium', speedTier: 'fast' },
	// Embedding models (Phase 2)
	{ id: 'text-embedding-3-small', name: 'Text Embedding 3 Small', capabilities: ['embedding'], costTier: 'low', speedTier: 'fast' },
	{ id: 'text-embedding-3-large', name: 'Text Embedding 3 Large', capabilities: ['embedding'], costTier: 'medium', speedTier: 'medium' },
	// Thinking models (Phase 2)
	{ id: 'claude-opus-4-5-thinking', name: 'Claude Opus 4.5 Thinking', capabilities: ['thinking'], costTier: 'high', speedTier: 'slow' },
	{ id: 'gemini-3-flash-preview-thinking', name: 'Gemini 3 Flash Thinking', capabilities: ['thinking'], costTier: 'medium', speedTier: 'fast' },
	{ id: 'gemini-3-pro-preview-thinking', name: 'Gemini 3 Pro Thinking', capabilities: ['thinking'], costTier: 'high', speedTier: 'medium' },
];
