import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../../transport/request';

export const videoDownloadFields: INodeProperties[] = [
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['video'], operation: ['download'] } },
		description: 'The ID of the completed video generation task',
	},
];

export async function executeVideoDownload(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const taskId = this.getNodeParameter('taskId', index) as string;

	// First retrieve the task to get the video URL
	const response = await deerApiRequest.call(this, {
		method: 'GET',
		endpoint: `/v1/videos/generations/${taskId}`,
	});

	const status = response?.status || 'unknown';
	if (status !== 'completed') {
		throw new Error(`Cannot download: video task "${taskId}" status is "${status}" (expected "completed")`);
	}

	const videoUrl = response?.video_url || response?.data?.video_url;
	if (!videoUrl) {
		throw new Error(`No video URL found for task "${taskId}"`);
	}

	const videoData = await this.helpers.httpRequest({
		method: 'GET',
		url: videoUrl,
		encoding: 'arraybuffer',
	});

	const binary = await this.helpers.prepareBinaryData(
		Buffer.from(videoData as ArrayBuffer),
		'output.mp4',
		'video/mp4',
	);

	return [
		{
			json: {
				success: true,
				operation: 'video.download',
				id: taskId,
				video_url: videoUrl,
			},
			binary: { data: binary },
			pairedItem: { item: index },
		},
	];
}
