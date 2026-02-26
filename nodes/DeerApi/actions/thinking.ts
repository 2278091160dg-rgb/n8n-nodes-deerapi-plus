import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../transport/request';
import { safeExtractChatContent } from '../../../transport/response';
import { buildRequestForModel } from '../../../transport/endpoint-map';

export const thinkingFields: INodeProperties[] = [
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getThinkingModels' },
		default: 'gemini-3-flash-preview-thinking',
		required: true,
		displayOptions: { show: { resource: ['thinking'], operation: ['generate'] } },
		description: 'The thinking model to use. Loaded dynamically from DeerAPI.',
	},
	{
		displayName: 'Custom Model Name',
		name: 'customModel',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['thinking'], operation: ['generate'], model: ['__custom'] } },
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
		displayOptions: { show: { resource: ['thinking'], operation: ['generate'] } },
		description: 'The problem to think about',
	},
	{
		displayName: 'Budget Tokens',
		name: 'budgetTokens',
		type: 'number',
		default: 5000,
		typeOptions: { minValue: 1, maxValue: 10000 },
		displayOptions: { show: { resource: ['thinking'], operation: ['generate'] } },
		description: 'Token budget for the thinking process (1-10000)',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['thinking'], operation: ['generate'] } },
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
				displayName: 'Max Tokens',
				name: 'maxTokens',
				type: 'number',
				default: 8192,
				typeOptions: { minValue: 1, maxValue: 16000 },
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
				placeholder: '{"top_p": 0.9}',
			},
		],
	},
];

/**
 * Extract the thinking block from a thinking-model response.
 * The thinking content may appear in `message.thinking` or `message.reasoning_content`.
 */
function extractThinking(response: any): string {
	try {
		const message = response?.choices?.[0]?.message;
		if (!message) return '';
		if (typeof message.thinking === 'string') return message.thinking;
		if (typeof message.reasoning_content === 'string') return message.reasoning_content;
		return '';
	} catch (_e) {
		return '';
	}
}

export async function executeThinking(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const modelParam = this.getNodeParameter('model', index) as string;
	const model = modelParam === '__custom'
		? this.getNodeParameter('customModel', index) as string
		: modelParam;
	const userPrompt = this.getNodeParameter('userPrompt', index) as string;
	const budgetTokens = this.getNodeParameter('budgetTokens', index, 5000) as number;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		systemPrompt?: string;
		maxTokens?: number;
		simplify?: boolean;
		extraBodyFields?: string;
	};

	const systemPrompt = additionalOptions.systemPrompt || 'You are a helpful assistant.';
	const maxTokens = additionalOptions.maxTokens ?? 8192;

	const startTime = Date.now();
	const { endpoint, body } = buildRequestForModel({
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		],
		max_tokens: maxTokens,
		temperature: 1,
		thinking: {
			type: 'enabled',
			budget_tokens: budgetTokens,
		},
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
		timeout: 120000,
	});
	const processingTime = Date.now() - startTime;

	const { content, finishReason, usage } = safeExtractChatContent(response);
	const thinking = extractThinking(response);
	const simplify = additionalOptions.simplify !== false;

	return [
		{
			json: simplify
				? {
					success: true,
					operation: 'thinking',
					model,
					content,
					thinking,
					budget_tokens: budgetTokens,
					processing_time_ms: processingTime,
				}
				: {
					success: true,
					operation: 'thinking',
					model,
					content,
					thinking,
					budget_tokens: budgetTokens,
					finish_reason: finishReason,
					usage,
					processing_time_ms: processingTime,
					raw_response: response,
				},
			pairedItem: { item: index },
		},
	];
}
