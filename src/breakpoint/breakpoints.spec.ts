import { describe, expect, it } from 'vitest'
import {
    ABSOLUTE_PX,
    Breakpoint,
    DEFAULT_HEIGHT_BREAKPOINTS,
    DEFAULT_WIDTH_BREAKPOINTS,
    EM_BASE,
    REM_BASE,
    createBreakpointInterval,
    equals,
    greaterThan,
    greaterThanOrEqual,
    lessThan,
    lessThanOrEqual,
    notEquals,
} from './breakpoints.js'
import { evaluateBreakpointMap } from './breakpoint-observer.js'

describe('breakpoints — REM_BASE / EM_BASE', () => {
    it('defaults to 16', () => {
        expect(REM_BASE).toBe(16)
        expect(EM_BASE).toBe(16)
    })

    it('ABSOLUTE_PX constants', () => {
        expect(ABSOLUTE_PX.cm).toBeCloseTo(37.795, 2)
        expect(ABSOLUTE_PX.mm).toBeCloseTo(3.779, 2)
        expect(ABSOLUTE_PX.in).toBe(96)
        expect(ABSOLUTE_PX.pt).toBeCloseTo(1.333, 2)
        expect(ABSOLUTE_PX.pc).toBe(16)
    })
})

describe('breakpoints — DEFAULT_WIDTH_BREAKPOINTS', () => {
    it('MD3 width snapshot', () => {
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 599).activeBreakpoints).toContain('compact')
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS)(600).activeBreakpoints).toContain('medium')
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 839).activeBreakpoints).toContain('medium')
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 840).activeBreakpoints).toContain('expanded')
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS)(1199).activeBreakpoints).toContain('expanded')
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 1200).activeBreakpoints).toContain('large')
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 1599).activeBreakpoints).toContain('large')
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 1600).activeBreakpoints).toContain('extraLarge')
        // aliases
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 599).activeBreakpoints).toContain('xs')
        expect(evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 1600).activeBreakpoints).toContain('xl')
    })

    it('MD3 height', () => {
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS, 479).activeBreakpoints).toContain('compact')
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS)(480).activeBreakpoints).toContain('medium')
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS, 899).activeBreakpoints).toContain('medium')
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS, 900).activeBreakpoints).toContain('expanded')
    })

    it('structure — string form', () => {
        expect(DEFAULT_WIDTH_BREAKPOINTS.compact).toBe('< 600px')
        expect(DEFAULT_WIDTH_BREAKPOINTS.extraLarge).toBe('>= 1600px')
        expect(DEFAULT_WIDTH_BREAKPOINTS.medium).toEqual({ and: ['>= 600px', '< 840px'] })
        expect(DEFAULT_HEIGHT_BREAKPOINTS.compact).toBe('< 480px')
        expect(DEFAULT_HEIGHT_BREAKPOINTS.expanded).toBe('>= 900px')
    })

    it('aliases map to same numeric intervals', () => {
        const cases: Array<[number, string, string]> = [
            [0, 'compact', 'xs'],
            [599.9, 'compact', 'xs'],
            [600, 'medium', 'sm'],
            [839.9, 'medium', 'sm'],
            [840, 'expanded', 'md'],
            [1199.9, 'expanded', 'md'],
            [1200, 'large', 'lg'],
            [1599.9, 'large', 'lg'],
            [1600, 'extraLarge', 'xl'],
            [3840, 'extraLarge', 'xl'],
        ]
        for (const [targetWidth, activeName, aliasName] of cases) {
            const activeBreakpoints = evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, targetWidth).activeBreakpoints
            expect(activeBreakpoints).toContain(activeName)
            expect(activeBreakpoints).toContain(aliasName)
        }
    })

    it('MD3 height boundary checks', () => {
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS, 0).activeBreakpoints).toContain('compact')
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS, 479.9).activeBreakpoints).toContain('compact')
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS, 480).activeBreakpoints).toContain('medium')
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS, 899.9).activeBreakpoints).toContain('medium')
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS, 900).activeBreakpoints).toContain('expanded')
        expect(evaluateBreakpointMap(DEFAULT_HEIGHT_BREAKPOINTS, 2160).activeBreakpoints).toContain('expanded')
    })
})

