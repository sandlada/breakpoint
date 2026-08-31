import { Subject, takeUntil } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
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
import { isShallowEqualArray } from './rx.js'

describe('parseBreakpointCondition / matchesBreakpointCondition', () => {
    it('parses all operators', () => {
        expect(parseBreakpointCondition('> 840px')).toEqual({ operator: '>', targetValue: 840, unit: 'px' })
        expect(parseBreakpointCondition('>= 640px')).toEqual({ operator: '>=', targetValue: 640, unit: 'px' })
        expect(parseBreakpointCondition('< 1200px')).toEqual({ operator: '<', targetValue: 1200, unit: 'px' })
        expect(parseBreakpointCondition('<= 960px')).toEqual({ operator: '<=', targetValue: 960, unit: 'px' })
        expect(parseBreakpointCondition('= 1600px')).toEqual({ operator: '=', targetValue: 1600, unit: 'px' })
        expect(parseBreakpointCondition('== 1600px')).toEqual({ operator: '==', targetValue: 1600, unit: 'px' })
        expect(parseBreakpointCondition('!= 960px')).toEqual({ operator: '!=', targetValue: 960, unit: 'px' })
        expect(parseBreakpointCondition('>840')).toEqual({ operator: '>', targetValue: 840, unit: 'px' })
        expect(parseBreakpointCondition('>= 600.5px')).toEqual({ operator: '>=', targetValue: 600.5, unit: 'px' })
        expect(() => parseBreakpointCondition('invalid')).toThrow(TypeError)
    })

    it('supports numbers with omitted leading zero (.5rem, .75em, .5px)', () => {
        expect(parseBreakpointCondition('>= .5rem')).toEqual({ operator: '>=', targetValue: 0.5, unit: 'rem' })
        expect(parseBreakpointCondition('< .75em')).toEqual({ operator: '<', targetValue: 0.75, unit: 'em' })
        expect(parseBreakpointCondition('>= .5px')).toEqual({ operator: '>=', targetValue: 0.5, unit: 'px' })
        expect(parseBreakpointCondition('!= .25')).toEqual({ operator: '!=', targetValue: 0.25, unit: 'px' })
        expect(matchesBreakpointCondition(16, '>= .5rem')).toBe(true)
        expect(matchesBreakpointCondition(7, '>= .5rem')).toBe(false)
        expect(matchesBreakpointCondition(8, '>= .5rem')).toBe(true)
    })

    it('matchesBreakpointCondition edges and currying', () => {
        expect(matchesBreakpointCondition(1600, '= 1600px')).toBe(true)
        expect(matchesBreakpointCondition(1599, '= 1600px')).toBe(false)
        expect(matchesBreakpointCondition(1600, '== 1600px')).toBe(true)
        expect(matchesBreakpointCondition(960, '!= 960px')).toBe(false)
        expect(matchesBreakpointCondition(961, '!= 960px')).toBe(true)
        expect(matchesBreakpointCondition(840, '> 840px')).toBe(false)
        expect(matchesBreakpointCondition(841, '> 840px')).toBe(true)
        expect(matchesBreakpointCondition(840, '>= 840px')).toBe(true)
        expect(matchesBreakpointCondition(839, '>= 840px')).toBe(false)
        // curried data-last pattern
        const isGreaterThan840 = matchesBreakpointCondition('> 840px')
        expect(isGreaterThan840(840)).toBe(false)
        expect(isGreaterThan840(841)).toBe(true)
    })
})

describe('matchesBreakpointDefinition', () => {
    it('explicit and/or and currying', () => {
        expect(matchesBreakpointDefinition(900, { and: ['> 840px', '< 1200px'] })).toBe(true)
        expect(matchesBreakpointDefinition(840, { and: ['> 840px', '< 1200px'] })).toBe(false)
        expect(matchesBreakpointDefinition(1200, { and: ['> 840px', '< 1200px'] })).toBe(false)
        expect(matchesBreakpointDefinition(960, { and: ['> 840px', '< 1200px', '!= 960px'] })).toBe(false)
        expect(matchesBreakpointDefinition(961, { and: ['> 840px', '< 1200px', '!= 960px'] })).toBe(true)
        // curried
        const isRange = matchesBreakpointDefinition({ and: ['> 840px', '< 1200px'] })
        expect(isRange(900)).toBe(true)
        expect(isRange(840)).toBe(false)
    })

    it('or logic', () => {
        const definition = { or: ['< 840px', '> 1600px'] }
        expect(matchesBreakpointDefinition(839, definition)).toBe(true)
        expect(matchesBreakpointDefinition(840, definition)).toBe(false)
        expect(matchesBreakpointDefinition(1600, definition)).toBe(false)
        expect(matchesBreakpointDefinition(1601, definition)).toBe(true)
        expect(matchesBreakpointDefinition(1000, definition)).toBe(false)
    })

    it('and explicit', () => {
        expect(matchesBreakpointDefinition(1000, { and: ['> 840px', '< 1200px', '!= 960px'] })).toBe(true)
        expect(matchesBreakpointDefinition(960, { and: ['> 840px', '< 1200px', '!= 960px'] })).toBe(false)
    })

    it('object min/max default left-closed right-open [min, max)', () => {
        expect(matchesBreakpointDefinition(700, { min: 600, max: 960 })).toBe(true)
        expect(matchesBreakpointDefinition(600, { min: 600, max: 960 })).toBe(true)
        expect(matchesBreakpointDefinition(599.9, { min: 600, max: 960 })).toBe(false)
        expect(matchesBreakpointDefinition(960, { min: 600, max: 960 })).toBe(false) // default maxInclusive: false
        expect(matchesBreakpointDefinition(960, { min: 600, max: 960, maxInclusive: true })).toBe(true)
        expect(matchesBreakpointDefinition(600, { min: 600, minInclusive: false })).toBe(false)
        expect(matchesBreakpointDefinition(600.1, { min: 600, minInclusive: false })).toBe(true)
        expect(matchesBreakpointDefinition(600, { eq: 600 })).toBe(true)
        expect(matchesBreakpointDefinition(601, { ne: 600 })).toBe(true)
        expect(matchesBreakpointDefinition(600, { ne: 600 })).toBe(false)

        // Equivalence with createBreakpointInterval
        const intervalDef = createBreakpointInterval(600, 840)
        const rangeDef = { min: 600, max: 840 }
        expect(matchesBreakpointDefinition(intervalDef, 840)).toBe(false)
        expect(matchesBreakpointDefinition(rangeDef, 840)).toBe(false)
        expect(matchesBreakpointDefinition(intervalDef, 600)).toBe(true)
        expect(matchesBreakpointDefinition(rangeDef, 600)).toBe(true)
    })
})

