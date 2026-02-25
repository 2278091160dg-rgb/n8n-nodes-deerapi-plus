import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../transport/request';
import { safeExtractChatContent } from '../../../transport/response';

export const chatFields: INodeProperties[] = [
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTextModels' },
		default: 'gemini-2.5-flash',
		required: true,
		displayOptions: { show: { resource: ['chat'], operation: ['generate'] } },
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
		],
	},
];

export async function executeChat(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const modelParam = this.getNodeParameter('model', index) as string;
	const model = modelParam === '__custom'
		? this.getNodeParameter('customModel', index) as string
		: modelParam;
	const userPrompt = this.getNodeParameter('userPrompt', index) as string;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		systemPrompt?: string;
		temperature?: number;
		maxTokens?: number;
		simplify?: boolean;
		extraBodyFields?: string;
	};

	const systemPrompt = additionalOptions.systemPrompt || 'You are a helpful assistant.';
	const temperature = additionalOptions.temperature ?? 0.7;
	const maxTokens = additionalOptions.maxTokens ?? 2048;

	const startTime = Date.now();
	const body: any = {
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		],
		max_tokens: maxTokens,
		temperature,
	};

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
		endpoint: '/v1/chat/completions',
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
