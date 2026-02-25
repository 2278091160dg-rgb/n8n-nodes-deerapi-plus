import { INodeProperties } from 'n8n-workflow';

export { executeVideoCreate, videoCreateFields } from './create';
export { executeVideoRetrieve, videoRetrieveFields } from './retrieve';
export { executeVideoDownload, videoDownloadFields } from './download';
export { executeVideoList, videoListFields } from './list';

import { videoCreateFields } from './create';
import { videoRetrieveFields } from './retrieve';
import { videoDownloadFields } from './download';
import { videoListFields } from './list';

export const videoFields: INodeProperties[] = [
	...videoCreateFields,
	...videoRetrieveFields,
	...videoDownloadFields,
	...videoListFields,
];
