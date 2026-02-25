import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';

import { router } from './actions/router';
import { generateImageFields } from './actions/generateImage';
import { removeBackgroundFields } from './actions/removeBackground';
import { enhancePromptFields } from './actions/enhancePrompt';
import { virtualTryOnFields } from './actions/virtualTryOn';

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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return router.call(this);
	}
}
