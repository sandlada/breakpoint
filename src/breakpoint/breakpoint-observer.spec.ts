import { Subject, takeUntil } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    computeBreakpointState,
    convertConditionToMediaQuery,
    convertDefinitionToMediaQuery,
    createBreakpointObserver,
    evaluateBreakpointMap,
    getDefaultViewportObserver,
    matchesBreakpointCondition,
    matchesBreakpointDefinition,
    observeActiveBreakpoints,
    observeActiveHeightBreakpoints,
    observeActiveWidthBreakpoints,
    observeBreakpoint,
    observeBreakpointState,
    observeHeightBreakpoint,
    observeWidthBreakpoint,
    parseBreakpointCondition,
} from './breakpoint-observer.js'
import {
    DEFAULT_HEIGHT_BREAKPOINTS,
    DEFAULT_WIDTH_BREAKPOINTS,
    createBreakpointInterval,
} from './breakpoints.js'

describe('parseBreakpointCondition', () => {
    describe('Happy Path', () => {
        it('parses standard operators and pixel values', () => {
            expect(parseBreakpointCondition('> 840px')).toEqual({ operator: '>', targetValue: 840, unit: 'px' })
            expect(parseBreakpointCondition('>= 640px')).toEqual({ operator: '>=', targetValue: 640, unit: 'px' })
            expect(parseBreakpointCondition('< 1200px')).toEqual({ operator: '<', targetValue: 1200, unit: 'px' })
            expect(parseBreakpointCondition('<= 960px')).toEqual({ operator: '<=', targetValue: 960, unit: 'px' })
            expect(parseBreakpointCondition('= 1600px')).toEqual({ operator: '=', targetValue: 1600, unit: 'px' })
            expect(parseBreakpointCondition('== 1600px')).toEqual({ operator: '==', targetValue: 1600, unit: 'px' })
            expect(parseBreakpointCondition('!= 960px')).toEqual({ operator: '!=', targetValue: 960, unit: 'px' })
        })

        it('parses uppercase and mixed case CSS units', () => {
            expect(parseBreakpointCondition('> 840PX')).toEqual({ operator: '>', targetValue: 840, unit: 'px' })
            expect(parseBreakpointCondition('>= 10REM')).toEqual({ operator: '>=', targetValue: 10, unit: 'rem' })
            expect(parseBreakpointCondition('<= 20Em')).toEqual({ operator: '<=', targetValue: 20, unit: 'em' })
            expect(parseBreakpointCondition('< 50Vw')).toEqual({ operator: '<', targetValue: 50, unit: 'vw' })
            expect(parseBreakpointCondition('= 100VH')).toEqual({ operator: '=', targetValue: 100, unit: 'vh' })
            expect(parseBreakpointCondition('!= 5VMIN')).toEqual({ operator: '!=', targetValue: 5, unit: 'vmin' })
            expect(parseBreakpointCondition('>= 2.5VMAX')).toEqual({ operator: '>=', targetValue: 2.5, unit: 'vmax' })
            expect(parseBreakpointCondition('<= 100DVW')).toEqual({ operator: '<=', targetValue: 100, unit: 'dvw' })
            expect(parseBreakpointCondition('> 50SVH')).toEqual({ operator: '>', targetValue: 50, unit: 'svh' })
            expect(parseBreakpointCondition('< 80LVW')).toEqual({ operator: '<', targetValue: 80, unit: 'lvw' })
            expect(parseBreakpointCondition('>= 30VI')).toEqual({ operator: '>=', targetValue: 30, unit: 'vi' })
            expect(parseBreakpointCondition('<= 40VB')).toEqual({ operator: '<=', targetValue: 40, unit: 'vb' })
        })

        it('handles omitting leading zero (.5rem, .75em, .5px)', () => {
            expect(parseBreakpointCondition('>= .5rem')).toEqual({ operator: '>=', targetValue: 0.5, unit: 'rem' })
            expect(parseBreakpointCondition('< .75em')).toEqual({ operator: '<', targetValue: 0.75, unit: 'em' })
            expect(parseBreakpointCondition('>= .5px')).toEqual({ operator: '>=', targetValue: 0.5, unit: 'px' })
            expect(parseBreakpointCondition('!= .25')).toEqual({ operator: '!=', targetValue: 0.25, unit: 'px' })
        })

        it('defaults missing unit to px and tolerates irregular spacing', () => {
            expect(parseBreakpointCondition('>840')).toEqual({ operator: '>', targetValue: 840, unit: 'px' })
            expect(parseBreakpointCondition('   >=   600.75   px   ')).toEqual({
                operator: '>=',
                targetValue: 600.75,
                unit: 'px',
            })
            expect(parseBreakpointCondition('>0')).toEqual({ operator: '>', targetValue: 0, unit: 'px' })
            expect(parseBreakpointCondition('==0px')).toEqual({ operator: '==', targetValue: 0, unit: 'px' })
            expect(parseBreakpointCondition('!=   0')).toEqual({ operator: '!=', targetValue: 0, unit: 'px' })
        })
    })

    describe('Boundary & Error Handling', () => {
        it('throws TypeError for malformed or non-condition strings', () => {
            const invalidInputs = [
                '',
                '   ',
                '> -10px',
                '=== 600px',
                '~= 600px',
                '>> 600px',
                '<> 600px',
                '> px',
                '>=',
                'medium',
                'width >= 600px',
                '> 600invalid',
                '> 600px extra',
            ]
            for (const input of invalidInputs) {
                expect(() => parseBreakpointCondition(input)).toThrow(TypeError)
            }
        })
    })
})

