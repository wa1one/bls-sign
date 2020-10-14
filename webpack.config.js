const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'bls-sign',
    libraryTarget: 'umd'
  },
  externals: {
    "big-integer": "big-integer"
  },
  module: {
    rules: []
  },
  target: 'node'
};