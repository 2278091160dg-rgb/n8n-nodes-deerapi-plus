import { parseResponse } from '../../../transport/response';

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
