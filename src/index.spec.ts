import { describe, expect, it } from 'vitest'
import * as indexExports from './index.js'
import {
    ABSOLUTE_PX,
    Breakpoint,
    DEFAULT_HEIGHT_BREAKPOINTS,
    DEFAULT_WIDTH_BREAKPOINTS,
    EM_BASE,
    REM_BASE,
    Subject,
    canUseDOM,
    canUseMatchMedia,
    canUseRequestAnimationFrame,
    canUseResizeObserver,
    computeBreakpointState,
    convertConditionToMediaQuery,
    convertDefinitionToMediaQuery,
    createBreakpointInterval,
    createBreakpointObserver,
    equals,
    evaluateBreakpointMap,
    getDefaultViewportObserver,
    getDocument,
    getWindow,
    greaterThan,
    greaterThanOrEqual,
    isBrowser,
    isServer,
    isShallowEqualArray,
    isShallowEqualRecord,
    lessThan,
    lessThanOrEqual,
    matchesBreakpointCondition,
    matchesBreakpointDefinition,
    notEquals,
    observeActiveBreakpoints,
    observeActiveHeightBreakpoints,
    observeActiveWidthBreakpoints,
    observeBreakpoint,
    observeBreakpointState,
    observeHeightBreakpoint,
    observeWidthBreakpoint,
    parseBreakpointCondition,
} from './index.js'

describe('Package Entry (index.ts)', () => {
    describe('Happy Path', () => {
        it('exports core constants and configuration defaults', () => {
            expect(REM_BASE).toBe(16)
            expect(EM_BASE).toBe(16)
            expect(ABSOLUTE_PX).toBeDefined()
            expect(ABSOLUTE_PX.in).toBe(96)
            expect(DEFAULT_WIDTH_BREAKPOINTS).toBeDefined()
            expect(DEFAULT_HEIGHT_BREAKPOINTS).toBeDefined()
        })

        it('exports all pure evaluators, parsers, and condition builders', () => {
            expect(typeof parseBreakpointCondition).toBe('function')
            expect(typeof matchesBreakpointCondition).toBe('function')
            expect(typeof matchesBreakpointDefinition).toBe('function')
            expect(typeof evaluateBreakpointMap).toBe('function')
            expect(typeof computeBreakpointState).toBe('function')
            expect(typeof convertConditionToMediaQuery).toBe('function')
            expect(typeof convertDefinitionToMediaQuery).toBe('function')
            expect(typeof greaterThan).toBe('function')
            expect(typeof greaterThanOrEqual).toBe('function')
            expect(typeof lessThan).toBe('function')
            expect(typeof lessThanOrEqual).toBe('function')
            expect(typeof equals).toBe('function')
            expect(typeof notEquals).toBe('function')
            expect(typeof createBreakpointInterval).toBe('function')
            expect(Breakpoint).toBeDefined()
        })

        it('exports observer instances and reactive stream factories', () => {
            expect(typeof createBreakpointObserver).toBe('function')
            expect(typeof getDefaultViewportObserver).toBe('function')
            expect(typeof observeBreakpointState).toBe('function')
            expect(typeof observeBreakpoint).toBe('function')
            expect(typeof observeWidthBreakpoint).toBe('function')
            expect(typeof observeHeightBreakpoint).toBe('function')
            expect(typeof observeActiveWidthBreakpoints).toBe('function')
            expect(typeof observeActiveHeightBreakpoints).toBe('function')
            expect(typeof observeActiveBreakpoints).toBe('function')
        })

        it('exports reactive and environment probe utilities', () => {
            expect(typeof isShallowEqualArray).toBe('function')
            expect(typeof isShallowEqualRecord).toBe('function')
            expect(Subject).toBeDefined()
            expect(typeof isServer).toBe('function')
            expect(typeof isBrowser).toBe('function')
            expect(typeof canUseDOM).toBe('function')
            expect(typeof canUseMatchMedia).toBe('function')
            expect(typeof canUseResizeObserver).toBe('function')
            expect(typeof canUseRequestAnimationFrame).toBe('function')
            expect(typeof getWindow).toBe('function')
            expect(typeof getDocument).toBe('function')
        })
    })

    describe('Boundary & Error Handling', () => {
        it('does not leak private internals or legacy aliases', () => {
            const exportsRecord = indexExports as Record<string, unknown>
            expect(exportsRecord.version).toBeUndefined()
            expect(exportsRecord.parseCondition).toBeUndefined()
            expect(exportsRecord.matchesCondition).toBeUndefined()
            expect(exportsRecord.matchesDefinition).toBeUndefined()
            expect(exportsRecord.evaluateAll).toBeUndefined()
        })
    })
})