describe('matchesBreakpointCondition', () => {
    afterEach(() => vi.unstubAllGlobals())

    describe('Happy Path', () => {
        it('evaluates comparison operators against pixel targets accurately', () => {
            expect(matchesBreakpointCondition(1600, '= 1600px')).toBe(true)
            expect(matchesBreakpointCondition(1599, '= 1600px')).toBe(false)
            expect(matchesBreakpointCondition(1600, '== 1600px')).toBe(true)
            expect(matchesBreakpointCondition(960, '!= 960px')).toBe(false)
            expect(matchesBreakpointCondition(961, '!= 960px')).toBe(true)
            expect(matchesBreakpointCondition(840, '> 840px')).toBe(false)
            expect(matchesBreakpointCondition(841, '> 840px')).toBe(true)
            expect(matchesBreakpointCondition(840, '>= 840px')).toBe(true)
            expect(matchesBreakpointCondition(839, '>= 840px')).toBe(false)
            expect(matchesBreakpointCondition(600, '< 600px')).toBe(false)
            expect(matchesBreakpointCondition(599, '< 600px')).toBe(true)
            expect(matchesBreakpointCondition(600, '<= 600px')).toBe(true)
            expect(matchesBreakpointCondition(601, '<= 600px')).toBe(false)
        })

        it('supports data-last currying and argument reordering', () => {
            const isGte600 = matchesBreakpointCondition('>= 600px')
            expect(isGte600(600)).toBe(true)
            expect(isGte600(599)).toBe(false)

            expect(matchesBreakpointCondition('>= 600px', 600)).toBe(true)
            expect(matchesBreakpointCondition(600, '>= 600px')).toBe(true)
        })

        it('supports relative and physical CSS units with custom base options', () => {
            expect(matchesBreakpointCondition(32, '>= 2rem')).toBe(true)
            expect(matchesBreakpointCondition(31, '>= 2rem')).toBe(false)
            expect(matchesBreakpointCondition(40, '>= 2rem', { remBase: 20 })).toBe(true)
            expect(matchesBreakpointCondition(39, '>= 2rem', { remBase: 20 })).toBe(false)

            expect(matchesBreakpointCondition(96, '>= 1in')).toBe(true)
            expect(matchesBreakpointCondition(95.9, '>= 1in')).toBe(false)
            expect(matchesBreakpointCondition(16, '>= 1pc')).toBe(true)
            expect(matchesBreakpointCondition(38, '>= 1cm')).toBe(true)
            expect(matchesBreakpointCondition(3.8, '>= 1mm')).toBe(true)
            expect(matchesBreakpointCondition(1.34, '>= 1pt')).toBe(true)
        })

        it('evaluates viewport units when window is defined', () => {
            vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 500 } as unknown as Window)
            expect(matchesBreakpointCondition(100, '>= 10vw')).toBe(true)
            expect(matchesBreakpointCondition(99, '>= 10vw')).toBe(false)
            expect(matchesBreakpointCondition(100, '>= 10dvw')).toBe(true)
            expect(matchesBreakpointCondition(100, '>= 10svw')).toBe(true)
            expect(matchesBreakpointCondition(100, '>= 10lvw')).toBe(true)
            expect(matchesBreakpointCondition(100, '>= 10vi')).toBe(true)
            expect(matchesBreakpointCondition(50, '>= 10vh')).toBe(true)
            expect(matchesBreakpointCondition(49, '>= 10vh')).toBe(false)
            expect(matchesBreakpointCondition(50, '>= 10dvh')).toBe(true)
            expect(matchesBreakpointCondition(50, '>= 10svh')).toBe(true)
            expect(matchesBreakpointCondition(50, '>= 10lvh')).toBe(true)
            expect(matchesBreakpointCondition(50, '>= 10vb')).toBe(true)
            expect(matchesBreakpointCondition(50, '>= 10vmin')).toBe(true)
            expect(matchesBreakpointCondition(100, '>= 10vmax')).toBe(true)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('returns false for non-convertible font/percentage units', () => {
            const nonConvertibleUnits = ['ex', 'ch', 'cap', 'ic', 'lh', 'rlh', '%']
            for (const unit of nonConvertibleUnits) {
                expect(matchesBreakpointCondition(100, `>= 10${unit}`)).toBe(false)
                expect(matchesBreakpointCondition(100, `<= 10${unit}`)).toBe(false)
                expect(matchesBreakpointCondition(100, `= 10${unit}`)).toBe(false)
            }
        })

        it('throws TypeError for invalid parameter types', () => {
            expect(() => matchesBreakpointCondition({} as any, {} as any)).toThrow(TypeError)
        })
    })

    describe('Environment Isolation', () => {
        it('returns false for viewport units in SSR environment without window', () => {
            vi.stubGlobal('window', undefined as unknown as Window)
            expect(matchesBreakpointCondition(100, '>= 10vw')).toBe(false)
            expect(matchesBreakpointCondition(50, '>= 10vh')).toBe(false)
            expect(matchesBreakpointCondition(50, '>= 10vmin')).toBe(false)
            expect(matchesBreakpointCondition(100, '>= 10vmax')).toBe(false)
        })
    })
})

