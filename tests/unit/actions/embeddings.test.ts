import { executeEmbeddings } from '../../../nodes/DeerApi/actions/embeddings';

jest.mock('../../../transport/request', () => ({
	deerApiRequest: jest.fn(),
}));

import { deerApiRequest } from '../../../transport/request';

describe('actions/embeddings', () => {
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

	it('should generate embedding with default options', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('text-embedding-3-small')  // model
			.mockReturnValueOnce('Hello world')              // input
			.mockReturnValueOnce({});                         // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			data: [{ embedding: [0.0023, -0.0091, 0.015], index: 0 }],
			model: 'text-embedding-3-small',
			usage: { prompt_tokens: 8, total_tokens: 8 },
		});

		const result = await executeEmbeddings.call(mockContext, 0);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: true,
			operation: 'embeddings',
			model: 'text-embedding-3-small',
			embedding: [0.0023, -0.0091, 0.015],
			dimensions: 3,
			processing_time_ms: expect.any(Number),
		});
		expect(result[0].pairedItem).toEqual({ item: 0 });

		// Verify correct endpoint
		const callArgs = (deerApiRequest as jest.Mock).mock.calls[0][0];
		expect(callArgs.endpoint).toBe('/v1/embeddings');
		expect(callArgs.method).toBe('POST');
		expect(callArgs.body).toEqual({
			model: 'text-embedding-3-small',
			input: 'Hello world',
		});
	});

	it('should use custom model when __custom selected', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('__custom')                    // model
			.mockReturnValueOnce('my-custom-embedding-model')   // customModel
			.mockReturnValueOnce('Test text')                    // input
			.mockReturnValueOnce({});                             // additionalOptions

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			data: [{ embedding: [0.1, 0.2], index: 0 }],
			model: 'my-custom-embedding-model',
			usage: { prompt_tokens: 4, total_tokens: 4 },
		});

		const result = await executeEmbeddings.call(mockContext, 0);
		expect(result[0].json.model).toBe('my-custom-embedding-model');

		const callBody = (deerApiRequest as jest.Mock).mock.calls[0][0].body;
		expect(callBody.model).toBe('my-custom-embedding-model');
	});

	it('should return full response when simplify is false', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('text-embedding-3-large')
			.mockReturnValueOnce('Embed this')
			.mockReturnValueOnce({ simplify: false });

		const mockResponse = {
			data: [{ embedding: [0.5, -0.3], index: 0 }],
			model: 'text-embedding-3-large',
			usage: { prompt_tokens: 4, total_tokens: 4 },
		};
		(deerApiRequest as jest.Mock).mockResolvedValueOnce(mockResponse);

		const result = await executeEmbeddings.call(mockContext, 0);
		expect(result[0].json.usage).toEqual({ prompt_tokens: 4, total_tokens: 4 });
		expect(result[0].json.raw_response).toBeDefined();
		expect(result[0].json.raw_response).toEqual(mockResponse);
		expect(result[0].json.embedding).toEqual([0.5, -0.3]);
		expect(result[0].json.dimensions).toBe(2);
	});

	it('should handle malformed response safely', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('text-embedding-3-small')
			.mockReturnValueOnce('Hello')
			.mockReturnValueOnce({});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({ unexpected: 'format' });

		const result = await executeEmbeddings.call(mockContext, 0);
		expect(result[0].json.success).toBe(true);
		expect(result[0].json.embedding).toEqual([]);
		expect(result[0].json.dimensions).toBe(0);
	});

	it('should strip dangerous fields from extraBodyFields', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('text-embedding-3-small')
			.mockReturnValueOnce('Hello')
			.mockReturnValueOnce({
				extraBodyFields: '{"stream": true, "tools": [], "encoding_format": "float"}',
			});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			data: [{ embedding: [0.1], index: 0 }],
			usage: { prompt_tokens: 2, total_tokens: 2 },
		});

		await executeEmbeddings.call(mockContext, 0);

		const callBody = (deerApiRequest as jest.Mock).mock.calls[0][0].body;
		expect(callBody.encoding_format).toBe('float');
		expect(callBody.stream).toBeUndefined();
		expect(callBody.tools).toBeUndefined();
	});

	it('should use /v1/embeddings endpoint, not /v1/chat/completions', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('text-embedding-3-small')
			.mockReturnValueOnce('Test')
			.mockReturnValueOnce({});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({
			data: [{ embedding: [0.1], index: 0 }],
			usage: { prompt_tokens: 1, total_tokens: 1 },
		});

		await executeEmbeddings.call(mockContext, 0);

		const callArgs = (deerApiRequest as jest.Mock).mock.calls[0][0];
		expect(callArgs.endpoint).toBe('/v1/embeddings');
		expect(callArgs.endpoint).not.toBe('/v1/chat/completions');
	});
});
