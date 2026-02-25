import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';

import { router } from './actions/router';
import { generateImageFields } from './actions/generateImage';
import { removeBackgroundFields } from './actions/removeBackground';
import { enhancePromptFields } from './actions/enhancePrompt';
import { virtualTryOnFields } from './actions/virtualTryOn';
import { chatFields } from './actions/chat';
import { thinkingFields } from './actions/thinking';
import { embeddingsFields } from './actions/embeddings';
import { videoFields } from './actions/video';
import { FALLBACK_MODELS, ModelCapability } from '../../shared/constants';

/**
 * Fetch models from /v1/models and filter by capability.
 * Falls back to local FALLBACK_MODELS if API is unavailable.
 */
async function fetchModels(
	context: ILoadOptionsFunctions,
	capability: ModelCapability,
): Promise<INodePropertyOptions[]> {
	try {
		const credentials = await context.getCredentials('deerApiPlusApi');
		const baseUrl = (credentials.baseUrl as string) || 'https://api.deerapi.com';
		const apiKey = credentials.apiKey as string;

		const response = await context.helpers.httpRequest({
			method: 'GET',
			url: `${baseUrl}/v1/models`,
			headers: { Authorization: `Bearer ${apiKey}` },
			timeout: 10000,
		}) as { data?: Array<{ id: string; owned_by?: string }> };

		if (response?.data?.length) {
			// Match API models against our known capability map
			const knownModels = new Map(FALLBACK_MODELS.map((m) => [m.id, m]));
			const options: INodePropertyOptions[] = [];

			for (const apiModel of response.data) {
				const known = knownModels.get(apiModel.id);
				if (known && known.capabilities.includes(capability)) {
					const costIcon = known.costTier === 'low' ? '💰' : known.costTier === 'medium' ? '💰💰' : '💰💰💰';
					const speedIcon = known.speedTier === 'fast' ? '⚡⚡⚡' : known.speedTier === 'medium' ? '⚡⚡' : '⚡';
					options.push({
						name: `${known.name} ${speedIcon} ${costIcon}`,
						value: known.id,
						description: `Speed: ${known.speedTier}, Cost: ${known.costTier}`,
					});
				}
			}

			// Also include API models not in our known list (new models)
			for (const apiModel of response.data) {
				if (!knownModels.has(apiModel.id)) {
					// Heuristic: include unknown models for text capability only
					if (capability === 'text') {
						options.push({
							name: apiModel.id,
							value: apiModel.id,
							description: 'Dynamically discovered model',
						});
					}
				}
			}

			if (options.length > 0) {
				options.push({ name: '── Custom Model ──', value: '__custom', description: 'Enter a custom model ID' });
				return options;
			}
		}
	} catch (_e) {
		// API unavailable — fall through to fallback
	}

	// Fallback: use local model list
	return getFallbackModels(capability);
}

function getFallbackModels(capability: ModelCapability): INodePropertyOptions[] {
	const models = FALLBACK_MODELS.filter((m) => m.capabilities.includes(capability));
	const options: INodePropertyOptions[] = models.map((m) => {
		const costIcon = m.costTier === 'low' ? '💰' : m.costTier === 'medium' ? '💰💰' : '💰💰💰';
		const speedIcon = m.speedTier === 'fast' ? '⚡⚡⚡' : m.speedTier === 'medium' ? '⚡⚡' : '⚡';
		return {
			name: `${m.name} ${speedIcon} ${costIcon}`,
			value: m.id,
			description: `Speed: ${m.speedTier}, Cost: ${m.costTier}`,
		};
	});
	options.push({ name: '── Custom Model ──', value: '__custom', description: 'Enter a custom model ID' });
	return options;
}

export class DeerApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'DeerAPI Plus',
		name: 'deerApiPlus',
		icon: 'file:deerapi.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'AI-powered chat, thinking, image/video generation, embeddings, background removal, prompt enhancement, and virtual try-on',
		defaults: { name: 'DeerAPI Plus' },
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'deerApiPlusApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Chat', value: 'chat', description: 'Text generation with AI models' },
					{ name: 'Embeddings', value: 'embeddings', description: 'Generate vector embeddings from text' },
					{ name: 'Image', value: 'image', description: 'Generate or process images' },
					{ name: 'Prompt', value: 'prompt', description: 'Enhance prompts for image generation' },
					{ name: 'Thinking', value: 'thinking', description: 'Deep reasoning with thinking models' },
					{ name: 'Video', value: 'video', description: 'Generate and manage AI videos' },
					{ name: 'Virtual Try-On', value: 'virtualTryOn', description: 'AI virtual clothing try-on' },
				],
				default: 'chat',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['chat'] } },
				options: [
					{ name: 'Generate', value: 'generate', description: 'Generate text with an AI model', action: 'Generate text' },
				],
				default: 'generate',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['image'] } },
				options: [
					{ name: 'Generate', value: 'generate', description: 'Generate an image from text prompt', action: 'Generate an image' },
					{ name: 'Remove Background', value: 'removeBackground', description: 'Remove image background', action: 'Remove image background' },
				],
				default: 'generate',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['prompt'] } },
				options: [
					{ name: 'Enhance', value: 'enhance', description: 'Enhance a prompt for better image generation', action: 'Enhance a prompt' },
				],
				default: 'enhance',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['virtualTryOn'] } },
				options: [
					{ name: 'Generate', value: 'generate', description: 'Generate virtual try-on image', action: 'Generate virtual try-on' },
				],
				default: 'generate',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['thinking'] } },
				options: [
					{ name: 'Generate', value: 'generate', description: 'Deep reasoning with a thinking model', action: 'Generate thinking response' },
				],
				default: 'generate',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['embeddings'] } },
				options: [
					{ name: 'Generate', value: 'generate', description: 'Generate vector embeddings from text', action: 'Generate embeddings' },
				],
				default: 'generate',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['video'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Submit a video generation task', action: 'Create video' },
					{ name: 'Retrieve', value: 'retrieve', description: 'Check video generation status', action: 'Retrieve video status' },
					{ name: 'Download', value: 'download', description: 'Download a completed video', action: 'Download video' },
					{ name: 'List', value: 'list', description: 'List video generation tasks', action: 'List video tasks' },
				],
				default: 'create',
			},
			...chatFields,
			...generateImageFields,
			...removeBackgroundFields,
			...enhancePromptFields,
			...virtualTryOnFields,
			...thinkingFields,
			...embeddingsFields,
			...videoFields,
		],
	};

	methods = {
		loadOptions: {
			async getImageModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return fetchModels(this, 'image');
			},
			async getTextModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return fetchModels(this, 'text');
			},
			async getThinkingModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return fetchModels(this, 'thinking');
			},
			async getEmbeddingModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return fetchModels(this, 'embedding');
			},
			async getVideoModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return fetchModels(this, 'video');
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return router.call(this);
	}
}
