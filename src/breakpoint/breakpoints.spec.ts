import { describe, expect, it } from 'vitest'
import { ABSOLUTE_PX, Breakpoint, DEFAULT_BREAKPOINTS, DEFAULT_HEIGHT_BREAKPOINTS, EM_BASE, REM_BASE } from './breakpoints.js'
import { evaluateAll } from './breakpoint-observer.js'

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

describe('breakpoints — DEFAULT_BREAKPOINTS', () => {
    it('MD3 width snapshot', () => {
        expect(evaluateAll(599, DEFAULT_BREAKPOINTS).active).toContain('compact')
        expect(evaluateAll(600, DEFAULT_BREAKPOINTS).active).toContain('medium')
        expect(evaluateAll(839, DEFAULT_BREAKPOINTS).active).toContain('medium')
        expect(evaluateAll(840, DEFAULT_BREAKPOINTS).active).toContain('expanded')
        expect(evaluateAll(1199, DEFAULT_BREAKPOINTS).active).toContain('expanded')
        expect(evaluateAll(1200, DEFAULT_BREAKPOINTS).active).toContain('large')
        expect(evaluateAll(1599, DEFAULT_BREAKPOINTS).active).toContain('large')
        expect(evaluateAll(1600, DEFAULT_BREAKPOINTS).active).toContain('extraLarge')
        // aliases
        expect(evaluateAll(599, DEFAULT_BREAKPOINTS).active).toContain('xs')
        expect(evaluateAll(1600, DEFAULT_BREAKPOINTS).active).toContain('xl')
    })

    it('MD3 height', () => {
        expect(evaluateAll(479, DEFAULT_HEIGHT_BREAKPOINTS).active).toContain('compact')
        expect(evaluateAll(480, DEFAULT_HEIGHT_BREAKPOINTS).active).toContain('medium')
        expect(evaluateAll(899, DEFAULT_HEIGHT_BREAKPOINTS).active).toContain('medium')
        expect(evaluateAll(900, DEFAULT_HEIGHT_BREAKPOINTS).active).toContain('expanded')
    })

    it('structure — string form', () => {
        expect(DEFAULT_BREAKPOINTS.compact).toBe('< 600px')
        expect(DEFAULT_BREAKPOINTS.extraLarge).toBe('>= 1600px')
        expect(DEFAULT_BREAKPOINTS.medium).toEqual({ and: ['>= 600px', '< 840px'] })
        expect(DEFAULT_HEIGHT_BREAKPOINTS.compact).toBe('< 480px')
        expect(DEFAULT_HEIGHT_BREAKPOINTS.expanded).toBe('>= 900px')
    })

    it('aliases map to same numeric intervals', () => {
        // xs should equal compact, sm == medium etc. — evaluated identically
        const cases: Array<[number, string, string]> = [
            [599, 'compact', 'xs'],
            [600, 'medium', 'sm'],
            [840, 'expanded', 'md'],
            [1200, 'large', 'lg'],
            [1600, 'extraLarge', 'xl'],
        ]
        for (const [w, a, alias] of cases) {
            const active = evaluateAll(w, DEFAULT_BREAKPOINTS).active
            expect(active).toContain(a)
            expect(active).toContain(alias)
        }
    })
})

describe('breakpoints — Breakpoint factory', () => {
    it('sugars', () => {
        expect(Breakpoint.gt(840)).toBe('> 840px')
        expect(Breakpoint.gte(600)).toBe('>= 600px')
        expect(Breakpoint.lt(1200)).toBe('< 1200px')
        expect(Breakpoint.lte(960)).toBe('<= 960px')
        expect(Breakpoint.eq(1600)).toBe('= 1600px')
        expect(Breakpoint.ne(960)).toBe('!= 960px')
        expect(Breakpoint.between(600, 840)).toEqual({ and: ['>= 600px', '< 840px'] })
        expect(Breakpoint.range(840, 1199)).toEqual({ and: ['>= 840px', '<= 1199px'] })
    })

    it('custom unit', () => {
        expect(Breakpoint.gt(10, 'rem')).toBe('> 10rem')
        expect(Breakpoint.gte(10, 'em')).toBe('>= 10em')
        expect(Breakpoint.lt(10, 'vw')).toBe('< 10vw')
        expect(Breakpoint.lte(10, 'vh')).toBe('<= 10vh')
        expect(Breakpoint.eq(10, 'cm')).toBe('= 10cm')
        expect(Breakpoint.ne(10, '%')).toBe('!= 10%')
        expect(Breakpoint.between(10, 20, { unit: 'rem' })).toEqual({ and: ['>= 10rem', '< 20rem'] })
        expect(Breakpoint.between(10, 20, { unit: 'em' })).toEqual({ and: ['>= 10em', '< 20em'] })
        expect(Breakpoint.range(10, 20, { unit: 'rem' })).toEqual({ and: ['>= 10rem', '<= 20rem'] })
        expect(Breakpoint.range(10, 20, { unit: 'vw' })).toEqual({ and: ['>= 10vw', '<= 20vw'] })
    })

    it('between / range inclusiveness options', () => {
        expect(Breakpoint.between(600, 840, { minInclusive: false })).toEqual({ and: ['> 600px', '< 840px'] })
        expect(Breakpoint.between(600, 840, { maxInclusive: true })).toEqual({ and: ['>= 600px', '<= 840px'] })
        expect(Breakpoint.between(600, 840, { minInclusive: false, maxInclusive: false })).toEqual({ and: ['> 600px', '< 840px'] })
        expect(Breakpoint.between(600, 840, { minInclusive: false, maxInclusive: true, unit: 'em' })).toEqual({ and: ['> 600em', '<= 840em'] })
        expect(Breakpoint.range(600, 840, { minInclusive: false, maxInclusive: false })).toEqual({ and: ['> 600px', '< 840px'] })
        expect(Breakpoint.range(600, 840)).toEqual({ and: ['>= 600px', '<= 840px'] })
        expect(Breakpoint.range(600, 840, { unit: 'vh' })).toEqual({ and: ['>= 600vh', '<= 840vh'] })
    })

    it('factory covers all operators with full units', () => {
        const units: Array<import('./breakpoints.js').BreakpointUnit> = ['px', 'rem', 'em', 'vw', 'vh', 'vmin', 'vmax', 'cm', 'mm', 'in', 'pt', 'pc', '%', 'ex', 'ch']
        for (const u of units) {
            expect(Breakpoint.gt(10, u)).toBe(`> 10${u}`)
            expect(Breakpoint.gte(10, u)).toBe(`>= 10${u}`)
            expect(Breakpoint.lt(10, u)).toBe(`< 10${u}`)
            expect(Breakpoint.lte(10, u)).toBe(`<= 10${u}`)
            expect(Breakpoint.eq(10, u)).toBe(`= 10${u}`)
            expect(Breakpoint.ne(10, u)).toBe(`!= 10${u}`)
        }
    })
})