describe('evaluateBreakpointMap overlap', () => {
    it('overlap a/b', () => {
        const breakpointMap = { a: { and: ['> 600px', '< 960px'] }, b: { and: ['> 840px', '< 1200px'] } }
        expect(evaluateBreakpointMap(breakpointMap, 900).activeBreakpoints).toEqual(['a', 'b'])
        expect(evaluateBreakpointMap(breakpointMap)(960).activeBreakpoints).toEqual(['b'])
        expect(evaluateBreakpointMap(breakpointMap, 500).activeBreakpoints).toEqual([])
        expect(evaluateBreakpointMap(breakpointMap, 700).activeBreakpoints).toEqual(['a'])
        expect(evaluateBreakpointMap(breakpointMap, 1000).activeBreakpoints).toEqual(['b'])
    })
})

describe('createBreakpointObserver — viewport & state$', () => {
    const originalInnerWidth = window.innerWidth
    const originalInnerHeight = window.innerHeight

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: originalInnerWidth })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: originalInnerHeight })
        vi.restoreAllMocks()
    })

    it('initial active from window width', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const observer = createBreakpointObserver()
        expect(observer.snapshot.activeWidthBreakpoints).toContain('medium')
        expect(observer.snapshot.width).toBe(700)
        observer.dispose()
    })

    it('activeWidthBreakpoints$ distinctUntilChanged via isShallowEqualArray', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const observer = createBreakpointObserver()
        const emittedValues: string[][] = []
        const subscription = observer.activeWidthBreakpoints$.subscribe((value) => emittedValues.push(value))
        expect(emittedValues.length).toBe(1)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
            ; (observer as any)._scheduleEmitImmediate()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(emittedValues.length).toBe(1)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
            ; (observer as any)._scheduleEmitImmediate()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(emittedValues.length).toBe(2)
        expect(emittedValues[1]).toContain('expanded')
        subscription.unsubscribe()
        observer.dispose()
    })

    it('state$ shareReplay(1) multicast', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const observer = createBreakpointObserver()
        const firstValues: any[] = []
        const secondValues: any[] = []
        const subscription1 = observer.state$.subscribe((value) => firstValues.push(value))
        const subscription2 = observer.state$.subscribe((value) => secondValues.push(value))
        expect(firstValues[0]).toEqual(secondValues[0])
        expect(firstValues[0].activeWidthBreakpoints).toContain('compact')
        subscription1.unsubscribe()
        subscription2.unsubscribe()
        observer.dispose()
    })

    it('takeUntil destroy pattern', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const observer = createBreakpointObserver()
        const destroy$ = new Subject<void>()
        const values: any[] = []
        observer.state$.pipe(takeUntil(destroy$)).subscribe((value) => values.push(value))
        expect(values.length).toBe(1)
        destroy$.next()
        destroy$.complete()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
            ; (observer as any)._scheduleEmitImmediate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(values.length).toBe(1)
        observer.dispose()
    })

    it('subscribe returns unsubscribe', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        const callbackMock = vi.fn()
        const unsubscribe = observer.subscribeWidthBreakpoint('> 840px', callbackMock)
        expect(typeof unsubscribe).toBe('function')
        expect(callbackMock).toHaveBeenCalled()
        const callCount = callbackMock.mock.calls.length
        unsubscribe()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
            ; (observer as any)._scheduleEmitImmediate()
        expect(callbackMock.mock.calls.length).toBe(callCount)
        observer.dispose()
    })

    it('watch filtered boolean', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const observer = createBreakpointObserver({ widthBreakpoints: { big: '>= 1000px' } })
        const values: boolean[] = []
        const subscription = observer.watchWidthBreakpoint('>= 1000px').subscribe((value) => values.push(value))
        expect(values.length).toBe(1)
        expect(values[0]).toBe(false)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
            ; (observer as any)._scheduleEmitImmediate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(values.length).toBe(2)
        expect(values[1]).toBe(true)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
            ; (observer as any)._scheduleEmitImmediate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(values.length).toBe(3)
        expect(values[2]).toBe(false)
        subscription.unsubscribe()
        observer.dispose()
    })

    it('dimension both independent', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const observer = createBreakpointObserver({ dimension: 'both' })
        expect(observer.snapshot.activeWidthBreakpoints).toContain('expanded')
        expect(observer.snapshot.activeHeightBreakpoints).toContain('medium')
        expect(observer.snapshot.primaryWidthBreakpoint).toBe('expanded')
        expect(observer.snapshot.primaryHeightBreakpoint).toBe('medium')
        expect(observer.getPrimaryWidthBreakpoint()).toBe('expanded')
        expect(observer.getPrimaryHeightBreakpoint()).toBe('medium')
        expect(observer.snapshot.widthMatches.expanded).toBe(true)
        expect(observer.snapshot.heightMatches.medium).toBe(true)
        expect(observer.snapshot.height).toBe(500)

        const widthValues: string[][] = []
        const heightValues: string[][] = []
        const subscriptionWidth = observer.activeWidthBreakpoints$.subscribe((value) => widthValues.push(value))
        const subscriptionHeight = observer.activeHeightBreakpoints$.subscribe((value) => heightValues.push(value))
        expect(widthValues.length).toBe(1)
        expect(heightValues.length).toBe(1)
        subscriptionWidth.unsubscribe()
        subscriptionHeight.unsubscribe()
        observer.dispose()
    })

    it('hasBreakpoint / matchesBreakpoint', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: { and: ['> 840px', '< 1200px'] } } })
        expect(observer.matchesWidthBreakpoint('> 840px')).toBe(true)
        expect(observer.matchesWidthBreakpoint('< 840px')).toBe(false)
        expect(observer.matchesWidthBreakpoint({ and: ['> 840px', '< 1200px'] })).toBe(true)
        expect(observer.matchesWidthBreakpoint({ or: ['< 840px', '> 1600px'] })).toBe(false)
        expect(observer.hasWidthBreakpoint('a')).toBe(true)
        expect(observer.hasBreakpoint('a')).toBe(true)
        expect(observer.hasBreakpoint('nonexistent')).toBe(false)
        observer.dispose()
    })

    it('snapshot primaryWidthBreakpoint', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const observer = createBreakpointObserver()
        expect(observer.snapshot.primaryWidthBreakpoint).toBe('medium')
        expect(observer.getPrimaryWidthBreakpoint()).toBe('medium')
        observer.dispose()
    })

    it('dispose completes and cleans', () => {
        const observer = createBreakpointObserver()
        const completedMock = vi.fn()
        observer.state$.subscribe({ complete: completedMock })
        observer.dispose()
        expect(completedMock).toHaveBeenCalled()
        observer.dispose()
    })
})

