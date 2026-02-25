import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../../transport/request';

export const videoListFields: INodeProperties[] = [
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['video'], operation: ['list'] } },
		options: [
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 20,
				typeOptions: { minValue: 1, maxValue: 100 },
				description: 'Maximum number of tasks to return',
			},
			{
				displayName: 'Simplify Output',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description: 'Whether to return a simplified output with only key fields',
			},
		],
	},
];

export async function executeVideoList(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		limit?: number;
		simplify?: boolean;
	};

	const qs: Record<string, any> = {};
	if (additionalOptions.limit) {
		qs.limit = additionalOptions.limit;
	}

	const response = await deerApiRequest.call(this, {
		method: 'GET',
		endpoint: '/v1/videos/generations',
		qs: qs as any,
	});

	const tasks = Array.isArray(response?.data) ? response.data : [];
	const simplify = additionalOptions.simplify !== false;

	return tasks.map((task: any) => ({
		json: simplify
			? {
				id: task.id,
				status: task.status,
				model: task.model,
				video_url: task.video_url || '',
				created_at: task.created_at,
			}
			: task,
		pairedItem: { item: index },
	}));
}
