import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  entry: './src/server.js',
  dest: './dist/server.js',
  format: 'cjs',
  plugins: [
    resolve({
      jsnext: true,
      skip: [
        'fs',
        'https',
        'memcached',
        'mysql',
        'ws'
      ]
    }),
    commonjs({
      exclude: ['**/lodash-es/**']
    })
  ]
};
