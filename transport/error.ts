import { IExecuteFunctions, NodeApiError } from 'n8n-workflow';

const ERROR_MESSAGES: Record<number, string> = {
	400: 'Bad Request: Please check your input parameters',
	401: 'Unauthorized: Invalid API Key',
	403: 'Forbidden: Your API Key does not have access to this resource',
	404: 'Not Found: The requested endpoint does not exist',
	429: 'Rate Limited: Too many requests, please try again later',
	500: 'Internal Server Error: DeerAPI service error',
	502: 'Bad Gateway: DeerAPI service temporarily unavailable',
	503: 'Service Unavailable: DeerAPI is under maintenance',
};

export function sanitizeError(
	context: IExecuteFunctions,
	error: any,
	apiKey: string,
): NodeApiError {
	let message = error.message || 'Unknown error';
	let description = error.description || '';

	if (apiKey) {
		const masked = apiKey.substring(0, 4) + '****';
		const escaped = escapeRegex(apiKey);
		message = message.replace(new RegExp(escaped, 'g'), masked);
		description = description.replace(new RegExp(escaped, 'g'), masked);
	}

	const statusCode = error.statusCode || error.httpCode || 0;
	const friendlyMessage = ERROR_MESSAGES[statusCode] || message;

	return new NodeApiError(context.getNode(), {
		message: friendlyMessage,
		description,
		httpCode: String(statusCode),
	});
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
