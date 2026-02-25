import { FALLBACK_MODELS } from '../../../shared/constants';

describe('shared/constants', () => {
	it('should have fallback models for all capability types', () => {
		const capabilities = ['text', 'image', 'video', 'embedding', 'thinking'] as const;
		for (const cap of capabilities) {
			const models = FALLBACK_MODELS.filter((m) => m.capabilities.includes(cap));
			expect(models.length).toBeGreaterThan(0);
		}
	});

	it('should have unique model IDs', () => {
		const ids = FALLBACK_MODELS.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('should have valid costTier and speedTier values', () => {
		for (const model of FALLBACK_MODELS) {
			expect(['low', 'medium', 'high']).toContain(model.costTier);
			expect(['fast', 'medium', 'slow']).toContain(model.speedTier);
		}
	});

	it('should include key image models with correct IDs', () => {
		const imageModels = FALLBACK_MODELS.filter((m) => m.capabilities.includes('image'));
		const ids = imageModels.map((m) => m.id);
		expect(ids).toContain('gemini-2.5-flash-image');
		expect(ids).toContain('gemini-3-pro-image-preview');
		expect(ids).toContain('doubao-seedream-4-5-251128');
		// Must NOT contain the old wrong ID
		expect(ids).not.toContain('gemini-3-pro-preview');
	});

	it('should include key text models', () => {
		const textModels = FALLBACK_MODELS.filter((m) => m.capabilities.includes('text'));
		const ids = textModels.map((m) => m.id);
		expect(ids).toContain('gemini-2.5-flash');
		expect(ids).toContain('gpt-4o');
		expect(ids).toContain('claude-sonnet-4-5');
		expect(ids).toContain('deepseek-v3.1');
	});
});
