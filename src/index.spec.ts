import { describe, expect, it } from 'vitest'
import {
    ABSOLUTE_PX,
    Breakpoint,
    BreakpointObserver,
    DEFAULT_HEIGHT_BREAKPOINTS,
    DEFAULT_WIDTH_BREAKPOINTS,
    EM_BASE,
    REM_BASE,
    Subject,
    canUseDOM,
    canUseMatchMedia,
    canUseRequestAnimationFrame,
    canUseResizeObserver,
    evaluateAll,
    getDefaultViewportObserver,
    getDocument,
    getWindow,
    isBrowser,
    isServer,
    isShallowEqualArray,
    matchesCondition,
    matchesDefinition,
    parseCondition,
    version,
} from './index.js'

describe('main package entry (index.ts)', () => {
    it('exports version and core symbols', () => {
        expect(typeof version).toBe('string')
        expect(version).toBe('1.0.0')
        expect(BreakpointObserver).toBeDefined()
        expect(Breakpoint).toBeDefined()
        expect(DEFAULT_WIDTH_BREAKPOINTS).toBeDefined()
        expect(DEFAULT_HEIGHT_BREAKPOINTS).toBeDefined()
        expect(getDefaultViewportObserver).toBeDefined()
        expect(typeof isServer).toBe('function')
        expect(typeof isBrowser).toBe('function')
    })

    it('exports all pure evaluators and parsers', () => {
        expect(typeof parseCondition).toBe('function')
        expect(typeof matchesCondition).toBe('function')
        expect(typeof matchesDefinition).toBe('function')
        expect(typeof evaluateAll).toBe('function')
    })

    it('exports all constants and unit conversions', () => {
        expect(REM_BASE).toBe(16)
        expect(EM_BASE).toBe(16)
        expect(ABSOLUTE_PX).toBeDefined()
        expect(ABSOLUTE_PX.in).toBe(96)
    })

    it('exports rx utilities', () => {
        expect(typeof isShallowEqualArray).toBe('function')
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
