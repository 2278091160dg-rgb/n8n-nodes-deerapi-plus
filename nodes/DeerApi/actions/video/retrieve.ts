import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../../transport/request';

export const videoRetrieveFields: INodeProperties[] = [
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['video'], operation: ['retrieve'] } },
		description: 'The ID of the video generation task to retrieve',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['video'], operation: ['retrieve'] } },
		options: [
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

export async function executeVideoRetrieve(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const taskId = this.getNodeParameter('taskId', index) as string;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		simplify?: boolean;
	};

	const response = await deerApiRequest.call(this, {
		method: 'GET',
		endpoint: `/v1/videos/generations/${taskId}`,
	});

	const simplify = additionalOptions.simplify !== false;
	const status = response?.status || 'unknown';
	const videoUrl = response?.video_url || response?.data?.video_url || '';

	return [
		{
			json: simplify
				? {
					success: true,
					operation: 'video.retrieve',
					id: taskId,
					status,
					video_url: videoUrl,
				}
				: {
					success: true,
					operation: 'video.retrieve',
					id: taskId,
					status,
					video_url: videoUrl,
					raw_response: response,
				},
			pairedItem: { item: index },
		},
	];
}
