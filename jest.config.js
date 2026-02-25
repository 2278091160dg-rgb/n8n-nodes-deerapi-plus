module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: [
    'nodes/**/*.ts',
    'credentials/**/*.ts',
    'transport/**/*.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 96,
      branches: 85,
      functions: 96,
      lines: 96,
    },
  },
};
