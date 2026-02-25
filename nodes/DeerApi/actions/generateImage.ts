import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../transport/request';

export const generateImageFields: INodeProperties[] = [
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getImageModels' },
		default: 'gemini-2.5-flash-image',
		required: true,
		displayOptions: { show: { resource: ['image'], operation: ['generate'] } },
		description: 'The model to use for image generation. Loaded dynamically from DeerAPI.',
	},
	{
		displayName: 'Custom Model Name',
		name: 'customModel',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['image'], operation: ['generate'], model: ['__custom'] } },
		description: 'Enter a custom model name (e.g., a new DeerAPI-supported model)',
		placeholder: 'model-name',
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		displayOptions: { show: { resource: ['image'], operation: ['generate'] } },
		description: 'Describe the image you want to generate',
	},
	{
		displayName: 'Enhance Prompt',
		name: 'enhancePrompt',
		type: 'boolean',
		default: true,
		displayOptions: { show: { resource: ['image'], operation: ['generate'] } },
		description: 'Whether to automatically enhance the prompt before generation',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['image'], operation: ['generate'] } },
		options: [
			{
				displayName: 'Negative Prompt',
				name: 'negativePrompt',
				type: 'string',
				default: '',
				description: 'What the image should not contain',
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
				displayName: 'Width',
				name: 'width',
				type: 'number',
				default: 1024,
				typeOptions: { minValue: 256, maxValue: 2048 },
				description: 'Image width in pixels',
			},
			{
				displayName: 'Height',
				name: 'height',
				type: 'number',
				default: 1024,
				typeOptions: { minValue: 256, maxValue: 2048 },
				description: 'Image height in pixels',
			},
			{
				displayName: 'Number of Images',
				name: 'numberOfImages',
				type: 'number',
				default: 1,
				typeOptions: { minValue: 1, maxValue: 4 },
				description: 'Number of images to generate',
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
				description: 'Controls randomness of the enhancement (0 = deterministic, 2 = creative)',
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
				description: 'Additional JSON fields to merge into the image generation request body, e.g. {"top_p": 0.9}',
				placeholder: '{"top_p": 0.9, "frequency_penalty": 0.5}',
			},
		],
	},
];

const ENHANCE_SYSTEM_PROMPT = 'You are an expert e-commerce product image prompt engineer. Enhance the user\'s prompt to be more detailed and specific for AI image generation. Focus on: lighting, composition, background, product placement, and commercial appeal. Output only the enhanced prompt, nothing else.';

export async function executeGenerateImage(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const modelParam = this.getNodeParameter('model', index) as string;
	const model = modelParam === '__custom'
		? this.getNodeParameter('customModel', index) as string
		: modelParam;
	const prompt = this.getNodeParameter('prompt', index) as string;
	const enhancePrompt = this.getNodeParameter('enhancePrompt', index) as boolean;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		negativePrompt?: string;
		outputType?: string;
		width?: number;
		height?: number;
		numberOfImages?: number;
		enhancementModel?: string;
		temperature?: number;
		maxTokens?: number;
		simplify?: boolean;
		systemPromptOverride?: string;
		extraBodyFields?: string;
	};

	let finalPrompt = prompt;

	if (enhancePrompt) {
		try {
			const enhanceModel = additionalOptions.enhancementModel || 'gemini-2.5-flash';
			const temperature = additionalOptions.temperature ?? 0.7;
			const maxTokens = additionalOptions.maxTokens ?? 2048;
			const systemPrompt = additionalOptions.systemPromptOverride || ENHANCE_SYSTEM_PROMPT;
			const enhanceResponse = await deerApiRequest.call(this, {
				method: 'POST',
				endpoint: '/v1/chat/completions',
				body: {
					model: enhanceModel,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: prompt },
					],
					max_tokens: maxTokens,
					temperature,
				} as any,
			});
			const enhanced = enhanceResponse?.choices?.[0]?.message?.content;
			if (enhanced) {
				finalPrompt = enhanced;
			}
		} catch (_e) {
			// Enhancement failed, use original prompt
		}
	}

	const startTime = Date.now();
	const genBody: any = {
		model,
		messages: [
			{ role: 'user', content: `Generate an image: ${finalPrompt}` },
		],
	};
	if (additionalOptions.extraBodyFields) {
		try {
			const extra = JSON.parse(additionalOptions.extraBodyFields);
			if (typeof extra === 'object' && extra !== null && !Array.isArray(extra)) {
				const { model: _m, messages: _msg, stream: _s, tools: _t, tool_choice: _tc, function_call: _fc, functions: _fn, ...safeExtra } = extra;
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
	const imageUrlMatch = rawContent.match(/https?:\/\/[^\s"'<>\]\)]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s"'<>\]\)]*)?/i);
	const imageUrl = imageUrlMatch ? imageUrlMatch[0] : null;

	const simplify = additionalOptions.simplify !== false;

	const jsonData: Record<string, any> = simplify
		? {
			success: true,
			operation: 'generate',
			model,
			original_prompt: prompt,
			...(enhancePrompt && finalPrompt !== prompt ? { enhanced_prompt: finalPrompt } : {}),
			image_url: imageUrl,
			processing_time_ms: processingTime,
		}
		: {
			success: true,
			operation: 'generate',
			model,
			original_prompt: prompt,
			...(enhancePrompt && finalPrompt !== prompt ? { enhanced_prompt: finalPrompt } : {}),
			image_url: imageUrl,
			raw_content: rawContent,
			processing_time_ms: processingTime,
		};

	const result: INodeExecutionData = {
		json: jsonData,
		pairedItem: { item: index },
	};

	// Download image as binary if requested
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
