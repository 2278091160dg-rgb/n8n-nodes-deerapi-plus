import { router } from '../../nodes/DeerApi/actions/router';

jest.mock('../../nodes/DeerApi/actions/generateImage', () => ({
	generateImageFields: [],
	executeGenerateImage: jest.fn().mockResolvedValue([{ json: { success: true, operation: 'generate' }, pairedItem: { item: 0 } }]),
}));
jest.mock('../../nodes/DeerApi/actions/removeBackground', () => ({
	removeBackgroundFields: [],
	executeRemoveBackground: jest.fn().mockResolvedValue([{ json: { success: true, operation: 'removeBackground' }, pairedItem: { item: 0 } }]),
}));
jest.mock('../../nodes/DeerApi/actions/enhancePrompt', () => ({
	enhancePromptFields: [],
	executeEnhancePrompt: jest.fn().mockResolvedValue([{ json: { success: true, operation: 'enhance' }, pairedItem: { item: 0 } }]),
}));
jest.mock('../../nodes/DeerApi/actions/virtualTryOn', () => ({
	virtualTryOnFields: [],
	executeVirtualTryOn: jest.fn().mockResolvedValue([{ json: { success: true, operation: 'virtualTryOn' }, pairedItem: { item: 0 } }]),
}));

import { executeGenerateImage } from '../../nodes/DeerApi/actions/generateImage';
import { executeRemoveBackground } from '../../nodes/DeerApi/actions/removeBackground';
import { executeEnhancePrompt } from '../../nodes/DeerApi/actions/enhancePrompt';
import { executeVirtualTryOn } from '../../nodes/DeerApi/actions/virtualTryOn';

describe('router', () => {
	let mockContext: any;

	beforeEach(() => {
		jest.clearAllMocks();
		mockContext = {
			getInputData: jest.fn().mockReturnValue([{ json: {} }]),
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn().mockReturnValue(false),
		};
	});

	it('should route to generateImage', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('image')
			.mockReturnValueOnce('generate');

		const result = await router.call(mockContext);

		expect(result).toHaveLength(1);
		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json.operation).toBe('generate');
		expect(executeGenerateImage).toHaveBeenCalled();
	});

	it('should route to removeBackground', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('image')
			.mockReturnValueOnce('removeBackground');

		const result = await router.call(mockContext);

		expect(result[0][0].json.operation).toBe('removeBackground');
		expect(executeRemoveBackground).toHaveBeenCalled();
	});

	it('should route to enhancePrompt', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('prompt')
			.mockReturnValueOnce('enhance');

		const result = await router.call(mockContext);

		expect(result[0][0].json.operation).toBe('enhance');
		expect(executeEnhancePrompt).toHaveBeenCalled();
	});

	it('should route to virtualTryOn', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('virtualTryOn')
			.mockReturnValueOnce('generate');

		const result = await router.call(mockContext);

		expect(result[0][0].json.operation).toBe('virtualTryOn');
		expect(executeVirtualTryOn).toHaveBeenCalled();
	});

	it('should throw on unknown resource/operation', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('unknown')
			.mockReturnValueOnce('unknown');

		await expect(router.call(mockContext)).rejects.toThrow('Unknown resource/operation');
	});

	it('should handle continueOnFail', async () => {
		mockContext.getNodeParameter
			.mockReturnValueOnce('unknown')
			.mockReturnValueOnce('unknown');
		mockContext.continueOnFail.mockReturnValue(true);

		const result = await router.call(mockContext);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json.error).toContain('Unknown resource/operation');
		expect(result[0][0].pairedItem).toEqual({ item: 0 });
	});

	it('should process multiple items', async () => {
		mockContext.getInputData.mockReturnValue([{ json: {} }, { json: {} }, { json: {} }]);
		mockContext.getNodeParameter
			.mockReturnValueOnce('image')
			.mockReturnValueOnce('generate');

		const result = await router.call(mockContext);

		expect(result[0]).toHaveLength(3);
	});

	it('should continue processing after error with continueOnFail', async () => {
		mockContext.getInputData.mockReturnValue([{ json: {} }, { json: {} }]);
		mockContext.getNodeParameter
			.mockReturnValueOnce('image')
			.mockReturnValueOnce('generate');
		mockContext.continueOnFail.mockReturnValue(true);

		(executeGenerateImage as jest.Mock)
			.mockRejectedValueOnce(new Error('First item failed'))
			.mockResolvedValueOnce([{ json: { success: true }, pairedItem: { item: 1 } }]);

		const result = await router.call(mockContext);

		expect(result[0]).toHaveLength(2);
		expect(result[0][0].json.error).toBe('First item failed');
		expect(result[0][1].json.success).toBe(true);
	});

	it('should stop on error without continueOnFail', async () => {
		mockContext.getInputData.mockReturnValue([{ json: {} }, { json: {} }]);
		mockContext.getNodeParameter
			.mockReturnValueOnce('image')
			.mockReturnValueOnce('generate');
		mockContext.continueOnFail.mockReturnValue(false);

		(executeGenerateImage as jest.Mock).mockRejectedValueOnce(new Error('Failed'));

		await expect(router.call(mockContext)).rejects.toThrow('Failed');
	});
});