describe('matchesBreakpointDefinition', () => {
    describe('Happy Path', () => {
        it('evaluates string conditions, compound AND/OR arrays, and numeric range objects', () => {
            expect(matchesBreakpointDefinition(900, { and: ['>= 840px', '< 1200px'] })).toBe(true)
            expect(matchesBreakpointDefinition(840, { and: ['>= 840px', '< 1200px'] })).toBe(true)
            expect(matchesBreakpointDefinition(839.9, { and: ['>= 840px', '< 1200px'] })).toBe(false)
            expect(matchesBreakpointDefinition(1200, { and: ['>= 840px', '< 1200px'] })).toBe(false)

            const orDefinition = { or: ['< 600px', '>= 1200px'] }
            expect(matchesBreakpointDefinition(500, orDefinition)).toBe(true)
            expect(matchesBreakpointDefinition(800, orDefinition)).toBe(false)
            expect(matchesBreakpointDefinition(1400, orDefinition)).toBe(true)

            expect(matchesBreakpointDefinition(700, { min: 600, max: 960 })).toBe(true)
            expect(matchesBreakpointDefinition(600, { min: 600, max: 960 })).toBe(true)
            expect(matchesBreakpointDefinition(599.9, { min: 600, max: 960 })).toBe(false)
            expect(matchesBreakpointDefinition(960, { min: 600, max: 960 })).toBe(false)
            expect(matchesBreakpointDefinition(960, { min: 600, max: 960, maxInclusive: true })).toBe(true)
            expect(matchesBreakpointDefinition(600, { min: 600, minInclusive: false })).toBe(false)
            expect(matchesBreakpointDefinition(600.1, { min: 600, minInclusive: false })).toBe(true)
        })

        it('supports data-last currying and argument reordering', () => {
            const curried = matchesBreakpointDefinition({ and: ['>= 840px', '< 1200px'] })
            expect(curried(900)).toBe(true)
            expect(curried(600)).toBe(false)

            expect(matchesBreakpointDefinition({ and: ['>= 840px', '< 1200px'] }, 900)).toBe(true)
            expect(matchesBreakpointDefinition(900, { and: ['>= 840px', '< 1200px'] })).toBe(true)
        })

        it('supports complex range definitions with eq and ne constraints', () => {
            expect(matchesBreakpointDefinition(1000, { eq: 1000 })).toBe(true)
            expect(matchesBreakpointDefinition(1001, { eq: 1000 })).toBe(false)
            expect(matchesBreakpointDefinition(1000, { ne: 1000 })).toBe(false)
            expect(matchesBreakpointDefinition(1001, { ne: 1000 })).toBe(true)

            const complexRange = { min: 500, max: 1000, ne: 750 }
            expect(matchesBreakpointDefinition(500, complexRange)).toBe(true)
            expect(matchesBreakpointDefinition(750, complexRange)).toBe(false)
            expect(matchesBreakpointDefinition(999.9, complexRange)).toBe(true)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('throws TypeError for empty objects or invalid non-definition types', () => {
            expect(() => matchesBreakpointDefinition(100, {} as any)).toThrow(TypeError)
            expect(() => matchesBreakpointDefinition(100, null as any)).toThrow(TypeError)
            expect(() => matchesBreakpointDefinition(100, undefined as any)).toThrow(TypeError)
            expect(() => matchesBreakpointDefinition(100, [] as any)).toThrow(TypeError)
            expect(() => matchesBreakpointDefinition(100, true as any)).toThrow(TypeError)
            expect(() => matchesBreakpointDefinition(100, { customKey: 'val' } as any)).toThrow(TypeError)
        })

        it('handles empty and/or arrays vacuously', () => {
            expect(matchesBreakpointDefinition(700, { and: [] })).toBe(true)
            expect(matchesBreakpointDefinition(700, { or: [] })).toBe(false)
        })
    })
})

describe('evaluateBreakpointMap', () => {
    describe('Happy Path', () => {
        it('evaluates complete breakpoint map against a target pixel value', () => {
            const result = evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 700)
            expect(result.activeBreakpoints).toContain('medium')
            expect(result.activeBreakpoints).toContain('sm')
            expect(result.matchesTable.medium).toBe(true)
            expect(result.matchesTable.compact).toBe(false)
        })

        it('supports data-last currying and custom unit options', () => {
            const curried = evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS)
            const result = curried(700)
            expect(result.activeBreakpoints).toContain('medium')

            const customMap = { r: '>= 5rem', e: '>= 5em' }
            const customResult = evaluateBreakpointMap(customMap, 50, { remBase: 10, emBase: 20 })
            expect(customResult.activeBreakpoints).toEqual(['r'])
        })

        it('handles overlapping breakpoint definitions properly', () => {
            const overlappingMap = {
                a: { and: ['> 600px', '< 960px'] },
                b: { and: ['> 840px', '< 1200px'] },
            }
            expect(evaluateBreakpointMap(overlappingMap, 900).activeBreakpoints).toEqual(['a', 'b'])
            expect(evaluateBreakpointMap(overlappingMap, 700).activeBreakpoints).toEqual(['a'])
            expect(evaluateBreakpointMap(overlappingMap, 1000).activeBreakpoints).toEqual(['b'])
            expect(evaluateBreakpointMap(overlappingMap, 500).activeBreakpoints).toEqual([])
        })
    })

    describe('Boundary & Error Handling', () => {
        it('evaluates empty breakpoint map to empty results', () => {
            const result = evaluateBreakpointMap({}, 800)
            expect(result.activeBreakpoints).toEqual([])
            expect(result.matchesTable).toEqual({})
        })

        it('throws TypeError for non-object or nullish breakpoint maps', () => {
            expect(() => evaluateBreakpointMap(null as any, 500)).toThrow(TypeError)
            expect(() => evaluateBreakpointMap(undefined as any, 500)).toThrow(TypeError)
            expect(() => evaluateBreakpointMap([] as any, 500)).toThrow(TypeError)
        })
    })
})