describe('element strategy', () => {
    it('attachElement dynamic switch', async () => {
        const divElement1 = document.createElement('div')
        const divElement2 = document.createElement('div')
        vi.spyOn(divElement1, 'getBoundingClientRect').mockReturnValue({ width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect)
        vi.spyOn(divElement2, 'getBoundingClientRect').mockReturnValue({ width: 1700, height: 300, top: 0, left: 0, right: 1700, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect)

        const observer = createBreakpointObserver({
            element: divElement1,
            widthBreakpoints: { extreme: { or: ['< 840px', '> 1600px'] } },
        })
        expect(observer.snapshot.activeWidthBreakpoints).toContain('extreme')
        expect(observer.attachedElement).toBe(divElement1)

        observer.attachElement(divElement2)
        expect(observer.attachedElement).toBe(divElement2)
        expect(observer.snapshot.activeWidthBreakpoints).toContain('extreme')

        observer.attachElement(null)
        expect(observer.attachedElement).toBe(null)

        observer.dispose()
    })

    it('detachElement', () => {
        const divElement = document.createElement('div')
        vi.spyOn(divElement, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => { } } as DOMRect)
        const observer = createBreakpointObserver({ element: divElement })
        expect(observer.attachedElement).toBe(divElement)
        observer.detachElement()
        expect(observer.attachedElement).toBe(null)
        observer.dispose()
    })

    it('ResizeObserver triggers on rAF', async () => {
        const divElement = document.createElement('div')
        let width = 500
        vi.spyOn(divElement, 'getBoundingClientRect').mockImplementation(() => ({ width, height: 300, top: 0, left: 0, right: width, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect))
        const observer = createBreakpointObserver({ element: divElement, widthBreakpoints: { a: '> 600px' } })
        expect(observer.snapshot.activeWidthBreakpoints).toEqual([])

        width = 800
            ; (observer as any)._scheduleEmitImmediate()
        expect(observer.snapshot.activeWidthBreakpoints).toEqual(['a'])
        observer.dispose()
    })
})

describe('SSR defaultWidthMatches', () => {
    it('uses defaultWidthMatches when window undefined', () => {
        const originalWindow = globalThis.window
        // @ts-ignore
        delete (globalThis as any).window
        const observer = createBreakpointObserver({
            widthBreakpoints: { a: '> 840px', b: '< 600px' },
            defaultWidthMatches: { a: true, b: false },
        })
        expect(observer.snapshot.widthMatches['a']).toBe(true)
        expect(observer.snapshot.activeWidthBreakpoints).toContain('a')
        expect(observer.snapshot.width).toBe(0)
        observer.dispose()
            ; (globalThis as any).window = originalWindow
    })
})

describe('media query generation with step and BreakpointRange', () => {
    it('converts condition != to CSS MQ4 not (dimension: value)', () => {
        expect(convertConditionToMediaQuery('!= 800px', 'width', 0.05)).toBe('not (width: 800px)')
        expect(convertConditionToMediaQuery('!= 500px', 'height', 0.05)).toBe('not (height: 500px)')
        const compound = convertDefinitionToMediaQuery({ and: ['>= 600px', '!= 800px'] }, 'width', 0.05)
        expect(compound).toBe('(min-width: 600px) and not (width: 800px)')
    })

    it('clamps < 0px to max 0px to prevent negative lengths', () => {
        expect(convertConditionToMediaQuery('< 0px', 'width', 0.05)).toBe('(max-width: 0px)')
        expect(convertConditionToMediaQuery('< 0.02px', 'width', 0.05)).toBe('(max-width: 0px)')
        expect(convertConditionToMediaQuery('< 0rem', 'width', 0.05)).toBeNull()
    })

    it('converts BreakpointRange objects to media queries', () => {
        expect(convertDefinitionToMediaQuery({ min: 600, max: 840 }, 'width', 0.05)).toBe(
            '(min-width: 600px) and (max-width: 839.95px)',
        )
        expect(convertDefinitionToMediaQuery({ min: 600, max: 840, minInclusive: false, maxInclusive: true }, 'width', 0.05)).toBe(
            '(min-width: 600.05px) and (max-width: 840px)',
        )
        expect(convertDefinitionToMediaQuery({ eq: 800 }, 'width', 0.05)).toBe('(width: 800px)')
        expect(convertDefinitionToMediaQuery({ ne: 800 }, 'width', 0.05)).toBe('not (width: 800px)')
        expect(convertDefinitionToMediaQuery({ min: 600 }, 'width', 0.05)).toBe('(min-width: 600px)')
        expect(convertDefinitionToMediaQuery({ max: 840 }, 'width', 0.05)).toBe('(max-width: 839.95px)')
        expect(convertDefinitionToMediaQuery({ max: 0 }, 'width', 0.05)).toBe('(max-width: 0px)')
        expect(convertDefinitionToMediaQuery({} as any, 'width', 0.05)).toBeNull()
    })

    it('viewport uses matchMedia for expressible queries including BreakpointRange', () => {
        const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia })
        const observer = createBreakpointObserver({
            widthBreakpoints: { a: '> 840px', b: '< 1200px', c: { min: 600, max: 840 } },
        })
        expect(mockMatchMedia).toHaveBeenCalled()
        const calls = mockMatchMedia.mock.calls.map((call) => call[0] as string)
        expect(calls.some((query) => query.includes('840.05'))).toBe(true)
        expect(calls.some((query) => query.includes('1199.95'))).toBe(true)
        expect(calls.some((query) => query.includes('(min-width: 600px) and (max-width: 839.95px)'))).toBe(true)
        observer.dispose()
    })
})

