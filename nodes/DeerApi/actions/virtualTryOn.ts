import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../transport/request';

export const virtualTryOnFields: INodeProperties[] = [
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
		displayOptions: { show: { resource: ['virtualTryOn'], operation: ['generate'] } },
		description: 'The model to use for virtual try-on',
	},
	{
		displayName: 'Custom Model Name',
		name: 'customModel',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['virtualTryOn'], operation: ['generate'], model: ['__custom'] } },
		description: 'Enter a custom model name',
		placeholder: 'model-name',
	},
	{
		displayName: 'Person Image URL',
		name: 'personImageUrl',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['virtualTryOn'], operation: ['generate'] } },
		description: 'URL of the person/model image',
	},
	{
		displayName: 'Garment Image URL',
		name: 'garmentImageUrl',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['virtualTryOn'], operation: ['generate'] } },
		description: 'URL of the garment/clothing image',
	},
	{
		displayName: 'Category',
		name: 'category',
		type: 'options',
		options: [
			{ name: 'Upper Body', value: 'upper' },
			{ name: 'Lower Body', value: 'lower' },
			{ name: 'Full Body', value: 'full' },
		],
		default: 'upper',
		displayOptions: { show: { resource: ['virtualTryOn'], operation: ['generate'] } },
		description: 'The garment category',
	},
	{
		displayName: 'Enhance Prompt',
		name: 'enhancePrompt',
		type: 'boolean',
		default: true,
		displayOptions: { show: { resource: ['virtualTryOn'], operation: ['generate'] } },
		description: 'Whether to enhance the try-on prompt before generation',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['virtualTryOn'], operation: ['generate'] } },
		options: [
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
				displayName: 'Enhancement Model',
				name: 'enhancementModel',
				type: 'string',
				default: 'gemini-2.5-flash',
				description: 'Model used for prompt enhancement step',
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				default: 0.7,
				typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
				description: 'Controls randomness of the enhancement',
			},
			{
				displayName: 'Max Tokens',
				name: 'maxTokens',
				type: 'number',
				default: 2048,
				typeOptions: { minValue: 1, maxValue: 16384 },
				description: 'Maximum tokens for the enhancement response',
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
				description: 'Override the default system prompt for prompt enhancement. Leave empty to use the built-in prompt.',
			},
			{
				displayName: 'Extra Body Fields (JSON)',
				name: 'extraBodyFields',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Additional JSON fields to merge into the generation request body, e.g. {"top_p": 0.9}',
				placeholder: '{"top_p": 0.9, "frequency_penalty": 0.5}',
			},
		],
	},
];

const TRYON_ENHANCE_SYSTEM = 'You are a virtual try-on prompt expert. Enhance the given try-on instruction to produce more realistic and natural-looking results. Focus on: natural garment draping, proper body proportions, realistic shadows and wrinkles, maintaining the person\'s original pose and features. Output only the enhanced prompt.';

export async function executeVirtualTryOn(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const modelParam = this.getNodeParameter('model', index) as string;
	const model = modelParam === '__custom'
		? this.getNodeParameter('customModel', index) as string
		: modelParam;
	const personImageUrl = this.getNodeParameter('personImageUrl', index) as string;
	const garmentImageUrl = this.getNodeParameter('garmentImageUrl', index) as string;
	const category = this.getNodeParameter('category', index) as string;
	const enhancePrompt = this.getNodeParameter('enhancePrompt', index) as boolean;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		outputType?: string;
		enhancementModel?: string;
		temperature?: number;
		maxTokens?: number;
		simplify?: boolean;
		systemPromptOverride?: string;
		extraBodyFields?: string;
	};

	let tryOnPrompt = `Virtual try-on: Place the garment from the second image onto the person in the first image. Category: ${category} body. Maintain the person's pose, body shape, and facial features. The garment should fit naturally with proper wrinkles and shadows.`;

	if (enhancePrompt) {
		try {
			const enhanceModel = additionalOptions.enhancementModel || 'gemini-2.5-flash';
			const temperature = additionalOptions.temperature ?? 0.7;
			const maxTokens = additionalOptions.maxTokens ?? 2048;
			const systemPrompt = additionalOptions.systemPromptOverride || TRYON_ENHANCE_SYSTEM;
			const enhanceResponse = await deerApiRequest.call(this, {
				method: 'POST',
				endpoint: '/v1/chat/completions',
				body: {
					model: enhanceModel,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: tryOnPrompt },
					],
					max_tokens: maxTokens,
					temperature,
				} as any,
			});
			const enhanced = enhanceResponse?.choices?.[0]?.message?.content;
			if (enhanced) {
				tryOnPrompt = enhanced;
			}
		} catch (_e) {
			// Enhancement failed, use original prompt
		}
	}

	const startTime = Date.now();
	const genBody: any = {
		model,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: tryOnPrompt },
					{ type: 'image_url', image_url: { url: personImageUrl } },
					{ type: 'image_url', image_url: { url: garmentImageUrl } },
				],
			},
		],
	};
	if (additionalOptions.extraBodyFields) {
		try {
			const extra = JSON.parse(additionalOptions.extraBodyFields);
			if (typeof extra === 'object' && extra !== null && !Array.isArray(extra)) {
				const { model: _m, messages: _msg, ...safeExtra } = extra;
				Object.assign(genBody, safeExtra);
			}
		} catch (_e) {
			// Invalid JSON — silently ignore
		}
	}
	const response = await deerApiRequest.call(this, {
		method: 'POST',
		endpoint: '/v1/chat/completions',
		body: genBody,
	});
	const processingTime = Date.now() - startTime;

	const rawContent = response?.choices?.[0]?.message?.content || '';
	const imageUrlMatch = rawContent.match(/https?:\/\/[^\s"'<>\]]+\.(?:png|jpg|jpeg|webp|gif)[^\s"'<>\]]*/i);
	const resultImageUrl = imageUrlMatch ? imageUrlMatch[0] : null;

	const simplify = additionalOptions.simplify !== false;

	const result: INodeExecutionData = {
		json: simplify
			? {
				success: true,
				operation: 'generate',
				model,
				person_image_url: personImageUrl,
				garment_image_url: garmentImageUrl,
				category,
				result_image_url: resultImageUrl,
				processing_time_ms: processingTime,
			}
			: {
				success: true,
				operation: 'generate',
				model,
				person_image_url: personImageUrl,
				garment_image_url: garmentImageUrl,
				category,
				result_image_url: resultImageUrl,
				raw_content: rawContent,
				processing_time_ms: processingTime,
			},
		pairedItem: { item: index },
	};

	if (additionalOptions.outputType === 'binary' && resultImageUrl) {
		const imageData = await this.helpers.httpRequest({
			method: 'GET',
			url: resultImageUrl,
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
