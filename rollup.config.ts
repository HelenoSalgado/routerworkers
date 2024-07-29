// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import ts, { ParsedTsconfig, TsConfigSourceFile } from 'typescript';

export default {
    input: './src/index.ts',
    output: {
        dir: './dist',
        format: 'cjs'
    },
    plugins: [typescript({
        compilerOptions: {
            "target": "esnext",
            "emitDeclarationOnly": true
        }
    })]
};