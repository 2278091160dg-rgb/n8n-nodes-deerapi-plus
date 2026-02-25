import { executeEnhancePrompt } from '../../../nodes/DeerApi/actions/enhancePrompt';

jest.mock('../../../transport/request', () => ({
	deerApiRequest: jest.fn(),
}));

import { deerApiRequest } from '../../../transport/request';
const mockDeerApiRequest = deerApiRequest as jest.MockedFunction<typeof deerApiRequest>;

describe('executeEnhancePrompt', () => {
	let mockContext: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockContext = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'DeerAPI Plus' }),
		};
	});

	it('should enhance prompt with JSON response', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash') // model
			.mockReturnValueOnce('red shoes on white background') // prompt
			.mockReturnValueOnce('product_photo') // category
			.mockReturnValueOnce({}); // additionalOptions

		const jsonResponse = JSON.stringify({
			enhanced_prompt: 'Professional product photography of elegant red leather shoes on seamless white background with soft studio lighting',
			suggestions: ['Add rim lighting', 'Use 45-degree angle', 'Include shadow detail'],
			category: 'product_photo',
		});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: jsonResponse } }],
		});

		const result = await executeEnhancePrompt.call(mockContext, 0);

		expect(result).toHaveLength(1);
		expect(result[0].json.success).toBe(true);
		expect(result[0].json.operation).toBe('enhance');
		expect(result[0].json.model).toBe('gemini-2.5-flash');
		expect(result[0].json.original_prompt).toBe('red shoes on white background');
		expect(result[0].json.enhanced_prompt).toContain('Professional product photography');
		expect(result[0].json.suggestions).toHaveLength(3);
		expect(result[0].json.category).toBe('product_photo');
		expect(result[0].json.processing_time_ms).toBeGreaterThanOrEqual(0);
		expect(result[0].pairedItem).toEqual({ item: 0 });
	});

	it('should handle non-JSON response', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gpt-4o')
			.mockReturnValueOnce('test prompt')
			.mockReturnValueOnce('lifestyle')
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'Enhanced: A beautiful lifestyle shot with natural lighting' } }],
		});

		const result = await executeEnhancePrompt.call(mockContext, 0);

		expect(result[0].json.enhanced_prompt).toBe('Enhanced: A beautiful lifestyle shot with natural lighting');
		expect(result[0].json.suggestions).toEqual([]);
		expect(result[0].json.category).toBe('lifestyle');
	});

	it('should pass style option in user message', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('product photo')
			.mockReturnValueOnce('flat_lay')
			.mockReturnValueOnce({ style: 'minimalist' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: '{"enhanced_prompt":"test","suggestions":[],"category":"flat_lay"}' } }],
		});

		await executeEnhancePrompt.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		const userMessage = callBody.messages[1].content;
		expect(userMessage).toContain('Style: minimalist');
	});

	it('should pass language option in user message', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('product photo')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({ language: 'zh' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: '{"enhanced_prompt":"test","suggestions":[],"category":"product_photo"}' } }],
		});

		await executeEnhancePrompt.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		const userMessage = callBody.messages[1].content;
		expect(userMessage).toContain('Output Language: Chinese');
	});

	it('should pass English language correctly', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({ language: 'en' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: '{"enhanced_prompt":"test","suggestions":[],"category":"product_photo"}' } }],
		});

		await executeEnhancePrompt.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		const userMessage = callBody.messages[1].content;
		expect(userMessage).toContain('Output Language: English');
	});

	it('should use correct API parameters', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'enhanced' } }],
		});

		await executeEnhancePrompt.call(mockContext, 0);

		const call = mockDeerApiRequest.mock.calls[0][0] as any;
		expect(call.method).toBe('POST');
		expect(call.endpoint).toBe('/v1/chat/completions');
		expect(call.body.model).toBe('gemini-2.5-flash');
		expect(call.body.max_tokens).toBe(2048);
		expect(call.body.temperature).toBe(0.7);
		expect(call.body.messages[0].role).toBe('system');
	});

	it('should handle empty response content', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: '' } }],
		});

		const result = await executeEnhancePrompt.call(mockContext, 0);

		expect(result[0].json.enhanced_prompt).toBe('');
	});

	it('should use correct pairedItem index', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'enhanced' } }],
		});

		const result = await executeEnhancePrompt.call(mockContext, 5);

		expect(result[0].pairedItem).toEqual({ item: 5 });
	});

	it('should handle JSON with missing fields', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce('banner')
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: '{"enhanced_prompt":"better prompt"}' } }],
		});

		const result = await executeEnhancePrompt.call(mockContext, 0);

		expect(result[0].json.enhanced_prompt).toBe('better prompt');
		expect(result[0].json.suggestions).toEqual([]);
		expect(result[0].json.category).toBe('banner');
	});

	it('should use custom model when selected', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('__custom') // model
			.mockReturnValueOnce('my-custom-llm') // customModel
			.mockReturnValueOnce('test prompt')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({ simplify: false });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'enhanced' } }],
		});

		const result = await executeEnhancePrompt.call(mockContext, 0);

		expect(result[0].json.model).toBe('my-custom-llm');
		expect(result[0].json.raw_content).toBe('enhanced');
		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.model).toBe('my-custom-llm');
	});

	it('should use systemPromptOverride when provided', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({ systemPromptOverride: 'You are a custom prompt engineer.' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'enhanced' } }],
		});

		await executeEnhancePrompt.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.messages[0].content).toBe('You are a custom prompt engineer.');
	});

	it('should use default system prompt when override is empty', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({ systemPromptOverride: '' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'enhanced' } }],
		});

		await executeEnhancePrompt.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.messages[0].content).toContain('expert e-commerce product image prompt engineer');
	});

	it('should merge extraBodyFields into request body', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({ extraBodyFields: '{"top_p": 0.9, "frequency_penalty": 0.5}' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'enhanced' } }],
		});

		await executeEnhancePrompt.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.top_p).toBe(0.9);
		expect(callBody.frequency_penalty).toBe(0.5);
		expect(callBody.model).toBe('gemini-2.5-flash');
	});

	it('should ignore invalid extraBodyFields JSON', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce('product_photo')
			.mockReturnValueOnce({ extraBodyFields: 'not valid json' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'enhanced' } }],
		});

		const result = await executeEnhancePrompt.call(mockContext, 0);

		expect(result[0].json.success).toBe(true);
		expect(result[0].json.operation).toBe('enhance');
	});
});
