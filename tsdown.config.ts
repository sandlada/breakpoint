import { defineConfig } from 'tsdown'

export default defineConfig({
    // Multi-entry: main barrel + utils barrel; future src/utils/breakpoint/index.ts will be re-exported via utils.ts
    // To auto-discover all entries, use ['src/**/index.ts', '!src/**/*.spec.ts']
    entry: ['./src/index.ts'],

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

    // Exclude test files — tsdown packs by entry, colocated *.spec.ts won't be bundled
    // But if using glob entry, ensure filtering here; explicit entry is naturally excluded
})
