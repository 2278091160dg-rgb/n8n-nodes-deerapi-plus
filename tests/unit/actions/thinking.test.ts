import { executeThinking } from '../../../nodes/DeerApi/actions/thinking';

jest.mock('../../../transport/request', () => ({
	deerApiRequest: jest.fn(),
}));

import { deerApiRequest } from '../../../transport/request';

describe('actions/thinking', () => {
	let mockContext: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockContext = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'DeerAPI Plus' }),
			helpers: {
				httpRequest: jest.fn(),
				prepareBinaryData: jest.fn(),
				assertBinaryData: jest.fn(),
			},
			continueOnFail: jest.fn().mockReturnValue(false),
			getCredentials: jest.fn().mockResolvedValue({
				apiKey: 'test-key',
				baseUrl: 'https://api.deerapi.com',
			}),
		};
	});

	it('should generate thinking response with default options', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-flash-preview-thinking') // model
			.mockReturnValueOnce('What is 2+2?')                    // userPrompt
			.mockReturnValueOnce(5000)                               // budgetTokens
			.mockReturnValueOnce({});                                // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{
				message: {
					content: 'The answer is 4.',
					thinking: 'Let me add 2 and 2. That gives 4.',
				},
				finish_reason: 'stop',
			}],
			usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
		});

		const result = await executeThinking.call(mockContext, 0);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: true,
			operation: 'thinking',
			model: 'gemini-3-flash-preview-thinking',
			content: 'The answer is 4.',
			thinking: 'Let me add 2 and 2. That gives 4.',
			budget_tokens: 5000,
			processing_time_ms: expect.any(Number),
		});
		expect(result[0].pairedItem).toEqual({ item: 0 });

		const callArgs = (deerApiRequest as jest.Mock).mock.calls[0][0];
		expect(callArgs.timeout).toBe(120000);
		expect(callArgs.body.temperature).toBe(1);
		expect(callArgs.body.thinking).toEqual({ type: 'enabled', budget_tokens: 5000 });
	});

	it('should use custom model when __custom selected', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('__custom')                        // model
			.mockReturnValueOnce('my-thinking-model')               // customModel
			.mockReturnValueOnce('Solve this')                      // userPrompt
			.mockReturnValueOnce(3000)                               // budgetTokens
			.mockReturnValueOnce({});                                // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Done', thinking: 'Thinking...' }, finish_reason: 'stop' }],
		});

		const result = await executeThinking.call(mockContext, 0);
		expect(result[0].json.model).toBe('my-thinking-model');
	});

	it('should pass budget_tokens to request body', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-flash-preview-thinking')
			.mockReturnValueOnce('Think hard')
			.mockReturnValueOnce(8000)
			.mockReturnValueOnce({});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Result' }, finish_reason: 'stop' }],
		});

		await executeThinking.call(mockContext, 0);

		const callBody = (deerApiRequest as jest.Mock).mock.calls[0][0].body;
		expect(callBody.thinking.budget_tokens).toBe(8000);
	});

	it('should extract thinking block from response', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-pro-preview-thinking')
			.mockReturnValueOnce('Complex problem')
			.mockReturnValueOnce(5000)
			.mockReturnValueOnce({});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{
				message: {
					content: 'Final answer',
					thinking: 'Step 1: analyze. Step 2: solve.',
				},
				finish_reason: 'stop',
			}],
		});

		const result = await executeThinking.call(mockContext, 0);
		expect(result[0].json.thinking).toBe('Step 1: analyze. Step 2: solve.');
		expect(result[0].json.content).toBe('Final answer');
	});

	it('should handle reasoning_content field as thinking', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('claude-opus-4-5-thinking')
			.mockReturnValueOnce('Why is the sky blue?')
			.mockReturnValueOnce(5000)
			.mockReturnValueOnce({});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{
				message: {
					content: 'Rayleigh scattering.',
					reasoning_content: 'The sky appears blue because...',
				},
				finish_reason: 'stop',
			}],
		});

		const result = await executeThinking.call(mockContext, 0);
		expect(result[0].json.thinking).toBe('The sky appears blue because...');
	});

	it('should handle malformed response safely', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-flash-preview-thinking')
			.mockReturnValueOnce('Hello')
			.mockReturnValueOnce(5000)
			.mockReturnValueOnce({});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({ unexpected: 'format' });

		const result = await executeThinking.call(mockContext, 0);
		expect(result[0].json.content).toBe('');
		expect(result[0].json.thinking).toBe('');
		expect(result[0].json.success).toBe(true);
	});

	it('should strip dangerous fields from extraBodyFields', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-flash-preview-thinking')
			.mockReturnValueOnce('Hello')
			.mockReturnValueOnce(5000)
			.mockReturnValueOnce({
				extraBodyFields: '{"stream": true, "tools": [], "top_p": 0.9}',
			});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'OK', thinking: 'OK thought' }, finish_reason: 'stop' }],
		});

		await executeThinking.call(mockContext, 0);

		const callBody = (deerApiRequest as jest.Mock).mock.calls[0][0].body;
		expect(callBody.top_p).toBe(0.9);
		expect(callBody.stream).toBeUndefined();
		expect(callBody.tools).toBeUndefined();
	});

	it('should return full response when simplify is false', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-flash-preview-thinking')
			.mockReturnValueOnce('Hello')
			.mockReturnValueOnce(5000)
			.mockReturnValueOnce({ simplify: false });

		const mockResponse = {
			choices: [{ message: { content: 'Hi', thinking: 'Hmm' }, finish_reason: 'stop' }],
			usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
		};
		(deerApiRequest as jest.Mock).mockResolvedValueOnce(mockResponse);

		const result = await executeThinking.call(mockContext, 0);
		expect(result[0].json.usage).toEqual({ prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 });
		expect(result[0].json.raw_response).toBeDefined();
		expect(result[0].json.finish_reason).toBe('stop');
	});

	it('should pass system prompt and maxTokens from additionalOptions', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-flash-preview-thinking')
			.mockReturnValueOnce('Solve this')
			.mockReturnValueOnce(5000)
			.mockReturnValueOnce({
				systemPrompt: 'You are a math expert.',
				maxTokens: 4096,
			});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Solved' }, finish_reason: 'stop' }],
		});

		await executeThinking.call(mockContext, 0);

		const callBody = (deerApiRequest as jest.Mock).mock.calls[0][0].body;
		expect(callBody.messages[0].content).toBe('You are a math expert.');
		expect(callBody.max_tokens).toBe(4096);
	});

	it('should route Claude thinking models to Anthropic endpoint', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('claude-opus-4-5-thinking')
			.mockReturnValueOnce('Analyze this')
			.mockReturnValueOnce(8000)
			.mockReturnValueOnce({ systemPrompt: 'Think deeply.' });

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Analysis', reasoning_content: 'Step by step...' }, finish_reason: 'stop' }],
		});

		await executeThinking.call(mockContext, 0);

		const call = (deerApiRequest as jest.Mock).mock.calls[0][0];
		expect(call.endpoint).toBe('/v1/messages');
		expect(call.body.system).toBe('Think deeply.');
		expect(call.body.messages).toEqual([{ role: 'user', content: 'Analyze this' }]);
		expect(call.body.thinking).toEqual({ type: 'enabled', budget_tokens: 8000 });
	});
});
