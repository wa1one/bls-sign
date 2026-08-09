const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')

// This library is built on BigInt, so it cannot run anywhere that predates
// ES2020 regardless of how it is transpiled. Targeting the oldest engines
// that actually support BigInt therefore costs nothing in reach, while
// avoiding preset-env's default ES5 output - which not only inflates the
// bundle but rewrites `**` into Math.pow(), silently breaking BigInt
// exponentiation (a bug this package has hit before).
const BIGINT_CAPABLE_TARGETS = {
    node: '10.4',
    chrome: '67',
    edge: '79',
    firefox: '68',
    safari: '14',
}

const babelRule = {
    test: /\.(js|jsx)$/,
    exclude: /node_modules/,
    loader: 'babel-loader',
    options: {
        presets: [
            [
                '@babel/preset-env',
                { targets: BIGINT_CAPABLE_TARGETS, bugfixes: true },
            ],
            {
                plugins: ['@babel/plugin-proposal-class-properties'],
            },
        ],
    },
}

// Minification is configured explicitly rather than left to webpack's
// implicit production default, so the published output stays stable across
// webpack upgrades. Deliberately no `unsafe_*` compressor flags: they can
// change semantics, which is not a trade worth making in a crypto library
// for the ~0.1% they saved when measured here.
const minimizer = [
    new TerserPlugin({
        extractComments: false,
        terserOptions: {
            compress: { passes: 2 },
            format: { comments: false },
        },
    }),
]

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
            'alg-field': 'alg-field',
            'alg-bn': 'alg-bn',
        },
        module: {
            rules: [babelRule],
        },

        optimization: { minimize: true, minimizer },

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
            rules: [babelRule],
        },

        optimization: { minimize: true, minimizer },

        target: ['web', 'es6'],
        resolve: {
            alias: {
                crypto: path.resolve(
                    __dirname,
                    'src/cryptoRandomBytesBrowser.js'
                ),
            },
        },
    },
]
