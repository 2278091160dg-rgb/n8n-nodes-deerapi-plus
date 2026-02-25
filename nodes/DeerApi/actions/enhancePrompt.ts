import {
	IExecuteFunctions,
	INodeProperties,
	INodeExecutionData,
} from 'n8n-workflow';
import { deerApiRequest } from '../../../transport/request';

const SYSTEM_PROMPT = `You are an expert e-commerce product image prompt engineer with deep knowledge of commercial photography, visual merchandising, and AI image generation.

Your task is to analyze the user's original prompt and enhance it into a professional, detailed prompt optimized for generating high-quality e-commerce product images.

When enhancing the prompt, consider and add details about:
1. Lighting: Specify lighting setup (soft diffused, studio strobe, natural window light, rim lighting, etc.)
2. Composition: Describe camera angle, framing, rule of thirds, focal length, depth of field
3. Background: Suggest appropriate backgrounds (seamless white, gradient, contextual lifestyle, textured surface, etc.)
4. Product Placement: Describe how the product should be positioned, any props or complementary items
5. Commercial Appeal: Add elements that increase conversion (hero shot perspective, aspirational context, brand-appropriate mood)
6. Technical Details: Resolution hints, aspect ratio suggestions, color palette guidance
7. Style References: Reference relevant photography styles or visual trends in e-commerce

Based on the target category, adjust your enhancement strategy accordingly.

Output your response as a structured JSON object with the following fields:
- "enhanced_prompt": A single detailed string containing the fully enhanced prompt ready for image generation
- "suggestions": An array of 3 to 5 actionable tips for further improving the image result
- "category": The determined or confirmed image category

Always respond with valid JSON only. Do not include any text outside the JSON object.`;

export const enhancePromptFields: INodeProperties[] = [
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		options: [
			{ name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
			{ name: 'GPT-4o', value: 'gpt-4o' },
			{ name: 'Custom Model', value: '__custom' },
		],
		default: 'gemini-2.5-flash',
		required: true,
		displayOptions: { show: { resource: ['prompt'], operation: ['enhance'] } },
		description: 'The model to use for prompt enhancement',
	},
	{
		displayName: 'Custom Model Name',
		name: 'customModel',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['prompt'], operation: ['enhance'], model: ['__custom'] } },
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
		displayOptions: { show: { resource: ['prompt'], operation: ['enhance'] } },
		description: 'The original prompt to enhance',
	},
	{
		displayName: 'Category',
		name: 'category',
		type: 'options',
		options: [
			{ name: 'Product Photo', value: 'product_photo' },
			{ name: 'Lifestyle', value: 'lifestyle' },
			{ name: 'Flat Lay', value: 'flat_lay' },
			{ name: 'Model Shot', value: 'model_shot' },
			{ name: 'Detail Shot', value: 'detail_shot' },
			{ name: 'Packaging', value: 'packaging' },
			{ name: 'Social Media', value: 'social_media' },
			{ name: 'Banner', value: 'banner' },
		],
		default: 'product_photo',
		displayOptions: { show: { resource: ['prompt'], operation: ['enhance'] } },
		description: 'Target image category',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['prompt'], operation: ['enhance'] } },
		options: [
			{
				displayName: 'Style',
				name: 'style',
				type: 'string',
				default: '',
				description: 'Target visual style (e.g., minimalist, luxury, vibrant)',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				options: [
					{ name: 'English', value: 'en' },
					{ name: 'Chinese', value: 'zh' },
				],
				default: 'en',
				description: 'Output language for the enhanced prompt',
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
				description: 'Maximum tokens for the response',
			},
			{
				displayName: 'Simplify Output',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description: 'Whether to return a simplified output with only key fields',
			},
			{
				displayName: 'System Prompt Override',
				name: 'systemPromptOverride',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
				description: 'Override the default system prompt for this operation. Leave empty to use the built-in prompt.',
			},
			{
				displayName: 'Extra Body Fields (JSON)',
				name: 'extraBodyFields',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'Additional JSON fields to merge into the API request body, e.g. {"top_p": 0.9}',
				placeholder: '{"top_p": 0.9, "frequency_penalty": 0.5}',
			},
		],
	},
];

export async function executeEnhancePrompt(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const modelParam = this.getNodeParameter('model', index) as string;
	const model = modelParam === '__custom'
		? this.getNodeParameter('customModel', index) as string
		: modelParam;
	const prompt = this.getNodeParameter('prompt', index) as string;
	const category = this.getNodeParameter('category', index) as string;
	const additionalOptions = this.getNodeParameter('additionalOptions', index) as {
		style?: string;
		language?: string;
		temperature?: number;
		maxTokens?: number;
		simplify?: boolean;
		systemPromptOverride?: string;
		extraBodyFields?: string;
	};

	let userMessage = `Prompt: ${prompt}\nCategory: ${category}`;
	if (additionalOptions.style) {
		userMessage += `\nStyle: ${additionalOptions.style}`;
	}
	if (additionalOptions.language) {
		userMessage += `\nOutput Language: ${additionalOptions.language === 'zh' ? 'Chinese' : 'English'}`;
	}

	const startTime = Date.now();
	const temperature = additionalOptions.temperature ?? 0.7;
	const maxTokens = additionalOptions.maxTokens ?? 2048;
	const systemPrompt = additionalOptions.systemPromptOverride || SYSTEM_PROMPT;
	const body: any = {
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userMessage },
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

	const rawContent = response?.choices?.[0]?.message?.content || '';

	let enhancedPrompt = rawContent;
	let suggestions: string[] = [];
	let detectedCategory = category;

	try {
		const parsed = JSON.parse(rawContent);
		enhancedPrompt = parsed.enhanced_prompt || rawContent;
		suggestions = parsed.suggestions || [];
		detectedCategory = parsed.category || category;
	} catch (_e) {
		// Response is not JSON, use raw content as enhanced prompt
	}

	const simplify = additionalOptions.simplify !== false;

	return [
		{
			json: simplify
				? {
					success: true,
					operation: 'enhance',
					model,
					original_prompt: prompt,
					enhanced_prompt: enhancedPrompt,
					suggestions,
					category: detectedCategory,
					processing_time_ms: processingTime,
				}
				: {
					success: true,
					operation: 'enhance',
					model,
					original_prompt: prompt,
					enhanced_prompt: enhancedPrompt,
					suggestions,
					category: detectedCategory,
					processing_time_ms: processingTime,
					raw_content: rawContent,
				},
			pairedItem: { item: index },
		},
	];
}
