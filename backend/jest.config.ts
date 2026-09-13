import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Central test env bootstrap: sets required config vars before any module
  // imports @/config, so its fail-fast validation does not process.exit(1).
  setupFiles: ['<rootDir>/src/test/jest-env.setup.ts'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/*.test.ts',
    '**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/database/**',
    '!src/index.ts',
  ],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  passWithNoTests: true,
};

export default config;
