import { describe, expect, it } from 'vitest'
import {
    ABSOLUTE_PX,
    Breakpoint,
    DEFAULT_HEIGHT_BREAKPOINTS,
    DEFAULT_WIDTH_BREAKPOINTS,
    EM_BASE,
    REM_BASE,
    type BreakpointUnit,
    createBreakpointInterval,
    equals,
    greaterThan,
    greaterThanOrEqual,
    lessThan,
    lessThanOrEqual,
    notEquals,
} from './breakpoints.js'

describe('REM_BASE & EM_BASE', () => {
    describe('Happy Path', () => {
        it('provides standard 16px default base', () => {
            expect(REM_BASE).toBe(16)
            expect(EM_BASE).toBe(16)
        })
    })
})

describe('ABSOLUTE_PX', () => {
    describe('Happy Path', () => {
        it('provides accurate 96 DPI CSS physical unit factors', () => {
            expect(ABSOLUTE_PX.in).toBe(96)
            expect(ABSOLUTE_PX.pc).toBe(16)
            expect(ABSOLUTE_PX.cm).toBeCloseTo(37.795275591, 4)
            expect(ABSOLUTE_PX.mm).toBeCloseTo(3.7795275591, 4)
            expect(ABSOLUTE_PX.pt).toBeCloseTo(1.3333333333, 4)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('is an immutable frozen object', () => {
            expect(Object.isFrozen(ABSOLUTE_PX)).toBe(true)
        })
    })
})

describe('DEFAULT_WIDTH_BREAKPOINTS & DEFAULT_HEIGHT_BREAKPOINTS', () => {
    describe('Happy Path', () => {
        it('matches standard Material Design 3 width specification and aliases', () => {
            expect(DEFAULT_WIDTH_BREAKPOINTS.compact).toBe('< 600px')
            expect(DEFAULT_WIDTH_BREAKPOINTS.medium).toEqual({ and: ['>= 600px', '< 840px'] })
            expect(DEFAULT_WIDTH_BREAKPOINTS.expanded).toEqual({ and: ['>= 840px', '< 1200px'] })
            expect(DEFAULT_WIDTH_BREAKPOINTS.large).toEqual({ and: ['>= 1200px', '< 1600px'] })
            expect(DEFAULT_WIDTH_BREAKPOINTS.extraLarge).toBe('>= 1600px')

            // MD3 aliases
            expect(DEFAULT_WIDTH_BREAKPOINTS.xs).toEqual(DEFAULT_WIDTH_BREAKPOINTS.compact)
            expect(DEFAULT_WIDTH_BREAKPOINTS.sm).toEqual(DEFAULT_WIDTH_BREAKPOINTS.medium)
            expect(DEFAULT_WIDTH_BREAKPOINTS.md).toEqual(DEFAULT_WIDTH_BREAKPOINTS.expanded)
            expect(DEFAULT_WIDTH_BREAKPOINTS.lg).toEqual(DEFAULT_WIDTH_BREAKPOINTS.large)
            expect(DEFAULT_WIDTH_BREAKPOINTS.xl).toEqual(DEFAULT_WIDTH_BREAKPOINTS.extraLarge)
        })

        it('matches standard Material Design 3 height specification', () => {
            expect(DEFAULT_HEIGHT_BREAKPOINTS.compact).toBe('< 480px')
            expect(DEFAULT_HEIGHT_BREAKPOINTS.medium).toEqual({ and: ['>= 480px', '< 900px'] })
            expect(DEFAULT_HEIGHT_BREAKPOINTS.expanded).toBe('>= 900px')
        })
    })

    describe('Boundary & Error Handling', () => {
        it('are immutable frozen dictionaries', () => {
            expect(Object.isFrozen(DEFAULT_WIDTH_BREAKPOINTS)).toBe(true)
            expect(Object.isFrozen(DEFAULT_HEIGHT_BREAKPOINTS)).toBe(true)
        })
    })
})

describe('Standalone Condition Builders (greaterThan, lessThan, etc.)', () => {
    describe('Happy Path', () => {
        it('constructs condition strings with default px unit', () => {
            expect(greaterThan(840)).toBe('> 840px')
            expect(greaterThanOrEqual(600)).toBe('>= 600px')
            expect(lessThan(1200)).toBe('< 1200px')
            expect(lessThanOrEqual(960)).toBe('<= 960px')
            expect(equals(1600)).toBe('= 1600px')
            expect(notEquals(960)).toBe('!= 960px')
        })

        it('constructs condition strings with custom CSS units', () => {
            expect(greaterThan(50, 'rem')).toBe('> 50rem')
            expect(greaterThanOrEqual(10, 'em')).toBe('>= 10em')
            expect(lessThan(100, 'vw')).toBe('< 100vw')
            expect(lessThanOrEqual(50, 'vh')).toBe('<= 50vh')
            expect(equals(10, 'cm')).toBe('= 10cm')
            expect(notEquals(50, '%')).toBe('!= 50%')
        })
    })

    describe('Boundary & Error Handling', () => {
        it('handles zero and decimal float values', () => {
            expect(greaterThan(0)).toBe('> 0px')
            expect(greaterThanOrEqual(0.5, 'rem')).toBe('>= 0.5rem')
            expect(lessThan(0)).toBe('< 0px')
            expect(lessThanOrEqual(12.75, 'em')).toBe('<= 12.75em')
            expect(equals(0)).toBe('= 0px')
            expect(notEquals(0)).toBe('!= 0px')
        })
    })
})

describe('createBreakpointInterval', () => {
    describe('Happy Path', () => {
        it('creates left-closed right-open interval [min, max) by default', () => {
            expect(createBreakpointInterval(600, 840)).toEqual({ and: ['>= 600px', '< 840px'] })
        })

        it('supports customizable inclusiveness and unit', () => {
            expect(createBreakpointInterval(600, 840, { minInclusive: true, maxInclusive: true })).toEqual({
                and: ['>= 600px', '<= 840px'],
            })
            expect(createBreakpointInterval(600, 840, { minInclusive: false, maxInclusive: false })).toEqual({
                and: ['> 600px', '< 840px'],
            })
            expect(createBreakpointInterval(10, 20, { unit: 'rem' })).toEqual({
                and: ['>= 10rem', '< 20rem'],
            })
            expect(createBreakpointInterval(10, 20, { minInclusive: false, maxInclusive: true, unit: 'em' })).toEqual({
                and: ['> 10em', '<= 20em'],
            })
        })
    })

    describe('Boundary & Error Handling', () => {
        it('handles decimal bounds and zero boundaries', () => {
            expect(createBreakpointInterval(0, 100.5)).toEqual({ and: ['>= 0px', '< 100.5px'] })
            expect(createBreakpointInterval(0.5, 2.5, { minInclusive: true, maxInclusive: true, unit: 'rem' })).toEqual({
                and: ['>= 0.5rem', '<= 2.5rem'],
            })
        })
    })
})

describe('Breakpoint (Factory Namespace)', () => {
    describe('Happy Path', () => {
        it('provides sugar aliases matching standalone builders', () => {
            expect(Breakpoint.gt(840)).toBe('> 840px')
            expect(Breakpoint.gte(600)).toBe('>= 600px')
            expect(Breakpoint.lt(1200)).toBe('< 1200px')
            expect(Breakpoint.lte(960)).toBe('<= 960px')
            expect(Breakpoint.eq(1600)).toBe('= 1600px')
            expect(Breakpoint.ne(960)).toBe('!= 960px')
            expect(Breakpoint.interval(600, 840)).toEqual({ and: ['>= 600px', '< 840px'] })
            expect(Breakpoint.between(600, 840)).toEqual({ and: ['>= 600px', '< 840px'] })
        })

        it('supports full spectrum of CSS units across all builder methods', () => {
            const units: BreakpointUnit[] = [
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

    describe('Boundary & Error Handling', () => {
        it('is an immutable frozen object', () => {
            expect(Object.isFrozen(Breakpoint)).toBe(true)
        })
    })
})