describe('computeBreakpointState', () => {
    describe('Happy Path', () => {
        it('computes complete snapshot for width, height, or both dimensions', () => {
            const widthState = computeBreakpointState(1024, 768, { dimension: 'width' })
            expect(widthState.width).toBe(1024)
            expect(widthState.height).toBe(768)
            expect(widthState.primaryWidthBreakpoint).toBe('expanded')
            expect(widthState.primaryHeightBreakpoint).toBeNull()
            expect(widthState.activeWidthBreakpoints).toContain('expanded')
            expect(widthState.activeHeightBreakpoints).toEqual([])
            expect(widthState.matches).toBe(true)

            const bothState = computeBreakpointState(1024, 768, { dimension: 'both' })
            expect(bothState.primaryWidthBreakpoint).toBe('expanded')
            expect(bothState.primaryHeightBreakpoint).toBe('medium')
            expect(bothState.activeWidthBreakpoints).toContain('expanded')
            expect(bothState.activeHeightBreakpoints).toContain('medium')
            expect(bothState.matches).toBe(true)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('returns frozen arrays and records in snapshot', () => {
            const state = computeBreakpointState(500, 300)
            expect(Object.isFrozen(state.activeWidthBreakpoints)).toBe(true)
            expect(Object.isFrozen(state.activeHeightBreakpoints)).toBe(true)
            expect(Object.isFrozen(state.widthMatches)).toBe(true)
            expect(Object.isFrozen(state.heightMatches)).toBe(true)
        })
    })
})

describe('convertConditionToMediaQuery & convertDefinitionToMediaQuery', () => {
    describe('Happy Path', () => {
        it('converts simple condition strings into CSS media queries', () => {
            expect(convertConditionToMediaQuery('>= 600px', 'width', 0.05)).toBe('(min-width: 600px)')
            expect(convertConditionToMediaQuery('> 840px', 'width', 0.05)).toBe('(min-width: 840.05px)')
            expect(convertConditionToMediaQuery('<= 960px', 'width', 0.05)).toBe('(max-width: 960px)')
            expect(convertConditionToMediaQuery('< 1200px', 'width', 0.05)).toBe('(max-width: 1199.95px)')
            expect(convertConditionToMediaQuery('= 800px', 'width', 0.05)).toBe('(width: 800px)')
            expect(convertConditionToMediaQuery('!= 800px', 'width', 0.05)).toBe('not (width: 800px)')
        })

        it('converts compound AND/OR definitions and BreakpointRange objects', () => {
            expect(convertDefinitionToMediaQuery({ and: ['>= 600px', '< 840px'] }, 'width', 0.05)).toBe(
                '(min-width: 600px) and (max-width: 839.95px)',
            )
            expect(convertDefinitionToMediaQuery({ or: ['< 600px', '>= 1200px'] }, 'width', 0.05)).toBe(
                '(max-width: 599.95px), (min-width: 1200px)',
            )
            expect(convertDefinitionToMediaQuery({ min: 600, max: 840 }, 'width', 0.05)).toBe(
                '(min-width: 600px) and (max-width: 839.95px)',
            )
            expect(convertDefinitionToMediaQuery({ eq: 800 }, 'width', 0.05)).toBe('(width: 800px)')
            expect(convertDefinitionToMediaQuery({ ne: 800 }, 'width', 0.05)).toBe('not (width: 800px)')
        })
    })

    describe('Boundary & Error Handling', () => {
        it('returns null for non-convertible units or empty condition sets', () => {
            expect(convertConditionToMediaQuery('>= 10%', 'width', 0.05)).toBeNull()
            expect(convertConditionToMediaQuery('>= 10ex', 'width', 0.05)).toBeNull()
            expect(convertDefinitionToMediaQuery({ and: [] }, 'width', 0.05)).toBeNull()
            expect(convertDefinitionToMediaQuery({ or: [] }, 'width', 0.05)).toBeNull()
            expect(convertDefinitionToMediaQuery({} as any, 'width', 0.05)).toBeNull()
        })

        it('clamps lower bounds of exclusive less-than queries to 0px', () => {
            expect(convertConditionToMediaQuery('< 0px', 'width', 0.05)).toBe('(max-width: 0px)')
            expect(convertConditionToMediaQuery('< 0.02px', 'width', 0.05)).toBe('(max-width: 0px)')
        })
    })
})

describe('createBreakpointObserver', () => {
    const originalInnerWidth = window.innerWidth
    const originalInnerHeight = window.innerHeight

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: originalInnerWidth })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: originalInnerHeight })
        vi.restoreAllMocks()
    })

    describe('Happy Path', () => {
        it('initializes synchronous snapshot and reactive streams from window viewport', () => {
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
            Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })

            const observer = createBreakpointObserver({ dimension: 'both' })
            expect(observer.snapshot.width).toBe(700)
            expect(observer.snapshot.height).toBe(500)
            expect(observer.snapshot.primaryWidthBreakpoint).toBe('medium')
            expect(observer.snapshot.primaryHeightBreakpoint).toBe('medium')
            expect(observer.hasWidthBreakpoint('medium')).toBe(true)
            expect(observer.hasHeightBreakpoint('medium')).toBe(true)
            expect(observer.hasBreakpoint('medium', 'both')).toBe(true)
            expect(observer.matchesWidthBreakpoint('>= 600px')).toBe(true)
            expect(observer.matchesHeightBreakpoint('< 900px')).toBe(true)
            expect(observer.matchesBreakpoint('>= 600px', 'width')).toBe(true)

            observer.dispose()
        })

        it('observes element bounding client dimensions when element is provided', () => {
            const divElement = document.createElement('div')
            vi.spyOn(divElement, 'getBoundingClientRect').mockReturnValue({
                width: 800,
                height: 600,
                top: 0,
                left: 0,
                right: 800,
                bottom: 600,
                x: 0,
                y: 0,
                toJSON: () => {},
            } as DOMRect)

            const observer = createBreakpointObserver({ element: divElement })
            expect(observer.attachedElement).toBe(divElement)
            expect(observer.snapshot.width).toBe(800)
            expect(observer.snapshot.height).toBe(600)

            observer.detachElement()
            expect(observer.attachedElement).toBeNull()

            observer.dispose()
        })
    })

    describe('Boundary & Error Handling', () => {
        it('falls back to offsetWidth/offsetHeight if getBoundingClientRect returns 0', () => {
            const divElement = document.createElement('div')
            vi.spyOn(divElement, 'getBoundingClientRect').mockReturnValue({
                width: 0,
                height: 0,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                x: 0,
                y: 0,
                toJSON: () => {},
            } as DOMRect)
            Object.defineProperty(divElement, 'offsetWidth', { configurable: true, value: 750 })
            Object.defineProperty(divElement, 'offsetHeight', { configurable: true, value: 450 })

            const observer = createBreakpointObserver({ element: divElement })
            expect(observer.snapshot.width).toBe(750)
            expect(observer.snapshot.height).toBe(450)
            observer.dispose()
        })

        it('handles detached DOM nodes whose getBoundingClientRect throws', () => {
            const divElement = document.createElement('div')
            vi.spyOn(divElement, 'getBoundingClientRect').mockImplementation(() => {
                throw new Error('Detached node')
            })

            const observer = createBreakpointObserver({ element: divElement })
            expect(observer.snapshot.width).toBe(0)
            expect(observer.snapshot.height).toBe(0)
            observer.dispose()
        })
    })

    describe('RxJS Streams & Teardown', () => {
        it('emits state updates and deduplicates through distinctUntilChanged', async () => {
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
            const observer = createBreakpointObserver()
            const emittedValues: string[][] = []
            const subscription = observer.activeWidthBreakpoints$.subscribe((keys) => emittedValues.push(keys))
            expect(emittedValues.length).toBe(1)

            // Redundant emission with same active keys
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
            ;(observer as any)._scheduleEmitImmediate()
            await new Promise((resolve) => setTimeout(resolve, 10))
            expect(emittedValues.length).toBe(1)

            // Meaningful dimension transition
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
            ;(observer as any)._scheduleEmitImmediate()
            await new Promise((resolve) => setTimeout(resolve, 10))
            expect(emittedValues.length).toBe(2)
            expect(emittedValues[1]).toContain('expanded')

            subscription.unsubscribe()
            observer.dispose()
        })

        it('subscribes and watches specific breakpoints with unsubscribe cleanup', () => {
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
            const observer = createBreakpointObserver({ widthBreakpoints: { big: '>= 1000px' } })
            const watchValues: boolean[] = []
            const watchSub = observer.watchWidthBreakpoint('>= 1000px').subscribe((matches) => watchValues.push(matches))
            expect(watchValues).toEqual([false])

            Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
            ;(observer as any)._scheduleEmitImmediate()
            expect(watchValues).toEqual([false, true])

            watchSub.unsubscribe()
            observer.dispose()
            expect(observer.isDisposed).toBe(true)
        })

        it('supports takeUntil lifecycle pattern and completes stateSubject on dispose', () => {
            const observer = createBreakpointObserver()
            const destroy$ = new Subject<void>()
            let completeEmitted = false
            observer.state$.pipe(takeUntil(destroy$)).subscribe({
                complete: () => {
                    completeEmitted = true
                },
            })
            destroy$.next()
            destroy$.complete()
            expect(completeEmitted).toBe(true)
            observer.dispose()
        })
    })

    describe('Environment Isolation', () => {
        it('uses defaultWidthMatches and defaultHeightMatches in SSR environment', () => {
            const originalWindow = (globalThis as any).window
            // @ts-ignore
            delete (globalThis as any).window

            const observer = createBreakpointObserver({
                dimension: 'both',
                widthBreakpoints: { w1: '> 500px', w2: '< 500px' },
                heightBreakpoints: { h1: '> 400px' },
                defaultWidthMatches: { w1: true },
                defaultHeightMatches: { h1: true },
            })

            expect(observer.snapshot.width).toBe(0)
            expect(observer.snapshot.height).toBe(0)
            expect(observer.snapshot.activeWidthBreakpoints).toEqual(['w1'])
            expect(observer.snapshot.activeHeightBreakpoints).toEqual(['h1'])
            expect(observer.snapshot.widthMatches).toEqual({ w1: true, w2: false })
            expect(observer.snapshot.heightMatches).toEqual({ h1: true })
            expect(observer.snapshot.matches).toBe(true)

            observer.dispose()
            ;(globalThis as any).window = originalWindow
        })
    })
})

