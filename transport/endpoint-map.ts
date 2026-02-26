/**
 * Model ID → API endpoint mapping.
 * DeerAPI routes different model families to different endpoints.
 * This map is the single source of truth for endpoint resolution.
 *
 * Decision 9 (反向审计): Endpoints must be configurable, not hardcoded in action files.
 */

interface EndpointConfig {
	path: string;
	format: 'openai' | 'anthropic' | 'gemini';
}

/**
 * Pattern-based endpoint routing rules.
 * Evaluated in order — first match wins.
 */
const ENDPOINT_RULES: Array<{ pattern: RegExp; config: EndpointConfig }> = [
	// Embedding models → dedicated endpoint
	{ pattern: /^text-embedding-/, config: { path: '/v1/embeddings', format: 'openai' } },
	// Video models → dedicated endpoint
	{ pattern: /^(sora-|veo-|luma-)/, config: { path: '/v1/videos/generations', format: 'openai' } },
	// Anthropic models → Anthropic format
	{ pattern: /^claude-/, config: { path: '/v1/messages', format: 'anthropic' } },
	// Doubao image models → images endpoint
	{ pattern: /^doubao-/, config: { path: '/v1/images/generations', format: 'openai' } },
];

/** Default endpoint for all unmatched models (OpenAI chat completions) */
const DEFAULT_ENDPOINT: EndpointConfig = {
	path: '/v1/chat/completions',
	format: 'openai',
};

/**
 * Resolve the API endpoint and format for a given model ID.
 */
export function resolveEndpoint(modelId: string): EndpointConfig {
	for (const rule of ENDPOINT_RULES) {
		if (rule.pattern.test(modelId)) {
			return rule.config;
		}
	}
	return DEFAULT_ENDPOINT;
}

/**
 * Build a format-aware request body and resolve the endpoint for a chat-style API call.
 * Handles OpenAI vs Anthropic message format differences:
 * - OpenAI: system message in messages array
 * - Anthropic: system as top-level field, not in messages
 */
export function buildRequestForModel(params: {
	model: string;
	messages: Array<{ role: string; content: any }>;
	[key: string]: any;
}): { endpoint: string; body: Record<string, any> } {
	const { path, format } = resolveEndpoint(params.model);

	if (format === 'anthropic') {
		const systemMessages = params.messages.filter((m) => m.role === 'system');
		const nonSystemMessages = params.messages.filter((m) => m.role !== 'system');
		const systemContent = systemMessages.map((m) => m.content).join('\n') || undefined;

		const { messages: _, ...rest } = params;
		return {
			endpoint: path,
			body: {
				...rest,
				...(systemContent ? { system: systemContent } : {}),
				messages: nonSystemMessages,
			},
		};
	}

	return { endpoint: path, body: params };
}
