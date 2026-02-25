import { executeVideoCreate } from '../../../../nodes/DeerApi/actions/video/create';

jest.mock('../../../../transport/request', () => ({
	deerApiRequest: jest.fn(),
}));

import { deerApiRequest } from '../../../../transport/request';

// Speed up polling in tests
jest.useFakeTimers();

describe('actions/video/create', () => {
	let mockContext: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockContext = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'DeerAPI Plus' }),
			helpers: {
				httpRequest: jest.fn(),
				prepareBinaryData: jest.fn(),
			},
			continueOnFail: jest.fn().mockReturnValue(false),
			getCredentials: jest.fn().mockResolvedValue({
				apiKey: 'test-key',
				baseUrl: 'https://api.deerapi.com',
			}),
		};
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.useFakeTimers();
	});

	it('should submit and poll until completed', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('sora-2-all')   // model
			.mockReturnValueOnce('A cat dancing') // prompt
			.mockReturnValueOnce({});              // additionalOptions

		(deerApiRequest as jest.Mock)
			// Submit response
			.mockResolvedValueOnce({ id: 'task-123', status: 'pending' })
			// Poll 1: still processing
			.mockResolvedValueOnce({ id: 'task-123', status: 'processing' })
			// Poll 2: completed
			.mockResolvedValueOnce({
				id: 'task-123',
				status: 'completed',
				video_url: 'https://example.com/video.mp4',
			});
		// Run the execute (polling sleeps are real promises resolved by fake timers)
		const resultPromise = executeVideoCreate.call(mockContext, 0);

		// Advance past first poll interval (15s)
		await jest.advanceTimersByTimeAsync(15_000);
		// Advance past second poll interval (15s)
		await jest.advanceTimersByTimeAsync(15_000);

		const result = await resultPromise;

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: true,
			operation: 'video.create',
			id: 'task-123',
			status: 'completed',
			model: 'sora-2-all',
			video_url: 'https://example.com/video.mp4',
		});
		expect(result[0].json.processing_time_ms).toEqual(expect.any(Number));
		expect(result[0].pairedItem).toEqual({ item: 0 });

		// Submit + 2 polls = 3 calls
		expect(deerApiRequest).toHaveBeenCalledTimes(3);
		expect((deerApiRequest as jest.Mock).mock.calls[0][0]).toMatchObject({
			method: 'POST',
			endpoint: '/v1/videos/generations',
			body: { model: 'sora-2-all', prompt: 'A cat dancing', size: '720x1280' },
		});
	});

	it('should use custom model when __custom selected', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('__custom')          // model
			.mockReturnValueOnce('my-video-model')    // customModel
			.mockReturnValueOnce('A dog running')     // prompt
			.mockReturnValueOnce({});                  // additionalOptions

		(deerApiRequest as jest.Mock)
			.mockResolvedValueOnce({ id: 'task-456', status: 'completed', video_url: 'https://example.com/v.mp4' });

		const result = await executeVideoCreate.call(mockContext, 0);
		expect(result[0].json.model).toBe('my-video-model');
	});

	it('should throw on failed status', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('sora-2-all')
			.mockReturnValueOnce('Test prompt')
			.mockReturnValueOnce({});

		(deerApiRequest as jest.Mock)
			.mockResolvedValueOnce({ id: 'task-789', status: 'pending' })
			.mockResolvedValueOnce({ id: 'task-789', status: 'failed', error: { message: 'Content policy violation' } });

		const resultPromise = executeVideoCreate.call(mockContext, 0);

		// Set up the rejection expectation before advancing timers
		const expectation = expect(resultPromise).rejects.toThrow('Video generation failed: Content policy violation');
		await jest.advanceTimersByTimeAsync(15_000);
		await expectation;
	});

	it('should throw when no task ID returned', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('sora-2-all')
			.mockReturnValueOnce('Test')
			.mockReturnValueOnce({});

		(deerApiRequest as jest.Mock).mockResolvedValueOnce({});

		await expect(executeVideoCreate.call(mockContext, 0)).rejects.toThrow(
			'Video generation API did not return a task ID',
		);
	});

	it('should pass video size and storyboard options', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('veo-3-fast')
			.mockReturnValueOnce('Cinematic scene')
			.mockReturnValueOnce({
				videoSize: '1280x720',
				storyboardMode: true,
				storyboardShots: {
					shot: [
						{ shotPrompt: 'Opening shot', duration: 3 },
						{ shotPrompt: 'Close up', duration: 5 },
					],
				},
			});

		(deerApiRequest as jest.Mock)
			.mockResolvedValueOnce({ id: 'task-sb', status: 'completed', video_url: 'https://example.com/sb.mp4' });

		await executeVideoCreate.call(mockContext, 0);

		const callBody = (deerApiRequest as jest.Mock).mock.calls[0][0].body;
		expect(callBody.size).toBe('1280x720');
		expect(callBody.storyboard).toBe(true);
		expect(callBody.storyboard_shots).toEqual([
			{ prompt: 'Opening shot', duration: 3 },
			{ prompt: 'Close up', duration: 5 },
		]);
	});

	it('should return full response when simplify is false', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('sora-2-all')
			.mockReturnValueOnce('Test')
			.mockReturnValueOnce({ simplify: false });

		const rawResponse = { id: 'task-full', status: 'completed', video_url: 'https://example.com/f.mp4', extra: 'data' };
		(deerApiRequest as jest.Mock).mockResolvedValueOnce(rawResponse);

		const result = await executeVideoCreate.call(mockContext, 0);
		expect(result[0].json.raw_response).toBeDefined();
		expect(result[0].json.prompt).toBe('Test');
	});
});
