import { parseResponse, safeExtractChatContent, extractImageUrl } from '../../../transport/response';

describe('parseResponse', () => {
	const mockContext = {
		helpers: {
			httpRequest: jest.fn(),
			prepareBinaryData: jest.fn(),
		},
	} as any;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should handle plain JSON response', async () => {
		const response = { data: { result: 'test', status: 'ok' } };
		const result = await parseResponse(mockContext, response, 0);
		expect(result).toEqual({ json: { result: 'test', status: 'ok' } });
	});

	it('should handle response without data field', async () => {
		const response = { result: 'test' };
		const result = await parseResponse(mockContext, response, 0);
		expect(result).toEqual({ json: { result: 'test' } });
	});

	it('should download and convert image URL to binary', async () => {
		const imageBuffer = Buffer.from('fake-image-data');
		mockContext.helpers.httpRequest.mockResolvedValue(imageBuffer);
		mockContext.helpers.prepareBinaryData.mockResolvedValue({
			data: 'base64data',
			mimeType: 'image/png',
			fileName: 'output.png',
		});

		const response = { data: { image_url: 'https://example.com/image.png', taskId: '123' } };
		const result = await parseResponse(mockContext, response, 0);

		expect(mockContext.helpers.httpRequest).toHaveBeenCalledWith({
			method: 'GET',
			url: 'https://example.com/image.png',
			encoding: 'arraybuffer',
		});
		expect(result.json).toEqual(response.data);
		expect(result.binary).toBeDefined();
		expect(result.binary.data).toBeDefined();
	});

	it('should convert base64 image to binary', async () => {
		mockContext.helpers.prepareBinaryData.mockResolvedValue({
			data: 'base64data',
			mimeType: 'image/png',
			fileName: 'output.png',
		});

		const response = { data: { image_base64: 'aGVsbG8=', taskId: '456' } };
		const result = await parseResponse(mockContext, response, 0);

		expect(mockContext.helpers.prepareBinaryData).toHaveBeenCalledWith(
			expect.any(Buffer),
			'output.png',
			'image/png',
		);
		expect(result.json).toEqual(response.data);
		expect(result.binary).toBeDefined();
	});

	it('should prioritize image_url over image_base64', async () => {
		const imageBuffer = Buffer.from('fake-image-data');
		mockContext.helpers.httpRequest.mockResolvedValue(imageBuffer);
		mockContext.helpers.prepareBinaryData.mockResolvedValue({
			data: 'base64data',
			mimeType: 'image/png',
			fileName: 'output.png',
		});

		const response = {
			data: {
				image_url: 'https://example.com/image.png',
				image_base64: 'aGVsbG8=',
			},
		};
		const result = await parseResponse(mockContext, response, 0);

		expect(mockContext.helpers.httpRequest).toHaveBeenCalled();
		expect(result.binary).toBeDefined();
	});

	it('should handle null data', async () => {
		const response = { data: null };
		const result = await parseResponse(mockContext, response, 0);
		expect(result).toEqual({ json: { data: null } });
	});

	it('should handle empty response', async () => {
		const response = {};
		const result = await parseResponse(mockContext, response, 0);
		expect(result).toEqual({ json: {} });
	});
});

describe('safeExtractChatContent', () => {
	it('should extract content from valid response', () => {
		const response = {
			choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }],
			usage: { prompt_tokens: 5, total_tokens: 8 },
		};
		const result = safeExtractChatContent(response);
		expect(result.content).toBe('Hello');
		expect(result.finishReason).toBe('stop');
		expect(result.usage).toEqual({ prompt_tokens: 5, total_tokens: 8 });
	});

	it('should handle null response', () => {
		expect(safeExtractChatContent(null)).toEqual({ content: '', finishReason: '', usage: {} });
	});

	it('should handle undefined response', () => {
		expect(safeExtractChatContent(undefined)).toEqual({ content: '', finishReason: '', usage: {} });
	});

	it('should handle empty choices array', () => {
		expect(safeExtractChatContent({ choices: [] })).toEqual({ content: '', finishReason: '', usage: {} });
	});

	it('should handle missing message', () => {
		expect(safeExtractChatContent({ choices: [{}] })).toEqual({ content: '', finishReason: '', usage: {} });
	});

	it('should handle non-string content', () => {
		const response = { choices: [{ message: { content: 123 } }] };
		expect(safeExtractChatContent(response).content).toBe('');
	});

	it('should handle missing usage', () => {
		const response = { choices: [{ message: { content: 'Hi' }, finish_reason: 'stop' }] };
		expect(safeExtractChatContent(response).usage).toEqual({});
	});
});

describe('extractImageUrl', () => {
	it('should extract plain URL', () => {
		const content = 'Here is your image: https://example.com/image.png';
		expect(extractImageUrl(content)).toBe('https://example.com/image.png');
	});

	it('should extract URL with query params', () => {
		const content = 'https://cdn.example.com/img.jpg?token=abc&size=large';
		expect(extractImageUrl(content)).toBe('https://cdn.example.com/img.jpg?token=abc&size=large');
	});

	it('should extract URL from Markdown without capturing )', () => {
		const content = '![alt](https://example.com/photo.png)';
		expect(extractImageUrl(content)).toBe('https://example.com/photo.png');
	});

	it('should extract URL from Markdown with ] without capturing it', () => {
		const content = '[link](https://example.com/photo.webp)';
		expect(extractImageUrl(content)).toBe('https://example.com/photo.webp');
	});

	it('should return null when no image URL found', () => {
		expect(extractImageUrl('No image here')).toBeNull();
		expect(extractImageUrl('')).toBeNull();
	});

	it('should handle multiple extensions', () => {
		expect(extractImageUrl('https://x.com/a.jpeg')).toBe('https://x.com/a.jpeg');
		expect(extractImageUrl('https://x.com/a.webp')).toBe('https://x.com/a.webp');
		expect(extractImageUrl('https://x.com/a.gif')).toBe('https://x.com/a.gif');
	});
});
