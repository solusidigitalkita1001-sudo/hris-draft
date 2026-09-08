import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
    {
        files: ['src/**/*.ts'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.node,
        },
        rules: {
            // Keep the severity policy from the previous backend configuration.
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-non-null-assertion': 'warn',
        },
    },
    {
        files: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        languageOptions: { globals: globals.jest },
    },
);
