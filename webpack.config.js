const path = require('path')

module.exports = [
    {
        entry: './src/index.js',
        output: {
            filename: 'index.js',
            path: path.resolve(__dirname, 'dist'),
            library: 'bls-sign',
            libraryTarget: 'umd',
        },

        externals: {
            'bigint-crypto-utils': 'bigint-crypto-utils',
            'alg-field': 'alg-field',
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    loader: 'babel-loader',

                    options: {
                        presets: [
                            '@babel/preset-env',
                            {
                                plugins: [
                                    '@babel/plugin-proposal-class-properties',
                                ],
                            },
                        ],
                    },
                },
            ],
        },

        target: ['node', 'es6'],
    },
    {
        entry: './src/index.js',
        output: {
            filename: 'index.js',
            path: path.resolve(__dirname, 'dist-web'),
            library: 'bls-sign',
            libraryTarget: 'umd',
        },

        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: /node_modules/,
                    loader: 'babel-loader',

                    options: {
                        presets: [
                            '@babel/preset-env',
                            {
                                plugins: [
                                    '@babel/plugin-proposal-class-properties',
                                ],
                            },
                        ],
                    },
                },
            ],
        },
        target: ['web', 'es6'],
        resolve: {
            fallback: {},
        },
    },
]
