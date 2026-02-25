import { IExecuteFunctions } from 'n8n-workflow';

export interface DeerApiResponse {
	success: boolean;
	data?: any;
	error?: { code: string; message: string };
	taskId?: string;
}

/**
 * Safely extract content from an OpenAI-format chat completion response.
 * Handles malformed, empty, or unexpected response shapes without throwing.
 */
export function safeExtractChatContent(response: any): {
	content: string;
	finishReason: string;
	usage: Record<string, any>;
} {
	try {
		const choices = response?.choices;
		if (!Array.isArray(choices) || choices.length === 0) {
			return { content: '', finishReason: '', usage: {} };
		}
		const message = choices[0]?.message;
		const content = typeof message?.content === 'string' ? message.content : '';
		const finishReason = typeof choices[0]?.finish_reason === 'string' ? choices[0].finish_reason : '';
		const usage = (typeof response?.usage === 'object' && response.usage !== null) ? response.usage : {};
		return { content, finishReason, usage };
	} catch (_e) {
		return { content: '', finishReason: '', usage: {} };
	}
}

/**
 * Extract image URL from AI response content using regex.
 * Handles Markdown-wrapped URLs and query parameters.
 */
export function extractImageUrl(content: string): string | null {
	const match = content.match(/https?:\/\/[^\s"'<>\]\)]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s"'<>\]\)]*)?/i);
	return match ? match[0] : null;
}

export async function parseResponse(
	context: IExecuteFunctions,
	response: any,
	_itemIndex: number,
): Promise<any> {
	if (response.data?.image_url) {
		const imageData = await context.helpers.httpRequest({
			method: 'GET',
			url: response.data.image_url,
			encoding: 'arraybuffer',
		});
		const binary = await context.helpers.prepareBinaryData(
			Buffer.from(imageData as ArrayBuffer),
			'output.png',
			'image/png',
		);
		return {
			json: response.data,
			binary: { data: binary },
		};
	}

	if (response.data?.image_base64) {
		const buffer = Buffer.from(response.data.image_base64, 'base64');
		const binary = await context.helpers.prepareBinaryData(
			buffer,
			'output.png',
			'image/png',
		);
		return {
			json: response.data,
			binary: { data: binary },
		};
	}

	return { json: response.data || response };
}
