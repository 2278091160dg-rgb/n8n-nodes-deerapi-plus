import { executeVirtualTryOn } from '../../../nodes/DeerApi/actions/virtualTryOn';

jest.mock('../../../transport/request', () => ({
	deerApiRequest: jest.fn(),
}));

import { deerApiRequest } from '../../../transport/request';
const mockDeerApiRequest = deerApiRequest as jest.MockedFunction<typeof deerApiRequest>;

describe('executeVirtualTryOn', () => {
	let mockContext: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockContext = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'DeerAPI Plus' }),
		};
	});

	it('should generate virtual try-on with enhanced prompt', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image') // model
			.mockReturnValueOnce('https://example.com/person.jpg') // personImageUrl
			.mockReturnValueOnce('https://example.com/garment.jpg') // garmentImageUrl
			.mockReturnValueOnce('upper') // category
			.mockReturnValueOnce(true) // enhancePrompt
			.mockReturnValueOnce({}); // additionalOptions

		mockDeerApiRequest
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'Enhanced try-on prompt with natural draping' } }],
			})
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'Result: https://cdn.deerapi.com/tryon.png' } }],
			});

		const result = await executeVirtualTryOn.call(mockContext, 0);

		expect(result).toHaveLength(1);
		expect(result[0].json.success).toBe(true);
		expect(result[0].json.operation).toBe('generate');
		expect(result[0].json.model).toBe('gemini-2.5-flash-image');
		expect(result[0].json.person_image_url).toBe('https://example.com/person.jpg');
		expect(result[0].json.garment_image_url).toBe('https://example.com/garment.jpg');
		expect(result[0].json.category).toBe('upper');
		expect(result[0].json.result_image_url).toBe('https://cdn.deerapi.com/tryon.png');
		expect(result[0].json.processing_time_ms).toBeGreaterThanOrEqual(0);
		expect(result[0].pairedItem).toEqual({ item: 0 });
	});

	it('should generate without enhancement', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-pro-preview')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('full')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
		});

		const result = await executeVirtualTryOn.call(mockContext, 0);

		expect(result[0].json.model).toBe('gemini-3-pro-preview');
		expect(result[0].json.category).toBe('full');
		expect(mockDeerApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should fallback when enhancement fails', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('lower')
			.mockReturnValueOnce(true)
			.mockReturnValueOnce({});

		mockDeerApiRequest
			.mockRejectedValueOnce(new Error('Enhancement failed'))
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
			});

		const result = await executeVirtualTryOn.call(mockContext, 0);

		expect(result[0].json.result_image_url).toBe('https://cdn.deerapi.com/tryon.png');
	});

	it('should handle no image URL in response', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ simplify: false });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'Could not process the try-on' } }],
		});

		const result = await executeVirtualTryOn.call(mockContext, 0);

		expect(result[0].json.result_image_url).toBeNull();
		expect(result[0].json.raw_content).toBe('Could not process the try-on');
	});

	it('should send both images in message content', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
		});

		await executeVirtualTryOn.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		const content = callBody.messages[0].content;
		expect(content).toHaveLength(3);
		expect(content[0].type).toBe('text');
		expect(content[1].type).toBe('image_url');
		expect(content[1].image_url.url).toBe('https://example.com/person.jpg');
		expect(content[2].type).toBe('image_url');
		expect(content[2].image_url.url).toBe('https://example.com/garment.jpg');
	});

	it('should include category in prompt', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('lower')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
		});

		await executeVirtualTryOn.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		const textContent = callBody.messages[0].content[0].text;
		expect(textContent).toContain('lower body');
	});

	it('should use correct pairedItem index', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
		});

		const result = await executeVirtualTryOn.call(mockContext, 7);

		expect(result[0].pairedItem).toEqual({ item: 7 });
	});

	it('should call enhance with gemini-2.5-flash model', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-3-pro-preview')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(true)
			.mockReturnValueOnce({});

		mockDeerApiRequest
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'enhanced' } }],
			})
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
			});

		await executeVirtualTryOn.call(mockContext, 0);

		const enhanceCall = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(enhanceCall.model).toBe('gemini-2.5-flash');
	});

	it('should use custom model when selected', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('__custom') // model
			.mockReturnValueOnce('my-custom-tryon-model') // customModel
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({});

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
		});

		const result = await executeVirtualTryOn.call(mockContext, 0);

		expect(result[0].json.model).toBe('my-custom-tryon-model');
	});

	it('should download binary data when outputType is binary', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ outputType: 'binary' });

		mockContext.helpers = {
			...mockContext.helpers,
			httpRequest: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
			prepareBinaryData: jest.fn().mockResolvedValue({
				data: 'base64',
				mimeType: 'image/png',
				fileName: 'output.png',
			}),
		};

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
		});

		const result = await executeVirtualTryOn.call(mockContext, 0);

		expect(result[0].binary).toBeDefined();
		expect(result[0].binary!.data).toBeDefined();
	});

	it('should use systemPromptOverride when provided', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(true)
			.mockReturnValueOnce({ systemPromptOverride: 'Custom tryon system prompt.' });

		mockDeerApiRequest
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'enhanced' } }],
			})
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
			});

		await executeVirtualTryOn.call(mockContext, 0);

		const enhanceCall = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(enhanceCall.messages[0].content).toBe('Custom tryon system prompt.');
	});

	it('should use default system prompt when override is empty', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(true)
			.mockReturnValueOnce({ systemPromptOverride: '' });

		mockDeerApiRequest
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'enhanced' } }],
			})
			.mockResolvedValueOnce({
				choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
			});

		await executeVirtualTryOn.call(mockContext, 0);

		const enhanceCall = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(enhanceCall.messages[0].content).toContain('virtual try-on prompt expert');
	});

	it('should merge extraBodyFields into generation request body', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ extraBodyFields: '{"top_p": 0.8}' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
		});

		await executeVirtualTryOn.call(mockContext, 0);

		const callBody = (mockDeerApiRequest.mock.calls[0][0] as any).body;
		expect(callBody.top_p).toBe(0.8);
		expect(callBody.model).toBe('gemini-2.5-flash-image');
	});

	it('should ignore invalid extraBodyFields JSON', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('gemini-2.5-flash-image')
			.mockReturnValueOnce('https://example.com/person.jpg')
			.mockReturnValueOnce('https://example.com/garment.jpg')
			.mockReturnValueOnce('upper')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce({ extraBodyFields: 'bad' });

		mockDeerApiRequest.mockResolvedValueOnce({
			choices: [{ message: { content: 'https://cdn.deerapi.com/tryon.png' } }],
		});

		const result = await executeVirtualTryOn.call(mockContext, 0);

		expect(result[0].json.success).toBe(true);
		expect(result[0].json.operation).toBe('generate');
	});
});
