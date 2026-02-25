import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class DeerApiPlusApi implements ICredentialType {
	name = 'deerApiPlusApi';
	displayName = 'DeerAPI Plus API';
	documentationUrl = 'https://deerapi.com/docs';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your DeerAPI API Key',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.deerapi.com',
			description: 'Custom API base URL (optional)',
		},
	];
}
