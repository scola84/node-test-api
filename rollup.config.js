import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  dest: './dist/server.js',
  entry: './src/server.js',
  format: 'cjs',
  plugins: [
    resolve({
      jsnext: true,
      preferBuiltins: true,
      skip: [
        'async',
        'http',
        'memcached',
        'mysql',
        'ws'
      ]
    }),
    commonjs()
  ]
};
