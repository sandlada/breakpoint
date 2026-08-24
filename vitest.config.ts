import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Colocated *.spec.ts: tests live alongside source, per TASK section 8
        include: ['src/**/*.spec.ts'],
        exclude: ['node_modules', 'dist', 'build'],
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        passWithNoTests: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,mts,cts}'],
            exclude: ['**/*.spec.ts', '**/*.test.ts', 'dist/**', 'build/**'],
        },
        // TS7 type checking reuses root tsconfig (vitest typecheck requires @vitest/coverage etc., disabled by default, use tsc --noEmit)
        typecheck: {
            enabled: false,
        },
    },
})
