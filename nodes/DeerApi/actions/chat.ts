import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../transport/request';
import { safeExtractChatContent } from '../../../transport/response';
import { buildRequestForModel } from '../../../transport/endpoint-map';
import { resolveModelFromMode } from '../../../shared/constants';

export const chatFields: INodeProperties[] = [
	{
		displayName: 'Mode',
		name: 'mode',
		type: 'options',
		options: [
			{ name: 'Recommended', value: 'recommended', description: 'Best balance of speed and quality' },
			{ name: 'Fast', value: 'fast', description: 'Fastest response time, lower cost' },
			{ name: 'High Quality', value: 'quality', description: 'Best output quality, higher cost' },
			{ name: 'Budget', value: 'budget', description: 'Lowest cost models' },
			{ name: 'Custom', value: 'custom', description: 'Choose a specific model' },
		],
		default: 'recommended',
		displayOptions: { show: { resource: ['chat'], operation: ['generate'] } },
		description: 'Select a mode to auto-pick the best model, or choose Custom to select manually',
	},
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTextModels' },
		default: 'gemini-2.5-flash',
		required: true,
		displayOptions: { show: { resource: ['chat'], operation: ['generate'], mode: ['custom'] } },
		description: 'The model to use for text generation. Loaded dynamically from DeerAPI.',
	},
	{
		displayName: 'Custom Model Name',
		name: 'customModel',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['chat'], operation: ['generate'], model: ['__custom'] } },
		description: 'Enter a custom model ID',
		placeholder: 'model-name',
	},
	{
		displayName: 'User Prompt',
		name: 'userPrompt',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		displayOptions: { show: { resource: ['chat'], operation: ['generate'] } },
		description: 'The message to send to the model',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['chat'], operation: ['generate'] } },
		options: [
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				typeOptions: { rows: 3 },
				default: 'You are a helpful assistant.',
				description: 'System prompt to set the model behavior',
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				default: 0.7,
				typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
				description: 'Controls randomness (0 = deterministic, 2 = creative)',
			},
			{
				displayName: 'Max Tokens',
				name: 'maxTokens',
				type: 'number',
				default: 2048,
				typeOptions: { minValue: 1, maxValue: 16384 },
				description: 'Maximum tokens in the response',
			},
			{
				displayName: 'Simplify Output',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description: 'Whether to return a simplified output with only key fields',
			},
			{
				displayName: 'Extra Body Fields (JSON)',
				name: 'extraBodyFields',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Additional JSON fields to merge into the request body',
				placeholder: '{"top_p": 0.9, "frequency_penalty": 0.5}',
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				description: 'Comma-separated binary property names containing images to include in the message (Vision)',
			},
			{
				displayName: 'Binary Source Mode',
				name: 'binarySourceMode',
				type: 'options',
				options: [
					{ name: 'Current Item', value: 'current', description: 'Read binary from the current input item' },
					{ name: 'Specified Node', value: 'specified', description: 'Read binary from a specific upstream node' },
				],
				default: 'current',
				description: 'Where to read binary image data from',
			},
			{
				displayName: 'Source Node Names',
				name: 'sourceNodeNames',
				type: 'string',
				default: '',
				displayOptions: { show: { '/additionalOptions.binarySourceMode': ['specified'] } },
				description: 'Comma-separated names of upstream nodes to read binary data from',
			},
		],
	},
];

export async function executeChat(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const mode = this.getNodeParameter('mode', index, 'recommended') as string;
	let model: string;

	if (mode === 'custom') {
		const modelParam = this.getNodeParameter('model', index) as string;
		model = modelParam === '__custom'
			? this.getNodeParameter('customModel', index) as string
			: modelParam;
	} else {
		model = resolveModelFromMode(mode, 'text') || 'gemini-2.5-flash';
	}
	const userPrompt = this.getNodeParameter('userPrompt', index) as string;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		systemPrompt?: string;
		temperature?: number;
		maxTokens?: number;
		simplify?: boolean;
		extraBodyFields?: string;
		binaryPropertyName?: string;
		binarySourceMode?: string;
		sourceNodeNames?: string;
	};

	const systemPrompt = additionalOptions.systemPrompt || 'You are a helpful assistant.';
	const temperature = additionalOptions.temperature ?? 0.7;
	const maxTokens = additionalOptions.maxTokens ?? 2048;

	// Build user message content — text only or multimodal (text + images)
	let userContent: any = userPrompt;
	const binaryPropNames = (additionalOptions.binaryPropertyName || '').split(',').map((s) => s.trim()).filter(Boolean);

	if (binaryPropNames.length > 0) {
		const imageParts: Array<{ type: string; image_url: { url: string } }> = [];

		for (const propName of binaryPropNames) {
			try {
				const binaryData = this.helpers.assertBinaryData(index, propName);
				const base64 = binaryData.data;
				const mimeType = binaryData.mimeType || 'image/png';
				imageParts.push({
					type: 'image_url',
					image_url: { url: `data:${mimeType};base64,${base64}` },
				});
			} catch (_e) {
				// Binary property not found — skip silently
			}
		}

		if (imageParts.length > 0) {
			userContent = [
				{ type: 'text', text: userPrompt },
				...imageParts,
			];
		}
	}

	const startTime = Date.now();
	const { endpoint, body } = buildRequestForModel({
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userContent },
		],
		max_tokens: maxTokens,
		temperature,
	});

	if (additionalOptions.extraBodyFields) {
		try {
			const extra = JSON.parse(additionalOptions.extraBodyFields);
			if (typeof extra === 'object' && extra !== null && !Array.isArray(extra)) {
				const { model: _m, messages: _msg, stream: _s, tools: _t, tool_choice: _tc, function_call: _fc, functions: _fn, ...safeExtra } = extra;
				Object.assign(body, safeExtra);
			}
		} catch (_e) {
			// Invalid JSON — silently ignore
		}
	}

	const response = await deerApiRequest.call(this, {
		method: 'POST',
		endpoint,
		body,
	});
	const processingTime = Date.now() - startTime;

	const { content: rawContent, finishReason, usage } = safeExtractChatContent(response);
	const simplify = additionalOptions.simplify !== false;

	return [
		{
			json: simplify
				? {
					success: true,
					operation: 'chat',
					model,
					content: rawContent,
					finish_reason: finishReason,
					processing_time_ms: processingTime,
				}
				: {
					success: true,
					operation: 'chat',
					model,
					content: rawContent,
					finish_reason: finishReason,
					usage,
					processing_time_ms: processingTime,
					raw_response: response,
				},
			pairedItem: { item: index },
		},
	];
}