describe('full units — parse & matches', () => {
    it('parseBreakpointCondition full units', () => {
        expect(parseBreakpointCondition('> 10vw')).toEqual({ operator: '>', targetValue: 10, unit: 'vw' })
        expect(parseBreakpointCondition('>= 50vh')).toEqual({ operator: '>=', targetValue: 50, unit: 'vh' })
        expect(parseBreakpointCondition('< 5em')).toEqual({ operator: '<', targetValue: 5, unit: 'em' })
        expect(parseBreakpointCondition('<= 1cm')).toEqual({ operator: '<=', targetValue: 1, unit: 'cm' })
        expect(parseBreakpointCondition('= 10%')).toEqual({ operator: '=', targetValue: 10, unit: '%' })
        expect(parseBreakpointCondition('!= 2ex')).toEqual({ operator: '!=', targetValue: 2, unit: 'ex' })
        expect(parseBreakpointCondition('> 10CM')).toEqual({ operator: '>', targetValue: 10, unit: 'cm' })
    })

    it('matchesBreakpointCondition rem & em independent', () => {
        expect(matchesBreakpointCondition(32, '>= 2rem')).toBe(true)
        expect(matchesBreakpointCondition(31, '>= 2rem')).toBe(false)
        expect(matchesBreakpointCondition(32, '>= 2rem', { remBase: 16, emBase: 20 })).toBe(true)
        expect(matchesBreakpointCondition(40, '>= 2em', { remBase: 16, emBase: 20 })).toBe(true)
        expect(matchesBreakpointCondition(39, '>= 2em', { remBase: 16, emBase: 20 })).toBe(false)
        expect(matchesBreakpointCondition(32, '>= 2em', { remBase: 16, emBase: 16 })).toBe(true)
        expect(matchesBreakpointCondition(40, '>= 2rem', { remBase: 20, emBase: 16 })).toBe(true)
        expect(matchesBreakpointCondition(32, '>= 2rem', { remBase: 20, emBase: 16 })).toBe(false)
    })

    it('matchesBreakpointCondition absolute units', () => {
        expect(matchesBreakpointCondition(96, '>= 1in')).toBe(true)
        expect(matchesBreakpointCondition(95, '>= 1in')).toBe(false)
        expect(matchesBreakpointCondition(38, '>= 1cm')).toBe(true)
        expect(matchesBreakpointCondition(16, '>= 1pc')).toBe(true)
        expect(matchesBreakpointCondition(3.8, '>= 1mm')).toBe(true)
    })

    it('matchesBreakpointCondition viewport units', () => {
        const originalWidth = window.innerWidth
        const originalHeight = window.innerHeight
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1000 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 })
        expect(matchesBreakpointCondition(100, '>= 10vw')).toBe(true)
        expect(matchesBreakpointCondition(99, '>= 10vw')).toBe(false)
        expect(matchesBreakpointCondition(80, '>= 10vh')).toBe(true)
        expect(matchesBreakpointCondition(79, '>= 10vh')).toBe(false)
        expect(matchesBreakpointCondition(80, '>= 10vmin')).toBe(true)
        expect(matchesBreakpointCondition(100, '>= 10vmax')).toBe(true)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: originalWidth })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: originalHeight })
    })

    it('matchesBreakpointCondition non-convertible units return false numeric', () => {
        expect(matchesBreakpointCondition(100, '>= 10%')).toBe(false)
        expect(matchesBreakpointCondition(100, '>= 2ex')).toBe(false)
        expect(matchesBreakpointCondition(100, '>= 2ch')).toBe(false)
    })

    it('evaluateBreakpointMap with emBase', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        expect(evaluateBreakpointMap({ a: '>= 2em' }, 40, { remBase: 16, emBase: 20 }).activeBreakpoints).toContain('a')
        expect(evaluateBreakpointMap({ a: '>= 2em' }, 39, { remBase: 16, emBase: 20 }).activeBreakpoints).not.toContain('a')
    })
})

