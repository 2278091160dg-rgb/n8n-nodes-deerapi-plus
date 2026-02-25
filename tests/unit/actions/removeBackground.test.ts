import { executeRemoveBackground } from '../../../nodes/DeerApi/actions/removeBackground';

jest.mock('../../../transport/request', () => ({
	deerApiRequest: jest.fn(),
}));

import { deerApiRequest } from '../../../transport/request';
const mockDeerApiRequest = deerApiRequest as jest.MockedFunction<typeof deerApiRequest>;

describe('executeRemoveBackground', () => {
	let mockContext: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockContext = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'DeerAPI Plus' }),
			helpers: {
				httpRequest: jest.fn(),
				assertBinaryData: jest.fn(),
				prepareBinaryData: jest.fn(),
			},
		};
	});

	// Parameter order: model, inputMethod, additionalOptions, then imageUrl or binaryProperty

	it('should remove background from URL input', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image') // model
			.mockReturnValueOnce('url') // inputMethod
			.mockReturnValueOnce({}) // additionalOptions
			.mockReturnValueOnce('https://example.com/photo.jpg'); // imageUrl

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'Result: https://cdn.deerapi.com/nobg.png' } }],
		});

		const result = await executeRemoveBackground.call(mockContext, 0);

		expect(result).toHaveLength(1);
		expect(result[0].json.success).toBe(true);
		expect(result[0].json.operation).toBe('removeBackground');
		expect(result[0].json.model).toBe('gemini-2.5-flash-image');
		expect(result[0].json.input_method).toBe('url');
		expect(result[0].json.image_url).toBe('https://cdn.deerapi.com/nobg.png');
		expect(result[0].json.processing_time_ms).toBeGreaterThanOrEqual(0);
		expect(result[0].pairedItem).toEqual({ item: 0 });
	});

	it('should remove background from binary input', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('binary')
			.mockReturnValueOnce({}) // additionalOptions
			.mockReturnValueOnce('data'); // binaryProperty

		mockContext.helpers.assertBinaryData.mockReturnValue({
			data: 'base64imagedata',
			mimeType: 'image/jpeg',
		});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		const result = await executeRemoveBackground.call(mockContext, 0);

		expect(result[0].json.input_method).toBe('binary');
		expect(result[0].json.image_url).toBe('https://cdn.deerapi.com/nobg.png');
		expect(mockContext.helpers.assertBinaryData).toHaveBeenCalledWith(0, 'data');
	});

	it('should handle binary input with default mime type', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('binary')
			.mockReturnValueOnce({})
			.mockReturnValueOnce('data');

		mockContext.helpers.assertBinaryData.mockReturnValue({
			data: 'base64imagedata',
			mimeType: '',
		});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		const result = await executeRemoveBackground.call(mockContext, 0);

		expect(result[0].json.image_url).toBe('https://cdn.deerapi.com/nobg.png');
		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.messages[0].content[1].image_url.url).toContain('data:image/png;base64,');
	});

	it('should handle no image URL in response', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('url')
			.mockReturnValueOnce({ simplify: false })
			.mockReturnValueOnce('https://example.com/photo.jpg');

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'Could not process the image' } }],
		});

		const result = await executeRemoveBackground.call(mockContext, 0);

		expect(result[0].json.image_url).toBeNull();
		expect(result[0].json.raw_content).toBe('Could not process the image');
	});

	it('should use correct model', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-pro-preview')
			.mockReturnValueOnce('url')
			.mockReturnValueOnce({})
			.mockReturnValueOnce('https://example.com/photo.jpg');

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		const result = await executeRemoveBackground.call(mockContext, 0);

		expect(result[0].json.model).toBe('gemini-3-pro-preview');
		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.model).toBe('gemini-3-pro-preview');
	});

	it('should track processing time', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('url')
			.mockReturnValueOnce({})
			.mockReturnValueOnce('https://example.com/photo.jpg');

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		const result = await executeRemoveBackground.call(mockContext, 0);

		expect(typeof result[0].json.processing_time_ms).toBe('number');
	});

	it('should send correct message structure for URL input', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('url')
			.mockReturnValueOnce({})
			.mockReturnValueOnce('https://example.com/photo.jpg');

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		await executeRemoveBackground.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.messages[0].content).toHaveLength(2);
		expect(callBody.messages[0].content[0].type).toBe('text');
		expect(callBody.messages[0].content[1].type).toBe('image_url');
		expect(callBody.messages[0].content[1].image_url.url).toBe('https://example.com/photo.jpg');
	});

	it('should use custom model when selected', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('__custom') // model
			.mockReturnValueOnce('my-custom-model') // customModel
			.mockReturnValueOnce('url') // inputMethod
			.mockReturnValueOnce({}) // additionalOptions
			.mockReturnValueOnce('https://example.com/photo.jpg'); // imageUrl

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		const result = await executeRemoveBackground.call(mockContext, 0);

		expect(result[0].json.model).toBe('my-custom-model');
		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.model).toBe('my-custom-model');
	});

	it('should download binary data when outputType is binary', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('url')
			.mockReturnValueOnce({ outputType: 'binary' }) // additionalOptions
			.mockReturnValueOnce('https://example.com/photo.jpg');

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		const imageBuffer = Buffer.from('fake-image');
		mockContext.helpers.httpRequest.mockResolvedValue(imageBuffer);
		mockContext.helpers.prepareBinaryData.mockResolvedValue({
			data: 'base64',
			mimeType: 'image/png',
			fileName: 'output.png',
		});

		const result = await executeRemoveBackground.call(mockContext, 0);

		expect(result[0].binary).toBeDefined();
		expect(result[0].binary!.data).toBeDefined();
		expect(mockContext.helpers.httpRequest).toHaveBeenCalledWith({
			method: 'GET',
			url: 'https://cdn.deerapi.com/nobg.png',
			encoding: 'arraybuffer',
		});
	});

	it('should use systemPromptOverride when provided', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('url')
			.mockReturnValueOnce({ systemPromptOverride: 'Custom bg removal instructions.' })
			.mockReturnValueOnce('https://example.com/photo.jpg');

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		await executeRemoveBackground.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.messages[0].role).toBe('system');
		expect(callBody.messages[0].content).toBe('Custom bg removal instructions.');
		expect(callBody.messages[1].role).toBe('user');
	});

	it('should use default prompt when systemPromptOverride is empty', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('url')
			.mockReturnValueOnce({ systemPromptOverride: '' })
			.mockReturnValueOnce('https://example.com/photo.jpg');

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		await executeRemoveBackground.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.messages[0].role).toBe('user');
	});

	it('should merge extraBodyFields into request body', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('url')
			.mockReturnValueOnce({ extraBodyFields: '{"top_p": 0.9}' })
			.mockReturnValueOnce('https://example.com/photo.jpg');

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		await executeRemoveBackground.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.top_p).toBe(0.9);
		expect(callBody.model).toBe('gemini-2.5-flash-image');
	});

	it('should ignore invalid extraBodyFields JSON', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('url')
			.mockReturnValueOnce({ extraBodyFields: 'not json' })
			.mockReturnValueOnce('https://example.com/photo.jpg');

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/nobg.png' } }],
		});

		const result = await executeRemoveBackground.call(mockContext, 0);

		expect(result[0].json.success).toBe(true);
		expect(result[0].json.operation).toBe('removeBackground');
	});
});
