import { deerApiRequest, resetCircuitBreaker, getCircuitBreakerState, setCircuitBreakerState } from '../../../transport/request';

// Mock n8n-workflow
jest.mock('n8n-workflow', () => ({
	NodeApiError: class NodeApiError extends Error {
		httpCode: string;
		description: string;
		constructor(node: any, opts: any) {
			super(opts.message);
			this.httpCode = opts.httpCode;
			this.description = opts.description || '';
		}
	},
}));

// Mock sanitizeError
jest.mock('../../../transport/error', () => ({
	sanitizeError: jest.fn((_ctx, error, _key) => {
		const err = new Error(error.message || 'Sanitized error');
		(err as any).httpCode = String(error.statusCode || error.httpCode || 0);
		return err;
	}),
}));

describe('deerApiRequest', () => {
	let mockContext: any;
	let mockHttpRequest: jest.Mock;

	beforeEach(() => {
		jest.useFakeTimers();
		resetCircuitBreaker();
		mockHttpRequest = jest.fn();
		mockContext = {
			getCredentials: jest.fn().mockResolvedValue({
				apiKey: 'test-api-key-12345',
				baseUrl: 'https://api.deerapi.com',
			}),
			getNode: jest.fn().mockReturnValue({
				name: 'DeerAPI Plus',
				type: 'n8n-nodes-deerapi-plus.deerApiPlus',
			}),
			helpers: {
				httpRequest: mockHttpRequest,
			},
		};
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('should make a successful request', async () => {
		const mockResponse = { choices: [{ message: { content: 'test' } }] };
		mockHttpRequest.mockResolvedValue(mockResponse);

		const result = await deerApiRequest.call(mockContext, {
			method: 'POST',
			endpoint: '/v1/chat/completions',
			body: { model: 'test' } as any,
		});

		expect(result).toEqual(mockResponse);
		expect(mockHttpRequest).toHaveBeenCalledTimes(1);
		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				method: 'POST',
				url: 'https://api.deerapi.com/v1/chat/completions',
				headers: expect.objectContaining({
					Authorization: 'Bearer test-api-key-12345',
					'Content-Type': 'application/json',
				}),
			}),
		);
	});

	it('should use default base URL when not provided', async () => {
		mockContext.getCredentials.mockResolvedValue({
			apiKey: 'test-key',
			baseUrl: '',
		});
		mockHttpRequest.mockResolvedValue({ ok: true });

		await deerApiRequest.call(mockContext, {
			method: 'GET',
			endpoint: '/v1/models',
		});

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://api.deerapi.com/v1/models',
			}),
		);
	});

	it('should use credential name deerApiPlusApi', async () => {
		mockHttpRequest.mockResolvedValue({});
		await deerApiRequest.call(mockContext, { method: 'GET', endpoint: '/test' });
		expect(mockContext.getCredentials).toHaveBeenCalledWith('deerApiPlusApi');
	});

	it('should throw on 4xx errors without retry', async () => {
		mockHttpRequest.mockRejectedValue({ message: 'Bad request', statusCode: 400 });

		await expect(
			deerApiRequest.call(mockContext, { method: 'POST', endpoint: '/test', body: {} as any }),
		).rejects.toThrow();

		expect(mockHttpRequest).toHaveBeenCalledTimes(1);
	});

	it('should retry on 429 errors', async () => {
		jest.useRealTimers();
		mockHttpRequest
			.mockRejectedValueOnce({ message: 'Rate limited', statusCode: 429 })
			.mockResolvedValue({ ok: true });

		const result = await deerApiRequest.call(mockContext, {
			method: 'POST',
			endpoint: '/test',
			body: {} as any,
		});

		expect(result).toEqual({ ok: true });
		expect(mockHttpRequest).toHaveBeenCalledTimes(2);
	}, 10000);

	it('should retry on 500 errors', async () => {
		jest.useRealTimers();
		mockHttpRequest
			.mockRejectedValueOnce({ message: 'Server error', statusCode: 500 })
			.mockResolvedValue({ ok: true });

		const result = await deerApiRequest.call(mockContext, {
			method: 'POST',
			endpoint: '/test',
			body: {} as any,
		});

		expect(result).toEqual({ ok: true });
		expect(mockHttpRequest).toHaveBeenCalledTimes(2);
	}, 10000);

	it('should retry on 502 errors', async () => {
		jest.useRealTimers();
		mockHttpRequest
			.mockRejectedValueOnce({ message: 'Bad gateway', statusCode: 502 })
			.mockResolvedValue({ ok: true });

		const result = await deerApiRequest.call(mockContext, {
			method: 'POST',
			endpoint: '/test',
			body: {} as any,
		});

		expect(result).toEqual({ ok: true });
	}, 10000);

	it('should retry on 503 errors', async () => {
		jest.useRealTimers();
		mockHttpRequest
			.mockRejectedValueOnce({ message: 'Unavailable', statusCode: 503 })
			.mockResolvedValue({ ok: true });

		const result = await deerApiRequest.call(mockContext, {
			method: 'POST',
			endpoint: '/test',
			body: {} as any,
		});

		expect(result).toEqual({ ok: true });
	}, 10000);

	it('should retry on 504 errors', async () => {
		jest.useRealTimers();
		mockHttpRequest
			.mockRejectedValueOnce({ message: 'Timeout', statusCode: 504 })
			.mockResolvedValue({ ok: true });

		const result = await deerApiRequest.call(mockContext, {
			method: 'POST',
			endpoint: '/test',
			body: {} as any,
		});

		expect(result).toEqual({ ok: true });
	}, 10000);

	it('should fail after max retries', async () => {
		jest.useRealTimers();
		mockHttpRequest.mockRejectedValue({ message: 'Server error', statusCode: 500 });

		await expect(
			deerApiRequest.call(mockContext, { method: 'POST', endpoint: '/test', body: {} as any }),
		).rejects.toThrow();

		// 1 initial + 3 retries = 4
		expect(mockHttpRequest).toHaveBeenCalledTimes(4);
	}, 30000);

	it('should set custom timeout', async () => {
		mockHttpRequest.mockResolvedValue({});

		await deerApiRequest.call(mockContext, {
			method: 'POST',
			endpoint: '/test',
			timeout: 120000,
		});

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({ timeout: 120000 }),
		);
	});

	it('should use default timeout of 60000', async () => {
		mockHttpRequest.mockResolvedValue({});

		await deerApiRequest.call(mockContext, {
			method: 'POST',
			endpoint: '/test',
		});

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({ timeout: 60000 }),
		);
	});

	it('should pass query string parameters', async () => {
		mockHttpRequest.mockResolvedValue({});

		await deerApiRequest.call(mockContext, {
			method: 'GET',
			endpoint: '/test',
			qs: { page: 1 } as any,
		});

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({ qs: { page: 1 } }),
		);
	});

	it('should merge custom headers', async () => {
		mockHttpRequest.mockResolvedValue({});

		await deerApiRequest.call(mockContext, {
			method: 'POST',
			endpoint: '/test',
			headers: { 'X-Custom': 'value' } as any,
		});

		expect(mockHttpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: expect.objectContaining({
					'X-Custom': 'value',
					Authorization: 'Bearer test-api-key-12345',
				}),
			}),
		);
	});

	it('should reset circuit breaker on success', async () => {
		mockHttpRequest.mockResolvedValue({});
		await deerApiRequest.call(mockContext, { method: 'GET', endpoint: '/test' });
		const state = getCircuitBreakerState();
		expect(state.failures).toBe(0);
	});

	it('should increment circuit breaker on non-retryable failure', async () => {
		mockHttpRequest.mockRejectedValue({ message: 'Bad request', statusCode: 400 });

		try {
			await deerApiRequest.call(mockContext, { method: 'POST', endpoint: '/test', body: {} as any });
		} catch (_e) {
			// expected
		}

		const state = getCircuitBreakerState();
		expect(state.failures).toBe(1);
	});

	it('should open circuit breaker after threshold retryable failures', async () => {
		// Simulate 4 failures already happened, then one more 400 error pushes to threshold
		setCircuitBreakerState(4, 0);
		mockHttpRequest.mockRejectedValue({ message: 'Bad request', statusCode: 400 });

		try {
			await deerApiRequest.call(mockContext, { method: 'POST', endpoint: '/test', body: {} as any });
		} catch (_e) {
			// expected
		}

		const state = getCircuitBreakerState();
		expect(state.failures).toBe(5);
	});

	it('should throw circuit breaker error when open', async () => {
		// Directly set circuit breaker to open state (future timestamp)
		setCircuitBreakerState(5, Date.now() + 30000);

		await expect(
			deerApiRequest.call(mockContext, { method: 'GET', endpoint: '/test' }),
		).rejects.toThrow('Circuit breaker is open');

		// httpRequest should NOT have been called
		expect(mockHttpRequest).not.toHaveBeenCalled();
	});

	it('should reset to half-open when circuit breaker timeout expires', async () => {
		// Set circuit breaker to open state with expired timeout
		setCircuitBreakerState(5, Date.now() - 1000);
		mockHttpRequest.mockResolvedValue({ ok: true });

		const result = await deerApiRequest.call(mockContext, { method: 'GET', endpoint: '/test' });

		expect(result).toEqual({ ok: true });
		const state = getCircuitBreakerState();
		expect(state.failures).toBe(0);
	});

	it('should reset circuit breaker state', () => {
		resetCircuitBreaker();
		const state = getCircuitBreakerState();
		expect(state.failures).toBe(0);
		expect(state.openUntil).toBe(0);
	});
});
