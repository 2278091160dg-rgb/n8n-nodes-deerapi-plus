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
		description: 'AI-powered e-commerce image generation, background removal, prompt enhancement, and virtual try-on',
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
					{ name: 'Image', value: 'image', description: 'Generate or process images' },
					{ name: 'Prompt', value: 'prompt', description: 'Enhance prompts for image generation' },
					{ name: 'Virtual Try-On', value: 'virtualTryOn', description: 'AI virtual clothing try-on' },
				],
				default: 'image',
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
			...generateImageFields,
			...removeBackgroundFields,
			...enhancePromptFields,
			...virtualTryOnFields,
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
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return router.call(this);
	}
}
