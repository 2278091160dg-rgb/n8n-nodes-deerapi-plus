import { executeChat } from '../../../nodes/DeerApi/actions/chat';

jest.mock('../../../transport/request', () => ({
	deerApiRequest: jest.fn(),
}));

import { deerApiRequest } from '../../../transport/request';

describe('actions/chat', () => {
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

	it('should generate text with default options', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')  // model
			.mockReturnValueOnce('Hello world')        // userPrompt
			.mockReturnValueOnce({});                   // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Hi there!' }, finish_reason: 'stop' }],
			usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
		});

		const result = await executeChat.call(mockContext, 0);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: true,
			operation: 'chat',
			model: 'gemini-2.5-flash',
			content: 'Hi there!',
			finish_reason: 'stop',
			processing_time_ms: expect.any(Number),
		});
		expect(result[0].pairedItem).toEqual({ item: 0 });
	});

	it('should use custom model when __custom selected', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('__custom')           // model
			.mockReturnValueOnce('my-custom-model')    // customModel
			.mockReturnValueOnce('Test prompt')        // userPrompt
			.mockReturnValueOnce({});                   // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
		});

		const result = await executeChat.call(mockContext, 0);
		expect(result[0].json.model).toBe('my-custom-model');
	});

	it('should pass system prompt and temperature', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gpt-4o')
			.mockReturnValueOnce('Translate this')
			.mockReturnValueOnce({
				systemPrompt: 'You are a translator.',
				temperature: 0.3,
				maxTokens: 1024,
			});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Translated' }, finish_reason: 'stop' }],
		});

		await executeChat.call(mockContext, 0);

		const callBody = (deerApiRequest as jest.Mock).mock.calls[0][0].body;
		expect(callBody.messages[0].content).toBe('You are a translator.');
		expect(callBody.temperature).toBe(0.3);
		expect(callBody.max_tokens).toBe(1024);
	});

	it('should return full response when simplify is false', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('Hello')
			.mockReturnValueOnce({ simplify: false });

		const mockResponse = {
			choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }],
			usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
		};
		(deerApiRequest as jest.Mock).mockResolvedValueOnce(mockResponse);

		const result = await executeChat.call(mockContext, 0);
		expect(result[0].json.usage).toEqual({ prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 });
		expect(result[0].json.raw_response).toBeDefined();
	});

	it('should handle malformed response safely', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('Hello')
			.mockReturnValueOnce({});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({ unexpected: 'format' });

		const result = await executeChat.call(mockContext, 0);
		expect(result[0].json.content).toBe('');
		expect(result[0].json.success).toBe(true);
	});

	it('should strip dangerous fields from extraBodyFields', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash')
			.mockReturnValueOnce('Hello')
			.mockReturnValueOnce({
				extraBodyFields: '{"stream": true, "tools": [], "top_p": 0.9}',
			});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
		});

		await executeChat.call(mockContext, 0);

		const callBody = (deerApiRequest as jest.Mock).mock.calls[0][0].body;
		expect(callBody.top_p).toBe(0.9);
		expect(callBody.stream).toBeUndefined();
		expect(callBody.tools).toBeUndefined();
	});
});