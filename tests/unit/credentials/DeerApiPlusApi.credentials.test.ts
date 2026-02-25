import { DeerApiPlusApi } from '../../../credentials/DeerApiPlusApi.credentials';

describe('DeerApiPlusApi Credentials', () => {
	let credentials: DeerApiPlusApi;

	beforeEach(() => {
		credentials = new DeerApiPlusApi();
	});

	it('should have correct name', () => {
		expect(credentials.name).toBe('deerApiPlusApi');
	});

	it('should have correct display name', () => {
		expect(credentials.displayName).toBe('DeerAPI Plus API');
	});

	it('should have documentation URL', () => {
		expect(credentials.documentationUrl).toBe('https://deerapi.com/docs');
	});

	it('should have apiKey property', () => {
		const apiKeyProp = credentials.properties.find((p) => p.name === 'apiKey');
		expect(apiKeyProp).toBeDefined();
		expect(apiKeyProp!.type).toBe('string');
		expect(apiKeyProp!.required).toBe(true);
		expect(apiKeyProp!.typeOptions).toEqual({ password: true });
	});

	it('should have baseUrl property with default', () => {
		const baseUrlProp = credentials.properties.find((p) => p.name === 'baseUrl');
		expect(baseUrlProp).toBeDefined();
		expect(baseUrlProp!.type).toBe('string');
		expect(baseUrlProp!.default).toBe('https://api.deerapi.com');
	});

	it('should have exactly 2 properties', () => {
		expect(credentials.properties).toHaveLength(2);
	});
});