describe('getDefaultViewportObserver', () => {
    describe('Happy Path', () => {
        it('returns shared singleton instance across multiple browser calls', () => {
            const instance1 = getDefaultViewportObserver()
            const instance2 = getDefaultViewportObserver()
            expect(instance1).toBe(instance2)
            expect(instance1.isDisposed).toBe(false)
        })

        it('re-creates singleton if previous instance was disposed', () => {
            const instance1 = getDefaultViewportObserver()
            instance1.dispose()
            const instance2 = getDefaultViewportObserver()
            expect(instance2).not.toBe(instance1)
            expect(instance2.isDisposed).toBe(false)
            instance2.dispose()
        })
    })

    describe('Environment Isolation', () => {
        it('returns isolated instances per call in SSR', () => {
            const originalWindow = (globalThis as any).window
            // @ts-ignore
            delete (globalThis as any).window

            const instance1 = getDefaultViewportObserver()
            const instance2 = getDefaultViewportObserver()
            expect(instance1).not.toBe(instance2)

            instance1.dispose()
            instance2.dispose()
            ;(globalThis as any).window = originalWindow
        })
    })
})

describe('observeBreakpointState', () => {
    describe('Happy Path', () => {
        it('creates cold reactive stream emitting initial snapshot upon subscription', () => {
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
            const state$ = observeBreakpointState({ widthBreakpoints: { compact: '< 600px' } })
            const emissions: any[] = []
            const sub = state$.subscribe((state) => emissions.push(state))
            expect(emissions.length).toBe(1)
            expect(emissions[0].activeWidthBreakpoints).toContain('compact')
            sub.unsubscribe()
        })
    })

    describe('RxJS Streams & Teardown', () => {
        it('automatically tears down internal observer when unsubscribed', () => {
            const state$ = observeBreakpointState()
            const sub1 = state$.subscribe(() => {})
            const sub2 = state$.subscribe(() => {})
            expect(() => {
                sub1.unsubscribe()
                sub2.unsubscribe()
            }).not.toThrow()
        })
    })
})

