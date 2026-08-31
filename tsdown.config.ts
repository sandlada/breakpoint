import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: [
        'src/**/*.ts',
        '!src/**/*.spec.ts',
    ],
    unbundle: true,
    format: ['esm'],
    outDir: 'dist',
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    // breakpoint is a browser utility, neutral is most SSR-compatible; do not use 'node'
    platform: 'neutral',
    // Library quality checks — enable when extra deps are available: publint requires `publint`, attw requires `@arethetypeswrong/cli`, unused requires `unplugin-unused`
    publint: false,
    attw: false,
    unused: false,
})