describe('createBreakpointObserver — full units observer', () => {
    afterEach(() => vi.restoreAllMocks())

    it('remBase and emBase independent in observer', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 40 })
        const observerRem = createBreakpointObserver({ widthBreakpoints: { a: '>= 2rem' }, remBase: 16, emBase: 20 })
        expect(observerRem.snapshot.activeWidthBreakpoints).toContain('a')
        observerRem.dispose()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 39 })
        const observerEm = createBreakpointObserver({ widthBreakpoints: { a: '>= 2em' }, remBase: 16, emBase: 20 })
        expect(observerEm.snapshot.activeWidthBreakpoints).not.toContain('a')
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 40 })
        const observerEm2 = createBreakpointObserver({ widthBreakpoints: { a: '>= 2em' }, remBase: 16, emBase: 20 })
        expect(observerEm2.snapshot.activeWidthBreakpoints).toContain('a')
        observerEm.dispose()
        observerEm2.dispose()
    })

    it('absolute unit in observer', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 96 })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '>= 1in' } })
        expect(observer.snapshot.activeWidthBreakpoints).toContain('a')
        observer.dispose()
    })
})

describe('dimension both & height — has/matches', () => {
    afterEach(() => vi.restoreAllMocks())

    it('both: has height key and matches condition', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        const observer = createBreakpointObserver({ dimension: 'both', heightBreakpoints: { h: '< 480px' } })
        expect(observer.hasWidthBreakpoint('h')).toBe(false)
        expect(observer.hasHeightBreakpoint('h')).toBe(true)
        expect(observer.hasBreakpoint('h', 'both')).toBe(true)
        expect(observer.matchesWidthBreakpoint('< 480px')).toBe(false)
        expect(observer.matchesHeightBreakpoint('< 480px')).toBe(true)
        expect(observer.matchesBreakpoint('< 840px', 'height')).toBe(true)
        expect(observer.matchesBreakpoint('< 840px', 'both')).toBe(true)
        expect(observer.matchesWidthBreakpoint('< 840px')).toBe(false)
        observer.dispose()
    })

    it('height dimension isolated', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const observer = createBreakpointObserver({ dimension: 'height', heightBreakpoints: { m: { and: ['>= 480px', '< 900px'] } } })
        expect(observer.snapshot.activeWidthBreakpoints).toEqual([])
        expect(observer.snapshot.activeHeightBreakpoints).toContain('m')
        expect(observer.snapshot.height).toBe(500)
        expect(observer.matchesHeightBreakpoint('>= 480px')).toBe(true)
        observer.dispose()
    })

    it('activeHeightBreakpoints$ distinct', async () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        const observer = createBreakpointObserver({ dimension: 'both' })
        const values: string[][] = []
        const subscription = observer.activeHeightBreakpoints$.subscribe((value) => values.push(value))
        expect(values.length).toBe(1)
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
            ; (observer as any)._scheduleEmitImmediate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(values.length).toBe(1)
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 900 })
            ; (observer as any)._scheduleEmitImmediate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(values.length).toBe(2)
        subscription.unsubscribe()
        observer.dispose()
    })
})

describe('watch reversal', () => {
    afterEach(() => vi.restoreAllMocks())

    it('watch emits boolean on enter and leave, dedup', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '>= 1000px' } })
        const values: boolean[] = []
        const unsubscribe = observer.subscribeWidthBreakpoint('>= 1000px', () => { })
        const subscription = observer.watchWidthBreakpoint('>= 1000px').subscribe((value) => values.push(value))
        expect(values.length).toBe(1)
        expect(values[0]).toBe(false)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 600 })
            ; (observer as any)._scheduleEmitImmediate()
        expect(values.length).toBe(1)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
            ; (observer as any)._scheduleEmitImmediate()
        expect(values.length).toBe(2)
        expect(values[1]).toBe(true)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1300 })
            ; (observer as any)._scheduleEmitImmediate()
        expect(values.length).toBe(2)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
            ; (observer as any)._scheduleEmitImmediate()
        expect(values.length).toBe(3)
        expect(values[2]).toBe(false)
        unsubscribe()
        subscription.unsubscribe()
        observer.dispose()
    })

    it('watch with and/or', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        const values: boolean[] = []
        const subscription = observer.watchWidthBreakpoint({ and: ['> 840px', '< 1200px'] }).subscribe((value) => values.push(value))
        expect(values.length).toBe(1)
        expect(values[0]).toBe(true)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1300 })
            ; (observer as any)._scheduleEmitImmediate()
        expect(values.length).toBe(2)
        expect(values[1]).toBe(false)
        subscription.unsubscribe()
        observer.dispose()
    })
})

describe('SSR — empty hit and both', () => {
    it('SSR without defaultWidthMatches empty hit', () => {
        const originalWindow = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '> 840px', b: '< 600px' } })
        expect(observer.snapshot.activeWidthBreakpoints).toEqual([])
        expect(observer.snapshot.widthMatches).toEqual({ a: false, b: false })
        expect(observer.snapshot.width).toBe(0)
        observer.dispose()
            ; (globalThis as any).window = originalWindow
    })

    it('SSR both dimension empty', () => {
        const originalWindow = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const observer = createBreakpointObserver({ dimension: 'both' })
        expect(observer.snapshot.activeWidthBreakpoints).toEqual([])
        expect(observer.snapshot.activeHeightBreakpoints).toEqual([])
        observer.dispose()
            ; (globalThis as any).window = originalWindow
    })

    it('SSR defaultHeightMatches', () => {
        const originalWindow = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const observer = createBreakpointObserver({ dimension: 'height', heightBreakpoints: { h: '< 480px' }, defaultHeightMatches: { h: true } })
        expect(observer.snapshot.activeHeightBreakpoints).toContain('h')
        observer.dispose()
            ; (globalThis as any).window = originalWindow
    })

    it('SSR with element still empty', () => {
        const originalWindow = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const divElement = { getBoundingClientRect: () => ({ width: 500, height: 500 } as DOMRect) } as unknown as HTMLElement
        const observer = createBreakpointObserver({ element: divElement })
        expect(observer.snapshot.width).toBe(0)
        observer.dispose()
            ; (globalThis as any).window = originalWindow
    })
})