describe('observeBreakpoint', () => {
    describe('Happy Path', () => {
        it('returns Observable<boolean> matching condition against specified dimension', () => {
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
            Object.defineProperty(window, 'innerHeight', { writable: true, value: 300 })

            const isMedium$ = observeBreakpoint('>= 600px')
            const emittedValues: boolean[] = []
            const sub = isMedium$.subscribe((val) => emittedValues.push(val))
            expect(emittedValues).toEqual([true])
            sub.unsubscribe()

            const isCompactHeight$ = observeBreakpoint('< 480px', 'height')
            const heightEmissions: boolean[] = []
            const heightSub = isCompactHeight$.subscribe((val) => heightEmissions.push(val))
            expect(heightEmissions).toEqual([true])
            heightSub.unsubscribe()

            const matchesEither$ = observeBreakpoint('< 500px', 'both')
            const eitherEmissions: boolean[] = []
            const eitherSub = matchesEither$.subscribe((val) => eitherEmissions.push(val))
            expect(eitherEmissions).toEqual([true])
            eitherSub.unsubscribe()
        })
    })

    describe('RxJS Streams & Teardown', () => {
        it('cleans up stream on unsubscription', () => {
            const stream$ = observeBreakpoint('>= 600px')
            const sub = stream$.subscribe(() => {})
            expect(() => sub.unsubscribe()).not.toThrow()
        })
    })
})

