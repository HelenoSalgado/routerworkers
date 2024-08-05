import typescript from '@rollup/plugin-typescript';
//import { RollupOptions } from 'rollup';

export default {
    input: "./src/index.ts",
    output: {
        //externalImportAttributes: true,
        dir: './dist',
        esModule: true,
        interop: 'esModule',
        format: 'es',
        strict: true
    },
    plugins: [typescript()]
};