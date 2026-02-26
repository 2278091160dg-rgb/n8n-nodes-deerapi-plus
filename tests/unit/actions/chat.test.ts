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

	it('should generate text with recommended mode (default)', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('recommended')            // mode
			.mockReturnValueOnce('Hello world')            // userPrompt
			.mockReturnValueOnce({});                       // additionalOptions

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

	it('should use custom model when mode is custom + __custom', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('custom')                 // mode
			.mockReturnValueOnce('__custom')               // model
			.mockReturnValueOnce('my-custom-model')        // customModel
			.mockReturnValueOnce('Test prompt')            // userPrompt
			.mockReturnValueOnce({});                       // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
		});

		const result = await executeChat.call(mockContext, 0);
		expect(result[0].json.model).toBe('my-custom-model');
	});

	it('should use selected model when mode is custom', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('custom')                 // mode
			.mockReturnValueOnce('gpt-4o')                 // model
			.mockReturnValueOnce('Translate this')         // userPrompt
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

	it('should auto-select quality model for quality mode', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('quality')                // mode
			.mockReturnValueOnce('Hello')                  // userPrompt
			.mockReturnValueOnce({});                       // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }],
		});

		const result = await executeChat.call(mockContext, 0);
		expect(result[0].json.model).toBe('claude-opus-4-5');
	});

	it('should auto-select budget model for budget mode', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('budget')                 // mode
			.mockReturnValueOnce('Hello')                  // userPrompt
			.mockReturnValueOnce({});                       // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }],
		});

		const result = await executeChat.call(mockContext, 0);
		expect(result[0].json.model).toBe('deepseek-chat');
	});

	it('should auto-select fast model for fast mode', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('fast')                   // mode
			.mockReturnValueOnce('Hello')                  // userPrompt
			.mockReturnValueOnce({});                       // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }],
		});

		const result = await executeChat.call(mockContext, 0);
		expect(result[0].json.model).toBe('gemini-2.5-flash');
	});

	it('should return full response when simplify is false', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('recommended')            // mode
			.mockReturnValueOnce('Hello')                  // userPrompt
			.mockReturnValueOnce({ simplify: false });     // additionalOptions

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
			.mockReturnValueOnce('recommended')            // mode
			.mockReturnValueOnce('Hello')                  // userPrompt
			.mockReturnValueOnce({});                       // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({ unexpected: 'format' });

		const result = await executeChat.call(mockContext, 0);
		expect(result[0].json.content).toBe('');
		expect(result[0].json.success).toBe(true);
	});

	it('should strip dangerous fields from extraBodyFields', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('recommended')            // mode
			.mockReturnValueOnce('Hello')                  // userPrompt
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

	it('should route Claude models to Anthropic endpoint (quality mode)', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('quality')                // mode → claude-opus-4-5
			.mockReturnValueOnce('Hello Claude')           // userPrompt
			.mockReturnValueOnce({ systemPrompt: 'Be helpful.' });

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Hi from Claude' }, finish_reason: 'end_turn' }],
		});

		await executeChat.call(mockContext, 0);

		const call = (deerApiRequest as jest.Mock).mock.calls[0][0];
		expect(call.endpoint).toBe('/v1/messages');
		expect(call.body.system).toBe('Be helpful.');
		expect(call.body.messages).toEqual([{ role: 'user', content: 'Hello Claude' }]);
	});

	it('should route OpenAI models to /v1/chat/completions (custom mode)', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('custom')                 // mode
			.mockReturnValueOnce('gpt-4o')                 // model
			.mockReturnValueOnce('Hello GPT')              // userPrompt
			.mockReturnValueOnce({});                       // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }],
		});

		await executeChat.call(mockContext, 0);

		const call = (deerApiRequest as jest.Mock).mock.calls[0][0];
		expect(call.endpoint).toBe('/v1/chat/completions');
		expect(call.body.messages[0].role).toBe('system');
		expect(call.body.system).toBeUndefined();
	});

	it('should include binary images in message (Vision)', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('recommended')            // mode
			.mockReturnValueOnce('Describe this image')    // userPrompt
			.mockReturnValueOnce({ binaryPropertyName: 'data' });

		mockContext.helpers.assertBinaryData.mockReturnValueOnce({
			data: 'aGVsbG8=',
			mimeType: 'image/png',
		});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'A cat' }, finish_reason: 'stop' }],
		});

		await executeChat.call(mockContext, 0);

		const callBody = (deerApiRequest as jest.Mock).mock.calls[0][0].body;
		const userMsg = callBody.messages.find((m: any) => m.role === 'user');
		expect(Array.isArray(userMsg.content)).toBe(true);
		expect(userMsg.content[0]).toEqual({ type: 'text', text: 'Describe this image' });
		expect(userMsg.content[1]).toEqual({
			type: 'image_url',
			image_url: { url: 'data:image/png;base64,aGVsbG8=' },
		});
	});

	it('should handle multiple binary properties for Vision', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('recommended')            // mode
			.mockReturnValueOnce('Compare these')          // userPrompt
			.mockReturnValueOnce({ binaryPropertyName: 'img1, img2' });

		mockContext.helpers.assertBinaryData
			.mockReturnValueOnce({ data: 'abc=', mimeType: 'image/jpeg' })
			.mockReturnValueOnce({ data: 'def=', mimeType: 'image/png' });

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Different' }, finish_reason: 'stop' }],
		});

		await executeChat.call(mockContext, 0);

		const userMsg = (deerApiRequest as jest.Mock).mock.calls[0][0].body.messages.find((m: any) => m.role === 'user');
		expect(userMsg.content).toHaveLength(3);
		expect(userMsg.content[1].image_url.url).toBe('data:image/jpeg;base64,abc=');
		expect(userMsg.content[2].image_url.url).toBe('data:image/png;base64,def=');
	});

	it('should fall back to text-only when binary property not found', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('recommended')            // mode
			.mockReturnValueOnce('Hello')                  // userPrompt
			.mockReturnValueOnce({ binaryPropertyName: 'missing' });

		mockContext.helpers.assertBinaryData.mockImplementation(() => {
			throw new Error('No binary data');
		});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }],
		});

		await executeChat.call(mockContext, 0);

		const userMsg = (deerApiRequest as jest.Mock).mock.calls[0][0].body.messages.find((m: any) => m.role === 'user');
		expect(userMsg.content).toBe('Hello');
	});
});