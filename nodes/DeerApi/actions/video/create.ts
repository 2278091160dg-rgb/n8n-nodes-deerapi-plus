import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../../transport/request';

const POLL_INTERVAL_MS = 15_000;
const MAX_POLL_ATTEMPTS = 40;

export const videoCreateFields: INodeProperties[] = [
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getVideoModels' },
		default: 'sora-2-all',
		required: true,
		displayOptions: { show: { resource: ['video'], operation: ['create'] } },
		description: 'The model to use for video generation. Loaded dynamically from DeerAPI.',
	},
	{
		displayName: 'Custom Model Name',
		name: 'customModel',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['video'], operation: ['create'], model: ['__custom'] } },
		description: 'Enter a custom model name',
		placeholder: 'model-name',
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		displayOptions: { show: { resource: ['video'], operation: ['create'] } },
		description: 'Describe the video you want to generate',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['video'], operation: ['create'] } },
		options: [
			{
				displayName: 'Video Size',
				name: 'videoSize',
				type: 'options',
				options: [
					{ name: '720×1280 (Portrait)', value: '720x1280' },
					{ name: '1280×720 (Landscape)', value: '1280x720' },
					{ name: '1024×1792 (Tall)', value: '1024x1792' },
					{ name: '1792×1024 (Wide)', value: '1792x1024' },
				],
				default: '720x1280',
				description: 'Resolution of the generated video',
			},
			{
				displayName: 'Storyboard Mode',
				name: 'storyboardMode',
				type: 'boolean',
				default: false,
				description: 'Whether to enable storyboard mode for multi-shot generation',
			},
			{
				displayName: 'Storyboard Shots',
				name: 'storyboardShots',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: { show: { '/additionalOptions.storyboardMode': [true] } },
				description: 'Define individual shots for storyboard mode',
				options: [
					{
						displayName: 'Shot',
						name: 'shot',
						values: [
							{
								displayName: 'Shot Prompt',
								name: 'shotPrompt',
								type: 'string',
								typeOptions: { rows: 2 },
								default: '',
								description: 'Description for this shot',
							},
							{
								displayName: 'Duration (seconds)',
								name: 'duration',
								type: 'number',
								default: 5,
								typeOptions: { minValue: 1, maxValue: 30 },
								description: 'Duration of this shot in seconds',
							},
						],
					},
				],
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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeVideoCreate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const modelParam = this.getNodeParameter('model', index) as string;
	const model = modelParam === '__custom'
		? this.getNodeParameter('customModel', index) as string
		: modelParam;
	const prompt = this.getNodeParameter('prompt', index) as string;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		videoSize?: string;
		storyboardMode?: boolean;
		storyboardShots?: { shot?: Array<{ shotPrompt: string; duration: number }> };
		simplify?: boolean;
	};

	const startTime = Date.now();

	const body: Record<string, any> = {
		model,
		prompt,
		size: additionalOptions.videoSize || '720x1280',
	};

	if (additionalOptions.storyboardMode) {
		body.storyboard = true;
		const shots = additionalOptions.storyboardShots?.shot;
		if (shots?.length) {
			body.storyboard_shots = shots.map((s) => ({
				prompt: s.shotPrompt,
				duration: s.duration,
			}));
		}
	}

	// Submit generation task (30s timeout, retries handled by transport)
	const submitResponse = await deerApiRequest.call(this, {
		method: 'POST',
		endpoint: '/v1/videos/generations',
		body: body as any,
		timeout: 30_000,
	});

	const taskId = submitResponse?.id || submitResponse?.data?.id;
	if (!taskId) {
		throw new Error('Video generation API did not return a task ID');
	}

	// Async polling: max 40 × 15s = 10 minutes
	let status = submitResponse?.status || 'pending';
	let pollResult = submitResponse;

	for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && status !== 'completed' && status !== 'failed'; attempt++) {
		await sleep(POLL_INTERVAL_MS);
		pollResult = await deerApiRequest.call(this, {
			method: 'GET',
			endpoint: `/v1/videos/generations/${taskId}`,
			timeout: 15_000,
		});
		status = pollResult?.status || 'pending';
	}

	const processingTime = Date.now() - startTime;

	if (status === 'failed') {
		throw new Error(`Video generation failed: ${pollResult?.error?.message || 'Unknown error'}`);
	}

	if (status !== 'completed') {
		throw new Error(`Video generation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s (status: ${status})`);
	}

	const videoUrl = pollResult?.video_url || pollResult?.data?.video_url || '';
	const simplify = additionalOptions.simplify !== false;

	return [
		{
			json: simplify
				? {
					success: true,
					operation: 'video.create',
					id: taskId,
					status,
					model,
					video_url: videoUrl,
					processing_time_ms: processingTime,
				}
				: {
					success: true,
					operation: 'video.create',
					id: taskId,
					status,
					model,
					prompt,
					video_url: videoUrl,
					processing_time_ms: processingTime,
					raw_response: pollResult,
				},
			pairedItem: { item: index },
		},
	];
}