describe('freeze & singleton', () => {
    it('snapshot frozen', () => {
        const observer = createBreakpointObserver()
        expect(Object.isFrozen(observer.snapshot.activeWidthBreakpoints)).toBe(true)
        expect(Object.isFrozen(observer.snapshot.widthMatches)).toBe(true)
        expect(Object.isFrozen(observer.snapshot.heightMatches)).toBe(true)
        expect(() => (observer.snapshot.activeWidthBreakpoints as string[]).push('x')).toThrow()
        observer.dispose()
    })

    it('activeHeight frozen', () => {
        const observer = createBreakpointObserver({ dimension: 'both' })
        expect(Object.isFrozen(observer.snapshot.activeHeightBreakpoints)).toBe(true)
        observer.dispose()
    })

    it('default breakpoints defined', () => {
        expect(DEFAULT_WIDTH_BREAKPOINTS).toBeDefined()
        expect(DEFAULT_HEIGHT_BREAKPOINTS).toBeDefined()
    })

    it('singleton same in browser environment', () => {
        expect(getDefaultViewportObserver()).toBe(getDefaultViewportObserver())
    })

    it('getDefaultViewportObserver returns fresh isolated instance per call in SSR', () => {
        const originalWindow = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const first = getDefaultViewportObserver()
        const second = getDefaultViewportObserver()
        expect(first).not.toBe(second)
        first.dispose()
        second.dispose()
        ;(globalThis as any).window = originalWindow
    })
})

describe('rAF coalescing & ResizeObserver fallback', () => {
    it('rAF dedup — two scheduleEmit only one next', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '> 600px' } })
        const values: string[][] = []
        const subscription = observer.state$.subscribe((state) => values.push(state.activeWidthBreakpoints))
        const initialCount = values.length
            ; (observer as any)._scheduleEmit()
            ; (observer as any)._scheduleEmit()
        expect((observer as any)._rafId).not.toBeNull()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(values.length).toBe(initialCount + 1)
        subscription.unsubscribe()
        observer.dispose()
    })

    it('fallback to resize when RO missing', () => {
        const originalResizeObserver = (window as unknown as { ResizeObserver?: unknown }).ResizeObserver
        // @ts-ignore
        delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver
        const addListenerSpy = vi.spyOn(window, 'addEventListener')
        const divElement = document.createElement('div')
        vi.spyOn(divElement, 'getBoundingClientRect').mockReturnValue({ width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect)
        const observer = createBreakpointObserver({ element: divElement })
        expect(addListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        expect((observer as any)._elementResizeHandler).not.toBeNull()
        observer.dispose()
        expect((observer as any)._elementResizeHandler).toBeNull()
        addListenerSpy.mockRestore()
            ; (window as unknown as { ResizeObserver: unknown }).ResizeObserver = originalResizeObserver as unknown as typeof ResizeObserver
    })

    it('attachElement null back to viewport', () => {
        const divElement = document.createElement('div')
        vi.spyOn(divElement, 'getBoundingClientRect').mockReturnValue({ width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect)
        const observer = createBreakpointObserver({ element: divElement })
        expect(observer.attachedElement).toBe(divElement)
        observer.attachElement(null)
        expect(observer.attachedElement).toBe(null)
        expect((observer as any)._viewportResizeHandler).not.toBeNull()
        observer.dispose()
    })
})

describe('media query — advanced', () => {
    it('or comma join and != inline negation', () => {
        const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia })
        const observer = createBreakpointObserver({ widthBreakpoints: { ext: { or: ['< 840px', '> 1600px'] }, c: '!= 960px' } })
        const calls = mockMatchMedia.mock.calls.map((call) => call[0] as string)
        expect(calls.some((query) => query.includes(', '))).toBe(true)
        expect(calls.some((query) => query.includes('not (width: 960px)'))).toBe(true)
        observer.dispose()
    })

    it('and join', () => {
        const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: { and: ['> 840px', '< 1200px'] } } })
        const calls = mockMatchMedia.mock.calls.map((call) => call[0] as string)
        expect(calls[0]).toContain(' and ')
        observer.dispose()
    })

    it('mql+resize mixed for step gap', () => {
        const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia })
        const addListenerSpy = vi.spyOn(window, 'addEventListener')
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        expect(mockMatchMedia).toHaveBeenCalled()
        expect(addListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        observer.dispose()
        addListenerSpy.mockRestore()
    })

    it('legacy addListener fallback', () => {
        const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        expect(mockMatchMedia).toHaveBeenCalled()
        const mediaQueryList = mockMatchMedia.mock.results[0]!.value as { addListener: ReturnType<typeof vi.fn> }
        expect(mediaQueryList.addListener).toHaveBeenCalled()
        observer.dispose()
    })

    it('step gap 840.01 — resize covers mql gap', async () => {
        const originalWidth = window.innerWidth
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 840 })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        expect(observer.snapshot.activeWidthBreakpoints).not.toContain('a')
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 840.01 })
            ; (observer as any)._scheduleEmitImmediate()
        expect(observer.snapshot.activeWidthBreakpoints).toContain('a')
        Object.defineProperty(window, 'innerWidth', { writable: true, value: originalWidth })
        observer.dispose()
    })

    it('custom mediaQueryExclusiveStep', () => {
        const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia })
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '> 840px' }, mediaQueryExclusiveStep: 0.1 })
        const calls = mockMatchMedia.mock.calls.map((call) => call[0] as string)
        expect(calls[0]).toContain('840.1')
        observer.dispose()
    })
})

