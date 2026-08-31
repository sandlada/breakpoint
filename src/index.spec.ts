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

describe('main package entry (index.ts)', () => {
    it('does not export runtime version or redundant aliases', () => {
        expect((indexExports as Record<string, unknown>).version).toBeUndefined()
        expect((indexExports as Record<string, unknown>).parseCondition).toBeUndefined()
        expect((indexExports as Record<string, unknown>).matchesCondition).toBeUndefined()
        expect((indexExports as Record<string, unknown>).matchesDefinition).toBeUndefined()
        expect((indexExports as Record<string, unknown>).evaluateAll).toBeUndefined()
    })

    it('exports core functional symbols and default configurations', () => {
        expect(typeof createBreakpointObserver).toBe('function')
        expect(Breakpoint).toBeDefined()
        expect(DEFAULT_WIDTH_BREAKPOINTS).toBeDefined()
        expect(DEFAULT_HEIGHT_BREAKPOINTS).toBeDefined()
        expect(typeof getDefaultViewportObserver).toBe('function')
        expect(typeof isServer).toBe('function')
        expect(typeof isBrowser).toBe('function')
    })

    it('exports all pure evaluators, parsers, and state calculators', () => {
        expect(typeof parseBreakpointCondition).toBe('function')
        expect(typeof matchesBreakpointCondition).toBe('function')
        expect(typeof matchesBreakpointDefinition).toBe('function')
        expect(typeof evaluateBreakpointMap).toBe('function')
        expect(typeof computeBreakpointState).toBe('function')
        expect(typeof convertConditionToMediaQuery).toBe('function')
        expect(typeof convertDefinitionToMediaQuery).toBe('function')
    })

    it('exports all reactive stream factory functions', () => {
        expect(typeof observeBreakpointState).toBe('function')
        expect(typeof observeBreakpoint).toBe('function')
        expect(typeof observeWidthBreakpoint).toBe('function')
        expect(typeof observeHeightBreakpoint).toBe('function')
        expect(typeof observeActiveBreakpoints).toBe('function')
        expect(typeof observeActiveWidthBreakpoints).toBe('function')
        expect(typeof observeActiveHeightBreakpoints).toBe('function')
    })

    it('exports all condition builders and factory helpers', () => {
        expect(typeof greaterThan).toBe('function')
        expect(typeof greaterThanOrEqual).toBe('function')
        expect(typeof lessThan).toBe('function')
        expect(typeof lessThanOrEqual).toBe('function')
        expect(typeof equals).toBe('function')
        expect(typeof notEquals).toBe('function')
        expect(typeof createBreakpointInterval).toBe('function')
    })

    it('exports all constants and unit conversions', () => {
        expect(REM_BASE).toBe(16)
        expect(EM_BASE).toBe(16)
        expect(ABSOLUTE_PX).toBeDefined()
        expect(ABSOLUTE_PX.in).toBe(96)
    })

    it('exports rx utilities', () => {
        expect(typeof isShallowEqualArray).toBe('function')
        expect(typeof isShallowEqualRecord).toBe('function')
        expect(Subject).toBeDefined()
    })

    it('exports all environment probe functions', () => {
        expect(typeof canUseDOM).toBe('function')
        expect(typeof canUseMatchMedia).toBe('function')
        expect(typeof canUseResizeObserver).toBe('function')
        expect(typeof canUseRequestAnimationFrame).toBe('function')
        expect(typeof getWindow).toBe('function')
        expect(typeof getDocument).toBe('function')
    })
})

