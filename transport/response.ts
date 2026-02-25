import { IExecuteFunctions } from 'n8n-workflow';

export interface DeerApiResponse {
	success: boolean;
	data?: any;
	error?: { code: string; message: string };
	taskId?: string;
}

export async function parseResponse(
	context: IExecuteFunctions,
	response: any,
	_itemIndex: number,
): Promise<any> {
	// If response contains an image URL, download and convert to Binary Data
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

	// If response contains base64 image
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

	// Plain JSON response
	return { json: response.data || response };
}
