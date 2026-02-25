import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { executeGenerateImage } from './generateImage';
import { executeRemoveBackground } from './removeBackground';
import { executeEnhancePrompt } from './enhancePrompt';
import { executeVirtualTryOn } from './virtualTryOn';
import { executeChat } from './chat';
import { executeThinking } from './thinking';
import { executeEmbeddings } from './embeddings';
import { executeVideoCreate, executeVideoRetrieve, executeVideoDownload, executeVideoList } from './video';

export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];
	for (let i = 0; i < items.length; i++) {
		try {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;
			let result: INodeExecutionData[];

			if (resource === 'chat' && operation === 'generate') {
				result = await executeChat.call(this, i);
			} else if (resource === 'image' && operation === 'generate') {
				result = await executeGenerateImage.call(this, i);
			} else if (resource === 'image' && operation === 'removeBackground') {
				result = await executeRemoveBackground.call(this, i);
			} else if (resource === 'prompt' && operation === 'enhance') {
				result = await executeEnhancePrompt.call(this, i);
			} else if (resource === 'virtualTryOn' && operation === 'generate') {
				result = await executeVirtualTryOn.call(this, i);
			} else if (resource === 'thinking' && operation === 'generate') {
				result = await executeThinking.call(this, i);
			} else if (resource === 'embeddings' && operation === 'generate') {
				result = await executeEmbeddings.call(this, i);
			} else if (resource === 'video' && operation === 'create') {
				result = await executeVideoCreate.call(this, i);
			} else if (resource === 'video' && operation === 'retrieve') {
				result = await executeVideoRetrieve.call(this, i);
			} else if (resource === 'video' && operation === 'download') {
				result = await executeVideoDownload.call(this, i);
			} else if (resource === 'video' && operation === 'list') {
				result = await executeVideoList.call(this, i);
			} else {
				throw new Error(`Unknown resource/operation: ${resource}/${operation}`);
			}

			returnData.push(...result);
		} catch (error) {
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: (error as Error).message },
					pairedItem: { item: i },
				});
			} else {
				throw error;
			}
		}
	}

	return [returnData];
}
