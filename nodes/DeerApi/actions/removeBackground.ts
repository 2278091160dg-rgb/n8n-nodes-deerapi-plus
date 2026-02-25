import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../transport/request';

export const removeBackgroundFields: INodeProperties[] = [
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		options: [
			{ name: 'Gemini 2.5 Flash Image', value: 'gemini-2.5-flash-image' },
			{ name: 'Gemini 3 Pro Preview', value: 'gemini-3-pro-preview' },
			{ name: 'Custom Model', value: '__custom' },
		],
		default: 'gemini-2.5-flash-image',
		required: true,
		displayOptions: { show: { resource: ['image'], operation: ['removeBackground'] } },
		description: 'The model to use for background removal',
	},
	{
		displayName: 'Custom Model Name',
		name: 'customModel',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['image'], operation: ['removeBackground'], model: ['__custom'] } },
		description: 'Enter a custom model name',
		placeholder: 'model-name',
	},
	{
		displayName: 'Input Method',
		name: 'inputMethod',
		type: 'options',
		options: [
			{ name: 'URL', value: 'url' },
			{ name: 'Binary Data', value: 'binary' },
		],
		default: 'url',
		displayOptions: { show: { resource: ['image'], operation: ['removeBackground'] } },
		description: 'How to provide the input image',
	},
	{
		displayName: 'Image URL',
		name: 'imageUrl',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['image'], operation: ['removeBackground'], inputMethod: ['url'] } },
		description: 'URL of the image to remove background from',
	},
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		default: 'data',
		displayOptions: { show: { resource: ['image'], operation: ['removeBackground'], inputMethod: ['binary'] } },
		description: 'Name of the binary property containing the image',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['image'], operation: ['removeBackground'] } },
		options: [
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				options: [
					{ name: 'PNG', value: 'png' },
					{ name: 'WebP', value: 'webp' },
				],
				default: 'png',
				description: 'Output image format',
			},
			{
				displayName: 'Output Type',
				name: 'outputType',
				type: 'options',
				options: [
					{ name: 'URL', value: 'url' },
					{ name: 'Binary Data', value: 'binary' },
				],
				default: 'url',
				description: 'Whether to return the image as a URL or download it as binary data',
			},
			{
				displayName: 'Background Color',
				name: 'backgroundColor',
				type: 'options',
				options: [
					{ name: 'Transparent', value: 'transparent' },
					{ name: 'White', value: 'white' },
					{ name: 'Custom', value: 'custom' },
				],
				default: 'transparent',
				description: 'Background color after removal',
			},
			{
				displayName: 'Custom Background Color',
				name: 'customBackgroundColor',
				type: 'string',
				default: '#FFFFFF',
				description: 'Custom background color (hex code)',
				placeholder: '#FF0000',
			},
			{
				displayName: 'Simplify Output',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description: 'Whether to return a simplified output with only key fields',
			},
			{
				displayName: 'System Prompt Override',
				name: 'systemPromptOverride',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
				description: 'Override the default system prompt for this operation. Leave empty to use the built-in prompt.',
			},
			{
				displayName: 'Extra Body Fields (JSON)',
				name: 'extraBodyFields',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Additional JSON fields to merge into the API request body, e.g. {"top_p": 0.9}',
				placeholder: '{"top_p": 0.9, "frequency_penalty": 0.5}',
			},
		],
	},
];

const BG_REMOVAL_BASE_PROMPT = 'Remove the background from this image.';

function buildBgRemovalPrompt(options: { backgroundColor?: string; customBackgroundColor?: string }): string {
	const bgColor = options.backgroundColor || 'transparent';
	if (bgColor === 'transparent') {
		return `${BG_REMOVAL_BASE_PROMPT} Make the background transparent. Return only the processed image.`;
	} else if (bgColor === 'white') {
		return `${BG_REMOVAL_BASE_PROMPT} Replace the background with solid white (#FFFFFF). Return only the processed image.`;
	} else if (bgColor === 'custom' && options.customBackgroundColor) {
		return `${BG_REMOVAL_BASE_PROMPT} Replace the background with solid color ${options.customBackgroundColor}. Return only the processed image.`;
	}
	return `${BG_REMOVAL_BASE_PROMPT} Make the background transparent. Return only the processed image.`;
}

export async function executeRemoveBackground(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const modelParam = this.getNodeParameter('model', index) as string;
	const model = modelParam === '__custom'
		? this.getNodeParameter('customModel', index) as string
		: modelParam;
	const inputMethod = this.getNodeParameter('inputMethod', index) as string;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		outputFormat?: string;
		outputType?: string;
		backgroundColor?: string;
		customBackgroundColor?: string;
		simplify?: boolean;
		systemPromptOverride?: string;
		extraBodyFields?: string;
	};

	let messageContent: any[];
	const bgPrompt = buildBgRemovalPrompt(additionalOptions);

	if (inputMethod === 'url') {
		const imageUrl = this.getNodeParameter('imageUrl', index) as string;
		messageContent = [
			{ type: 'text', text: bgPrompt },
			{ type: 'image_url', image_url: { url: imageUrl } },
		];
	} else {
		const binaryProperty = this.getNodeParameter('binaryProperty', index) as string;
		const binaryData = this.helpers.assertBinaryData(index, binaryProperty);
		const base64 = binaryData.data;
		const mimeType = binaryData.mimeType || 'image/png';
		messageContent = [
			{ type: 'text', text: bgPrompt },
			{ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
		];
	}

	const startTime = Date.now();
	const body: any = {
		model,
		messages: [
			{ role: 'user', content: messageContent },
		],
	};
	if (additionalOptions.systemPromptOverride) {
		body.messages.unshift({ role: 'system', content: additionalOptions.systemPromptOverride });
	}
	if (additionalOptions.extraBodyFields) {
		try {
			const extra = JSON.parse(additionalOptions.extraBodyFields);
			if (typeof extra === 'object' && extra !== null && !Array.isArray(extra)) {
				const { model: _m, messages: _msg, ...safeExtra } = extra;
				Object.assign(body, safeExtra);
			}
		} catch (_e) {
			// Invalid JSON — silently ignore
		}
	}
	const response = await deerApiRequest.call(this, {
		method: 'POST',
		endpoint: '/v1/chat/completions',
		body,
	});
	const processingTime = Date.now() - startTime;

	const rawContent = response?.choices?.[0]?.message?.content || '';
	const imageUrlMatch = rawContent.match(/https?:\/\/[^\s"'<>\]]+\.(?:png|jpg|jpeg|webp|gif)[^\s"'<>\]]*/i);
	const imageUrl = imageUrlMatch ? imageUrlMatch[0] : null;

	const simplify = additionalOptions.simplify !== false;

	const result: INodeExecutionData = {
		json: simplify
			? {
				success: true,
				operation: 'removeBackground',
				model,
				input_method: inputMethod,
				image_url: imageUrl,
				processing_time_ms: processingTime,
			}
			: {
				success: true,
				operation: 'removeBackground',
				model,
				input_method: inputMethod,
				image_url: imageUrl,
				raw_content: rawContent,
				processing_time_ms: processingTime,
			},
		pairedItem: { item: index },
	};

	if (additionalOptions.outputType === 'binary' && imageUrl) {
		const imageData = await this.helpers.httpRequest({
			method: 'GET',
			url: imageUrl,
			encoding: 'arraybuffer',
		});
		const binary = await this.helpers.prepareBinaryData(
			Buffer.from(imageData as ArrayBuffer),
			'output.png',
			'image/png',
		);
		result.binary = { data: binary };
	}

	return [result];
}
