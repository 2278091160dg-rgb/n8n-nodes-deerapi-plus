import { sanitizeError } from '../../../transport/error';

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

describe('sanitizeError', () => {
	const mockContext = {
		getNode: () => ({ name: 'DeerAPI Plus', type: 'n8n-nodes-deerapi-plus.deerApiPlus' }),
	} as any;

	it('should mask API key in error message', () => {
		const apiKey = 'sk-test-1234567890abcdef';
		const error = {
			message: `Request failed with key sk-test-1234567890abcdef`,
			statusCode: 999,
		};

		const result = sanitizeError(mockContext, error, apiKey);
		expect(result.message).not.toContain(apiKey);
		expect(result.message).toContain('sk-t****');
	});

	it('should mask API key in description', () => {
		const apiKey = 'sk-abcdef123456';
		const error = {
			message: 'Error',
			description: `Auth failed for sk-abcdef123456`,
			statusCode: 401,
		};

		const result = sanitizeError(mockContext, error, apiKey);
		expect(result.description).not.toContain(apiKey);
		expect(result.description).toContain('sk-a****');
	});

	it('should return friendly message for 400', () => {
		const result = sanitizeError(mockContext, { message: 'err', statusCode: 400 }, 'key');
		expect(result.message).toBe('Bad Request: Please check your input parameters');
	});

	it('should return friendly message for 401', () => {
		const result = sanitizeError(mockContext, { message: 'err', statusCode: 401 }, 'key');
		expect(result.message).toBe('Unauthorized: Invalid API Key');
	});

	it('should return friendly message for 403', () => {
		const result = sanitizeError(mockContext, { message: 'err', statusCode: 403 }, 'key');
		expect(result.message).toBe('Forbidden: Your API Key does not have access to this resource');
	});

	it('should return friendly message for 404', () => {
		const result = sanitizeError(mockContext, { message: 'err', statusCode: 404 }, 'key');
		expect(result.message).toBe('Not Found: The requested endpoint does not exist');
	});

	it('should return friendly message for 429', () => {
		const result = sanitizeError(mockContext, { message: 'err', statusCode: 429 }, 'key');
		expect(result.message).toBe('Rate Limited: Too many requests, please try again later');
	});

	it('should return friendly message for 500', () => {
		const result = sanitizeError(mockContext, { message: 'err', statusCode: 500 }, 'key');
		expect(result.message).toBe('Internal Server Error: DeerAPI service error');
	});

	it('should return friendly message for 502', () => {
		const result = sanitizeError(mockContext, { message: 'err', statusCode: 502 }, 'key');
		expect(result.message).toBe('Bad Gateway: DeerAPI service temporarily unavailable');
	});

	it('should return friendly message for 503', () => {
		const result = sanitizeError(mockContext, { message: 'err', statusCode: 503 }, 'key');
		expect(result.message).toBe('Service Unavailable: DeerAPI is under maintenance');
	});

	it('should use original message for unknown status codes', () => {
		const result = sanitizeError(mockContext, { message: 'Custom error', statusCode: 418 }, 'key');
		expect(result.message).toBe('Custom error');
	});

	it('should handle missing message', () => {
		const result = sanitizeError(mockContext, { statusCode: 500 }, 'key');
		expect(result.message).toBe('Internal Server Error: DeerAPI service error');
	});

	it('should handle httpCode fallback', () => {
		const result = sanitizeError(mockContext, { message: 'err', httpCode: 429 }, 'key');
		expect(result.message).toBe('Rate Limited: Too many requests, please try again later');
	});

	it('should handle empty API key', () => {
		const result = sanitizeError(mockContext, { message: 'Error occurred', statusCode: 500 }, '');
		expect(result.message).toBe('Internal Server Error: DeerAPI service error');
	});

	it('should handle special regex characters in API key', () => {
		const apiKey = 'sk-test+key.special$chars';
		const error = {
			message: `Failed with ${apiKey}`,
			statusCode: 500,
		};
		const result = sanitizeError(mockContext, error, apiKey);
		expect(result.message).not.toContain(apiKey);
	});
});
