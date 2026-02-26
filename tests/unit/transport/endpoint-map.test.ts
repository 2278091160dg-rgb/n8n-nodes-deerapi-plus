import { resolveEndpoint, buildRequestForModel } from '../../../transport/endpoint-map';

describe('transport/endpoint-map', () => {
	it('should route text models to /v1/chat/completions', () => {
		expect(resolveEndpoint('gemini-2.5-flash')).toEqual({ path: '/v1/chat/completions', format: 'openai' });
		expect(resolveEndpoint('gpt-4o')).toEqual({ path: '/v1/chat/completions', format: 'openai' });
		expect(resolveEndpoint('deepseek-v3.1')).toEqual({ path: '/v1/chat/completions', format: 'openai' });
	});

	it('should route image models to /v1/chat/completions (default)', () => {
		expect(resolveEndpoint('gemini-2.5-flash-image')).toEqual({ path: '/v1/chat/completions', format: 'openai' });
		expect(resolveEndpoint('gemini-3-pro-image-preview')).toEqual({ path: '/v1/chat/completions', format: 'openai' });
	});

	it('should route claude models to Anthropic endpoint', () => {
		expect(resolveEndpoint('claude-opus-4-5')).toEqual({ path: '/v1/messages', format: 'anthropic' });
		expect(resolveEndpoint('claude-sonnet-4-5')).toEqual({ path: '/v1/messages', format: 'anthropic' });
		expect(resolveEndpoint('claude-opus-4-5-thinking')).toEqual({ path: '/v1/messages', format: 'anthropic' });
	});

	it('should route embedding models to /v1/embeddings', () => {
		expect(resolveEndpoint('text-embedding-3-small')).toEqual({ path: '/v1/embeddings', format: 'openai' });
		expect(resolveEndpoint('text-embedding-3-large')).toEqual({ path: '/v1/embeddings', format: 'openai' });
	});

	it('should route video models to /v1/videos/generations', () => {
		expect(resolveEndpoint('sora-2-all')).toEqual({ path: '/v1/videos/generations', format: 'openai' });
		expect(resolveEndpoint('sora-2-pro-all')).toEqual({ path: '/v1/videos/generations', format: 'openai' });
		expect(resolveEndpoint('veo-3')).toEqual({ path: '/v1/videos/generations', format: 'openai' });
		expect(resolveEndpoint('luma-ray-2')).toEqual({ path: '/v1/videos/generations', format: 'openai' });
	});

	it('should route doubao models to /v1/images/generations', () => {
		expect(resolveEndpoint('doubao-seedream-4-5-251128')).toEqual({ path: '/v1/images/generations', format: 'openai' });
	});

	it('should default unknown models to /v1/chat/completions', () => {
		expect(resolveEndpoint('some-future-model')).toEqual({ path: '/v1/chat/completions', format: 'openai' });
	});
});

describe('buildRequestForModel', () => {
	it('should keep system in messages for OpenAI format', () => {
		const { endpoint, body } = buildRequestForModel({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: 'Be helpful.' },
				{ role: 'user', content: 'Hello' },
			],
			max_tokens: 1024,
		});
		expect(endpoint).toBe('/v1/chat/completions');
		expect(body.messages).toHaveLength(2);
		expect(body.messages[0].role).toBe('system');
		expect(body.system).toBeUndefined();
	});

	it('should extract system to top-level for Anthropic format', () => {
		const { endpoint, body } = buildRequestForModel({
			model: 'claude-sonnet-4-5',
			messages: [
				{ role: 'system', content: 'Be helpful.' },
				{ role: 'user', content: 'Hello' },
			],
			max_tokens: 1024,
		});
		expect(endpoint).toBe('/v1/messages');
		expect(body.system).toBe('Be helpful.');
		expect(body.messages).toHaveLength(1);
		expect(body.messages[0]).toEqual({ role: 'user', content: 'Hello' });
	});

	it('should concatenate multiple system messages for Anthropic', () => {
		const { body } = buildRequestForModel({
			model: 'claude-opus-4-5',
			messages: [
				{ role: 'system', content: 'Rule 1.' },
				{ role: 'system', content: 'Rule 2.' },
				{ role: 'user', content: 'Hi' },
			],
		});
		expect(body.system).toBe('Rule 1.\nRule 2.');
		expect(body.messages).toHaveLength(1);
	});

	it('should omit system field if no system messages for Anthropic', () => {
		const { body } = buildRequestForModel({
			model: 'claude-sonnet-4-5',
			messages: [{ role: 'user', content: 'Hi' }],
		});
		expect(body.system).toBeUndefined();
		expect(body.messages).toHaveLength(1);
	});

	it('should preserve extra params like temperature and thinking', () => {
		const { body } = buildRequestForModel({
			model: 'claude-opus-4-5-thinking',
			messages: [
				{ role: 'system', content: 'Think.' },
				{ role: 'user', content: 'Solve this.' },
			],
			max_tokens: 8192,
			thinking: { type: 'enabled', budget_tokens: 5000 },
		});
		expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 5000 });
		expect(body.max_tokens).toBe(8192);
		expect(body.system).toBe('Think.');
	});

	it('should route doubao image models to /v1/images/generations', () => {
		const { endpoint } = buildRequestForModel({
			model: 'doubao-seedream-4-5-251128',
			messages: [{ role: 'user', content: 'Generate image' }],
		});
		expect(endpoint).toBe('/v1/images/generations');
	});
});