describe('breakpoints — Breakpoint factory and standalone functions', () => {
    it('sugars and standalone builders', () => {
        expect(Breakpoint.gt(840)).toBe('> 840px')
        expect(greaterThan(840)).toBe('> 840px')
        expect(Breakpoint.gte(600)).toBe('>= 600px')
        expect(greaterThanOrEqual(600)).toBe('>= 600px')
        expect(Breakpoint.lt(1200)).toBe('< 1200px')
        expect(lessThan(1200)).toBe('< 1200px')
        expect(Breakpoint.lte(960)).toBe('<= 960px')
        expect(lessThanOrEqual(960)).toBe('<= 960px')
        expect(Breakpoint.eq(1600)).toBe('= 1600px')
        expect(equals(1600)).toBe('= 1600px')
        expect(Breakpoint.ne(960)).toBe('!= 960px')
        expect(notEquals(960)).toBe('!= 960px')
        expect(Breakpoint.interval(600, 840)).toEqual({ and: ['>= 600px', '< 840px'] })
        expect(createBreakpointInterval(600, 840)).toEqual({ and: ['>= 600px', '< 840px'] })
        expect(Breakpoint.between(600, 840)).toEqual({ and: ['>= 600px', '< 840px'] })
        expect(Breakpoint.interval(840, 1199, { minInclusive: true, maxInclusive: true })).toEqual({ and: ['>= 840px', '<= 1199px'] })
    })

    it('zero and float values in factory', () => {
        expect(Breakpoint.gt(0)).toBe('> 0px')
        expect(Breakpoint.gte(0.5, 'rem')).toBe('>= 0.5rem')
        expect(Breakpoint.lt(0)).toBe('< 0px')
        expect(Breakpoint.lte(12.75, 'em')).toBe('<= 12.75em')
        expect(Breakpoint.eq(0)).toBe('= 0px')
        expect(Breakpoint.ne(0)).toBe('!= 0px')
        expect(Breakpoint.interval(0, 100)).toEqual({ and: ['>= 0px', '< 100px'] })
        expect(Breakpoint.interval(0.5, 2.5, { minInclusive: true, maxInclusive: true, unit: 'rem' })).toEqual({ and: ['>= 0.5rem', '<= 2.5rem'] })
    })

    it('custom unit', () => {
        expect(Breakpoint.gt(10, 'rem')).toBe('> 10rem')
        expect(Breakpoint.gte(10, 'em')).toBe('>= 10em')
        expect(Breakpoint.lt(10, 'vw')).toBe('< 10vw')
        expect(Breakpoint.lte(10, 'vh')).toBe('<= 10vh')
        expect(Breakpoint.eq(10, 'cm')).toBe('= 10cm')
        expect(Breakpoint.ne(10, '%')).toBe('!= 10%')
        expect(Breakpoint.interval(10, 20, { unit: 'rem' })).toEqual({ and: ['>= 10rem', '< 20rem'] })
        expect(Breakpoint.interval(10, 20, { unit: 'em' })).toEqual({ and: ['>= 10em', '< 20em'] })
        expect(Breakpoint.interval(10, 20, { minInclusive: true, maxInclusive: true, unit: 'rem' })).toEqual({ and: ['>= 10rem', '<= 20rem'] })
        expect(Breakpoint.interval(10, 20, { minInclusive: true, maxInclusive: true, unit: 'vw' })).toEqual({ and: ['>= 10vw', '<= 20vw'] })
    })

    it('interval inclusiveness options', () => {
        expect(Breakpoint.interval(600, 840, { minInclusive: false })).toEqual({ and: ['> 600px', '< 840px'] })
        expect(Breakpoint.interval(600, 840, { maxInclusive: true })).toEqual({ and: ['>= 600px', '<= 840px'] })
        expect(Breakpoint.interval(600, 840, { minInclusive: false, maxInclusive: false })).toEqual({ and: ['> 600px', '< 840px'] })
        expect(Breakpoint.interval(600, 840, { minInclusive: false, maxInclusive: true, unit: 'em' })).toEqual({ and: ['> 600em', '<= 840em'] })
        expect(Breakpoint.interval(600, 840, { minInclusive: true, maxInclusive: true })).toEqual({ and: ['>= 600px', '<= 840px'] })
        expect(Breakpoint.interval(600, 840, { minInclusive: true, maxInclusive: true, unit: 'vh' })).toEqual({ and: ['>= 600vh', '<= 840vh'] })
    })

    it('factory covers all operators with full units', () => {
        const units: Array<import('./breakpoints.js').BreakpointUnit> = [
            'px', 'rem', 'em', 'ex', 'ch', 'cap', 'ic', 'lh', 'rlh',
            'vw', 'vh', 'vmin', 'vmax', 'vi', 'vb', 'dvw', 'dvh', 'svw', 'svh', 'lvw', 'lvh',
            'cm', 'mm', 'in', 'pt', 'pc', '%',
        ]
        for (const unit of units) {
            expect(Breakpoint.gt(10, unit)).toBe(`> 10${unit}`)
            expect(Breakpoint.gte(10, unit)).toBe(`>= 10${unit}`)
            expect(Breakpoint.lt(10, unit)).toBe(`< 10${unit}`)
            expect(Breakpoint.lte(10, unit)).toBe(`<= 10${unit}`)
            expect(Breakpoint.eq(10, unit)).toBe(`= 10${unit}`)
            expect(Breakpoint.ne(10, unit)).toBe(`!= 10${unit}`)
        }
    })
})

