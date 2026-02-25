import { executeGenerateImage } from '../../../nodes/DeerApi/actions/generateImage';

jest.mock('../../../transport/request', () => ({
	deerApiRequest: jest.fn(),
}));

import { deerApiRequest } from '../../../transport/request';
const mockDeerApiRequest = deerApiRequest as jest.MockedFunction<typeof deerApiRequest>;

describe('executeGenerateImage', () => {
	let mockContext: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockContext = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'DeerAPI Plus' }),
			helpers: { httpRequest: jest.fn() },
		};
	});

	it('should generate image with enhanced prompt', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image') // model
			.mockReturnValueOnce('a red dress') // prompt
			.mockReturnValueOnce(true) // enhancePrompt
			.mockReturnValueOnce({}); // additionalOptions

		mockDeerApiRequest
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'Enhanced: a beautiful red dress with studio lighting' } }],
			})
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'Here is your image: https://cdn.deerapi.com/output.png' } }],
			});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result).toHaveLength(1);
		expect(result[0].json.success).toBe(true);
		expect(result[0].json.operation).toBe('generate');
		expect(result[0].json.model).toBe('gemini-2.5-flash-image');
		expect(result[0].json.original_prompt).toBe('a red dress');
		expect(result[0].json.enhanced_prompt).toBe('Enhanced: a beautiful red dress with studio lighting');
		expect(result[0].json.image_url).toBe('https://cdn.deerapi.com/output.png');
		expect(result[0].json.processing_time_ms).toBeGreaterThanOrEqual(0);
		expect(result[0].pairedItem).toEqual({ item: 0 });
	});

	it('should generate image without enhancement', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-pro-preview')
			.mockReturnValueOnce('a blue shirt')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'Image: https://cdn.deerapi.com/blue.jpg' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result[0].json.model).toBe('gemini-3-pro-preview');
		expect(result[0].json.original_prompt).toBe('a blue shirt');
		expect(result[0].json.enhanced_prompt).toBeUndefined();
		expect(result[0].json.image_url).toBe('https://cdn.deerapi.com/blue.jpg');
		expect(mockDeerApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should fallback to original prompt when enhancement fails', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test prompt')
			.mockReturnValueOnce(true)
			.mockReturnValueOnce({});

		mockDeerApiRequest
			.mockRejectedValueOnce(new Error('Enhancement failed'))
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'https://cdn.deerapi.com/test.png' } }],
			});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result[0].json.image_url).toBe('https://cdn.deerapi.com/test.png');
	});

	it('should handle no image URL in response', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ simplify: false });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'No image was generated' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result[0].json.image_url).toBeNull();
		expect(result[0].json.raw_content).toBe('No image was generated');
	});

	it('should pass additional options in non-simplified output', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ width: 512, height: 768, negativePrompt: 'blurry', simplify: false });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result[0].json.success).toBe(true);
		expect(result[0].json.operation).toBe('generate');
		expect(result[0].json.raw_content).toBe('https://cdn.deerapi.com/img.png');
	});

	it('should track processing time', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(typeof result[0].json.processing_time_ms).toBe('number');
		expect(result[0].json.processing_time_ms).toBeGreaterThanOrEqual(0);
	});

	it('should use correct pairedItem index', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 3);

		expect(result[0].pairedItem).toEqual({ item: 3 });
	});

	it('should call enhance with correct model and system prompt', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('product photo')
			.mockReturnValueOnce(true)
			.mockReturnValueOnce({});

		mockDeerApiRequest
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'enhanced prompt' } }],
			})
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
			});

		await executeGenerateImage.call(mockContext, 0);

		const enhanceCall = mockDeerApiRequest.mock.calls[0][0];
		expect((enhanceCall as any).body.model).toBe('gemini-2.5-flash');
		expect((enhanceCall as any).body.messages[0].role).toBe('system');
	});

	it('should handle empty response content', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ simplify: false });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: '' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result[0].json.raw_content).toBe('');
		expect(result[0].json.image_url).toBeNull();
	});

	it('should use custom model when selected', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('__custom') // model
			.mockReturnValueOnce('my-new-model') // customModel
			.mockReturnValueOnce('test prompt')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result[0].json.model).toBe('my-new-model');
		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.model).toBe('my-new-model');
	});

	it('should download binary data when outputType is binary', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ outputType: 'binary' });

		mockContext.helpers.httpRequest = jest.fn().mockResolvedValue(Buffer.from('fake-image'));
		mockContext.helpers.prepareBinaryData = jest.fn().mockResolvedValue({
			data: 'base64',
			mimeType: 'image/png',
			fileName: 'output.png',
		});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result[0].binary).toBeDefined();
		expect(result[0].binary!.data).toBeDefined();
		expect(mockContext.helpers.httpRequest).toHaveBeenCalledWith({
			method: 'GET',
			url: 'https://cdn.deerapi.com/img.png',
			encoding: 'arraybuffer',
		});
	});

	it('should not download binary when outputType is url', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ outputType: 'url' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result[0].binary).toBeUndefined();
	});

	it('should use systemPromptOverride when provided', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('product photo')
			.mockReturnValueOnce(true)
			.mockReturnValueOnce({ systemPromptOverride: 'Custom enhance prompt.' });

		mockDeerApiRequest
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'enhanced prompt' } }],
			})
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
			});

		await executeGenerateImage.call(mockContext, 0);

		const enhanceCall = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(enhanceCall.messages[0].content).toBe('Custom enhance prompt.');
	});

	it('should use default system prompt when override is empty', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('product photo')
			.mockReturnValueOnce(true)
			.mockReturnValueOnce({ systemPromptOverride: '' });

		mockDeerApiRequest
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'enhanced prompt' } }],
			})
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
			});

		await executeGenerateImage.call(mockContext, 0);

		const enhanceCall = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(enhanceCall.messages[0].content).toContain('expert e-commerce product image prompt engineer');
	});

	it('should merge extraBodyFields into generation request body', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ extraBodyFields: '{"top_p": 0.9, "frequency_penalty": 0.5}' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
		});

		await executeGenerateImage.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.top_p).toBe(0.9);
		expect(callBody.frequency_penalty).toBe(0.5);
		expect(callBody.model).toBe('gemini-2.5-flash-image');
	});

	it('should ignore invalid extraBodyFields JSON', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('test')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ extraBodyFields: '{bad json' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/img.png' } }],
		});

		const result = await executeGenerateImage.call(mockContext, 0);

		expect(result[0].json.success).toBe(true);
		expect(result[0].json.operation).toBe('generate');
	});
});