describe('observeWidthBreakpoint & observeHeightBreakpoint', () => {
    describe('Happy Path', () => {
        it('observes width and height definitions respectively', () => {
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
            Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })

            const width$ = observeWidthBreakpoint('>= 600px')
            const widthValues: boolean[] = []
            const widthSub = width$.subscribe((val) => widthValues.push(val))
            expect(widthValues).toEqual([true])
            widthSub.unsubscribe()

            const height$ = observeHeightBreakpoint('>= 900px')
            const heightValues: boolean[] = []
            const heightSub = height$.subscribe((val) => heightValues.push(val))
            expect(heightValues).toEqual([false])
            heightSub.unsubscribe()
        })
    })

    describe('RxJS Streams & Teardown', () => {
        it('cleans up stream on unsubscription', () => {
            const width$ = observeWidthBreakpoint('>= 600px')
            const sub = width$.subscribe(() => {})
            expect(() => sub.unsubscribe()).not.toThrow()
        })
    })
})

describe('observeActiveBreakpoints & observeActiveWidthBreakpoints & observeActiveHeightBreakpoints', () => {
    describe('Happy Path', () => {
        it('observes active breakpoint key arrays across dimensions', () => {
            Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
            Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })

            const activeWidth$ = observeActiveWidthBreakpoints()
            const widthKeys: string[][] = []
            const widthSub = activeWidth$.subscribe((keys) => widthKeys.push(keys))
            expect(widthKeys[0]).toContain('medium')
            widthSub.unsubscribe()

            const activeHeight$ = observeActiveHeightBreakpoints()
            const heightKeys: string[][] = []
            const heightSub = activeHeight$.subscribe((keys) => heightKeys.push(keys))
            expect(heightKeys[0]).toContain('medium')
            heightSub.unsubscribe()

            const activeBoth$ = observeActiveBreakpoints('both')
            const bothKeys: string[][] = []
            const bothSub = activeBoth$.subscribe((keys) => bothKeys.push(keys))
            expect(bothKeys[0]).toContain('medium')
            bothSub.unsubscribe()
        })
    })

    describe('RxJS Streams & Teardown', () => {
        it('cleans up stream on unsubscription', () => {
            const active$ = observeActiveBreakpoints()
            const sub = active$.subscribe(() => {})
            expect(() => sub.unsubscribe()).not.toThrow()
        })
    })
})
