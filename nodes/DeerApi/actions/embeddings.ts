import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../transport/request';

export const embeddingsFields: INodeProperties[] = [
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getEmbeddingModels' },
		default: 'text-embedding-3-small',
		required: true,
		displayOptions: { show: { resource: ['embeddings'], operation: ['generate'] } },
		description: 'The embedding model to use. Loaded dynamically from DeerAPI.',
	},
	{
		displayName: 'Custom Model Name',
		name: 'customModel',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['embeddings'], operation: ['generate'], model: ['__custom'] } },
		description: 'Enter a custom embedding model ID',
		placeholder: 'text-embedding-model-name',
	},
	{
		displayName: 'Input Text',
		name: 'input',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		displayOptions: { show: { resource: ['embeddings'], operation: ['generate'] } },
		description: 'The text to vectorize into an embedding',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['embeddings'], operation: ['generate'] } },
		options: [
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
				placeholder: '{"encoding_format": "float"}',
			},
		],
	},
];

export async function executeEmbeddings(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const modelParam = this.getNodeParameter('model', index) as string;
	const model = modelParam === '__custom'
		? this.getNodeParameter('customModel', index) as string
		: modelParam;
	const input = this.getNodeParameter('input', index) as string;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		simplify?: boolean;
		extraBodyFields?: string;
	};

	const startTime = Date.now();
	const body: any = {
		model,
		input,
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
		endpoint: '/v1/embeddings',
		body,
	});
	const processingTime = Date.now() - startTime;

	const embedding = response?.data?.[0]?.embedding ?? [];
	const dimensions = Array.isArray(embedding) ? embedding.length : 0;
	const usage = (typeof response?.usage === 'object' && response.usage !== null) ? response.usage : {};
	const simplify = additionalOptions.simplify !== false;

	return [
		{
			json: simplify
				? {
					success: true,
					operation: 'embeddings',
					model,
					embedding,
					dimensions,
					processing_time_ms: processingTime,
				}
				: {
					success: true,
					operation: 'embeddings',
					model,
					embedding,
					dimensions,
					usage,
					processing_time_ms: processingTime,
					raw_response: response,
				},
			pairedItem: { item: index },
		},
	];
}
