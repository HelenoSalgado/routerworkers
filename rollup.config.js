import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false, // Types serão gerados pelo tsc separadamente
      declarationMap: false, // O plugin não gera mapas de declaração se 'declaration' for false
      sourceMap: true
    })
  ],
  external: []
};
