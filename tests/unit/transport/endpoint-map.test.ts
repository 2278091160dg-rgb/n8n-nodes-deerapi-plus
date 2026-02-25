import { resolveEndpoint } from '../../../transport/endpoint-map';

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