describe('edge — object empty throw & unsupported unit', () => {
    it('empty object throws', () => {
        expect(() => matchesBreakpointDefinition(100, {} as any)).toThrow(TypeError)
    })

    it('unsupported unit % returns false numeric and falls back to resize', () => {
        expect(matchesBreakpointCondition(100, '>= 10%')).toBe(false)
        const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMatchMedia })
        const addListenerSpy = vi.spyOn(window, 'addEventListener')
        const observer = createBreakpointObserver({ widthBreakpoints: { a: '>= 10%' } })
        expect(mockMatchMedia).not.toHaveBeenCalled()
        expect(addListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        observer.dispose()
        addListenerSpy.mockRestore()
    })
})

describe('isShallowEqualArray', () => {
    it('true for same arrays', () => {
        expect(isShallowEqualArray(['a', 'b'], ['a', 'b'])).toBe(true)
        expect(isShallowEqualArray(['a'], ['b'])).toBe(false)
        expect(isShallowEqualArray(['a'], ['a', 'b'])).toBe(false)
    })
})

describe('standalone reactive streams', () => {
    it('observeBreakpointState observes changes and cleans up on unsubscription', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const state$ = observeBreakpointState({ widthBreakpoints: { compact: '< 600px', expanded: '>= 600px' } })
        const emittedStates: any[] = []
        const subscription = state$.subscribe((state) => emittedStates.push(state))
        expect(emittedStates.length).toBe(1)
        expect(emittedStates[0].activeWidthBreakpoints).toContain('compact')
        subscription.unsubscribe()
    })

    it('observeBreakpoint directly returns Observable<boolean> and matches', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const isMedium$ = observeBreakpoint('>= 600px')
        const emittedValues: boolean[] = []
        const subscription = isMedium$.subscribe((matches) => emittedValues.push(matches))
        expect(emittedValues).toEqual([true])
        subscription.unsubscribe()
    })

    it('observeBreakpoint with compound definition and dimension', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const isMediumHeight$ = observeBreakpoint({ and: ['>= 480px', '< 900px'] }, 'height')
        const emittedValues: boolean[] = []
        const subscription = isMediumHeight$.subscribe((matches) => emittedValues.push(matches))
        expect(emittedValues).toEqual([true])
        subscription.unsubscribe()
    })

    it('observeBreakpoint with both dimension', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 300 })
        const matchesEither$ = observeBreakpoint('< 500px', 'both')
        const emittedValues: boolean[] = []
        const subscription = matchesEither$.subscribe((matches) => emittedValues.push(matches))
        expect(emittedValues).toEqual([true])
        subscription.unsubscribe()
    })

    it('observeBreakpoint with configuration object', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 40 })
        const isWideRem$ = observeBreakpoint('>= 2rem', { remBase: 16 })
        const emittedValues: boolean[] = []
        const subscription = isWideRem$.subscribe((matches) => emittedValues.push(matches))
        expect(emittedValues).toEqual([true])
        subscription.unsubscribe()
    })

    it('observeWidthBreakpoint observes width definition', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const isMedium$ = observeWidthBreakpoint('>= 600px')
        const emittedValues: boolean[] = []
        const subscription = isMedium$.subscribe((matches) => emittedValues.push(matches))
        expect(emittedValues).toEqual([true])
        subscription.unsubscribe()
    })

    it('observeHeightBreakpoint observes height definition', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        const isTall$ = observeHeightBreakpoint('>= 900px')
        const emittedValues: boolean[] = []
        const subscription = isTall$.subscribe((matches) => emittedValues.push(matches))
        expect(emittedValues).toEqual([false])
        subscription.unsubscribe()
    })

    it('observeActiveWidthBreakpoints observes active width keys', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const activeWidth$ = observeActiveWidthBreakpoints()
        const emittedValues: string[][] = []
        const subscription = activeWidth$.subscribe((keys) => emittedValues.push(keys))
        expect(emittedValues.length).toBe(1)
        expect(emittedValues[0]).toContain('medium')
        subscription.unsubscribe()
    })

    it('observeActiveHeightBreakpoints observes active height keys', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const activeHeight$ = observeActiveHeightBreakpoints()
        const emittedValues: string[][] = []
        const subscription = activeHeight$.subscribe((keys) => emittedValues.push(keys))
        expect(emittedValues.length).toBe(1)
        expect(emittedValues[0]).toContain('medium')
        subscription.unsubscribe()
    })

    it('observeActiveBreakpoints observes active keys for dimension', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const activeBoth$ = observeActiveBreakpoints('both')
        const emittedValues: string[][] = []
        const subscription = activeBoth$.subscribe((keys) => emittedValues.push(keys))
        expect(emittedValues.length).toBe(1)
        expect(emittedValues[0]).toContain('medium')
        subscription.unsubscribe()

        const activeHeight$ = observeActiveBreakpoints('height')
        const emittedHeight: string[][] = []
        const subscriptionHeight = activeHeight$.subscribe((keys) => emittedHeight.push(keys))
        expect(emittedHeight.length).toBe(1)
        expect(emittedHeight[0]).toContain('medium')
        subscriptionHeight.unsubscribe()
    })

    it('observeActiveBreakpoints observes active keys with configuration object only', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const activeHeight$ = observeActiveBreakpoints({ dimension: 'height' })
        const emittedHeight: string[][] = []
        const subscriptionHeight = activeHeight$.subscribe((keys) => emittedHeight.push(keys))
        expect(emittedHeight.length).toBe(1)
        expect(emittedHeight[0]).toContain('medium')
        subscriptionHeight.unsubscribe()
    })

    it('convertDefinitionToMediaQuery returns null for empty and/or condition arrays', () => {
        expect(convertDefinitionToMediaQuery({ and: [] }, 'width', 0.05)).toBeNull()
        expect(convertDefinitionToMediaQuery({ or: [] }, 'width', 0.05)).toBeNull()
    })

    it('evaluateBreakpointMap throws TypeError for null or non-object map', () => {
        expect(() => evaluateBreakpointMap(null as any, 500)).toThrow(TypeError)
        expect(() => evaluateBreakpointMap(undefined as any, 500)).toThrow(TypeError)
        expect(() => evaluateBreakpointMap(500, null as any)).toThrow(TypeError)
        expect(() => evaluateBreakpointMap([] as any, 500)).toThrow(TypeError)
        expect(() => evaluateBreakpointMap(500, [] as any)).toThrow(TypeError)
    })

    it('observer.subscribeBreakpoint supports 2-argument and 3-argument signatures', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const observer = createBreakpointObserver()
        const callbackMock1 = vi.fn()
        const callbackMock2 = vi.fn()
        const unsub1 = observer.subscribeBreakpoint('>= 600px', callbackMock1)
        const unsub2 = observer.subscribeBreakpoint('>= 600px', 'width', callbackMock2)
        expect(callbackMock1).toHaveBeenCalled()
        expect(callbackMock2).toHaveBeenCalled()
        unsub1()
        unsub2()
        observer.dispose()
    })

    it('matchesBreakpointCondition supports 3-argument data-first and curried options', () => {
        expect(matchesBreakpointCondition(40, '>= 2rem', { remBase: 20 })).toBe(true)
        expect(matchesBreakpointCondition(39, '>= 2rem', { remBase: 20 })).toBe(false)
        const curriedWithRem = matchesBreakpointCondition('>= 2rem', { remBase: 20 })
        expect(curriedWithRem(40)).toBe(true)
        expect(curriedWithRem(39)).toBe(false)
    })

    it('matchesBreakpointDefinition supports 3-argument data-first and curried options', () => {
        const definition = { and: ['>= 2rem', '< 4rem'] }
        expect(matchesBreakpointDefinition(60, definition, { remBase: 20 })).toBe(true)
        expect(matchesBreakpointDefinition(39, definition, { remBase: 20 })).toBe(false)
        const curriedDefinition = matchesBreakpointDefinition(definition, { remBase: 20 })
        expect(curriedDefinition(60)).toBe(true)
        expect(curriedDefinition(39)).toBe(false)
    })

    it('matchesBreakpointDefinition rejects arrays as invalid definitions', () => {
        expect(() => matchesBreakpointDefinition([] as any, 500)).toThrow(TypeError)
        expect(() => matchesBreakpointDefinition(500, [] as any)).toThrow(TypeError)
        expect(convertDefinitionToMediaQuery([] as any, 'width', 0.05)).toBeNull()
    })

    it('evaluateBreakpointMap supports 3-argument data-first and curried options', () => {
        const breakpointMap = { remRange: { and: ['>= 2rem', '< 4rem'] } }
        const resultDirect = evaluateBreakpointMap(60, breakpointMap, { remBase: 20 })
        expect(resultDirect.activeBreakpoints).toContain('remRange')
        const curriedMap = evaluateBreakpointMap(breakpointMap, { remBase: 20 })
        expect(curriedMap(60).activeBreakpoints).toContain('remRange')
        expect(curriedMap(39).activeBreakpoints).toEqual([])
    })

    it('observer.subscribeBreakpoint and watchBreakpoint support both and height dimensions', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 300 })
        const observer = createBreakpointObserver({ dimension: 'both' })
        const callbackBoth = vi.fn()
        const callbackHeight = vi.fn()
        const unsubBoth = observer.subscribeBreakpoint('< 500px', 'both', callbackBoth)
        const unsubHeight = observer.subscribeBreakpoint('< 500px', 'height', callbackHeight)
        expect(callbackBoth).toHaveBeenCalled()
        expect(callbackHeight).toHaveBeenCalled()
        unsubBoth()
        unsubHeight()

        const watchBothValues: boolean[] = []
        const watchSub = observer.watchBreakpoint('< 500px', 'both').subscribe((matches) => watchBothValues.push(matches))
        expect(watchBothValues).toEqual([true])
        watchSub.unsubscribe()
        observer.dispose()
    })

    it('verifies redundant aliases have been removed', () => {
        const observer = createBreakpointObserver()
        expect((observer as any).watch).toBeUndefined()
        expect((observer as any).watchWidth).toBeUndefined()
        expect((observer as any).watchHeight).toBeUndefined()
        expect((observer as any).matches).toBeUndefined()
        expect((observer as any).matchesWidth).toBeUndefined()
        expect((observer as any).matchesHeight).toBeUndefined()
        expect((observer as any).subscribe).toBeUndefined()
        expect((observer as any).subscribeWidth).toBeUndefined()
        expect((observer as any).subscribeHeight).toBeUndefined()
        expect((observer as any).has).toBeUndefined()
        expect((observer as any).hasWidth).toBeUndefined()
        expect((observer as any).hasHeight).toBeUndefined()
        expect((observer as any).activeWidthKeys$).toBeUndefined()
        expect((observer as any).activeHeightKeys$).toBeUndefined()
        expect((observer as any).primaryWidth).toBeUndefined()
        expect((observer as any).primaryHeight).toBeUndefined()
        expect((observer.snapshot as any).activeWidthKeys).toBeUndefined()
        expect((observer.snapshot as any).activeHeightKeys).toBeUndefined()
        expect((observer.snapshot as any).primaryWidth).toBeUndefined()
        expect((observer.snapshot as any).primaryHeight).toBeUndefined()
        const evalResult = evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 600)
        expect((evalResult as any).active).toBeUndefined()
        expect((evalResult as any).table).toBeUndefined()
        observer.dispose()
    })
})


