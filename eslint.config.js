const js = require('@eslint/js')
const globals = require('globals')
const prettier = require('eslint-config-prettier')

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
    {
        files: ['**/*.test.js'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },
    },
    {
        files: ['src/cryptoRandomBytesBrowser.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },
    prettier,
    {
        ignores: ['dist/**', 'dist-web/**', 'node_modules/**'],
    },
]
