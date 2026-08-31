import { Subject, take, takeUntil } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    createBreakpointObserver,
    evaluateBreakpointMap,
    getDefaultViewportObserver,
    matchesBreakpointCondition,
    matchesBreakpointDefinition,
    parseBreakpointCondition,
} from './breakpoint-observer.js'
import {
    DEFAULT_HEIGHT_BREAKPOINTS,
    DEFAULT_WIDTH_BREAKPOINTS,
} from './breakpoints.js'

describe('parseBreakpointCondition — edge cases & full grammar', () => {
    it('handles uppercase and mixed case units', () => {
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

    it('handles spacing variations and missing unit (defaults to px)', () => {
        expect(parseBreakpointCondition('   >=   600.75   px   ')).toEqual({ operator: '>=', targetValue: 600.75, unit: 'px' })
        expect(parseBreakpointCondition('>0')).toEqual({ operator: '>', targetValue: 0, unit: 'px' })
        expect(parseBreakpointCondition('==0px')).toEqual({ operator: '==', targetValue: 0, unit: 'px' })
        expect(parseBreakpointCondition('!=   0')).toEqual({ operator: '!=', targetValue: 0, unit: 'px' })
    })

    it('throws TypeError for malformed strings', () => {
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

describe('matchesBreakpointCondition / toPx — viewport & relative units edge cases', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('handles all CSS units in numeric evaluation', () => {
        expect(matchesBreakpointCondition(96, '>= 1in')).toBe(true)
        expect(matchesBreakpointCondition(95.9, '>= 1in')).toBe(false)
        expect(matchesBreakpointCondition(16, '>= 1pc')).toBe(true)
        expect(matchesBreakpointCondition(15.9, '>= 1pc')).toBe(false)
        expect(matchesBreakpointCondition(37.8, '>= 1cm')).toBe(true)
        expect(matchesBreakpointCondition(3.8, '>= 1mm')).toBe(true)
        expect(matchesBreakpointCondition(1.34, '>= 1pt')).toBe(true)
        expect(matchesBreakpointCondition(100, '>= 10rem', { remBase: 10, emBase: 16 })).toBe(true)
        expect(matchesBreakpointCondition(99, '>= 10rem', { remBase: 10, emBase: 16 })).toBe(false)
        expect(matchesBreakpointCondition(120, '>= 10em', { remBase: 16, emBase: 12 })).toBe(true)
        expect(matchesBreakpointCondition(119, '>= 10em', { remBase: 16, emBase: 12 })).toBe(false)
    })

    it('handles viewport units with window defined and undefined', () => {
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
        vi.stubGlobal('window', undefined as unknown as Window)
        expect(matchesBreakpointCondition(100, '>= 10vw')).toBe(false)
        expect(matchesBreakpointCondition(50, '>= 10vh')).toBe(false)
        expect(matchesBreakpointCondition(50, '>= 10vmin')).toBe(false)
        expect(matchesBreakpointCondition(100, '>= 10vmax')).toBe(false)
    })

    it('returns false for non-convertible font/layout units', () => {
        const units = ['ex', 'ch', 'cap', 'ic', 'lh', 'rlh', '%']
        for (const unit of units) {
            expect(matchesBreakpointCondition(100, `>= 10${unit}`)).toBe(false)
            expect(matchesBreakpointCondition(100, `<= 10${unit}`)).toBe(false)
            expect(matchesBreakpointCondition(100, `= 10${unit}`)).toBe(false)
        }
    })
})

describe('matchesBreakpointDefinition — complex combinations & invalid inputs', () => {
    it('evaluates complex object definitions', () => {
        const obj1 = { min: 600, max: 900, minInclusive: false, maxInclusive: false }
        expect(matchesBreakpointDefinition(600, obj1)).toBe(false)
        expect(matchesBreakpointDefinition(600.1, obj1)).toBe(true)
        expect(matchesBreakpointDefinition(899.9, obj1)).toBe(true)
        expect(matchesBreakpointDefinition(900, obj1)).toBe(false)
        expect(matchesBreakpointDefinition(600, { min: 600 })).toBe(true)
        expect(matchesBreakpointDefinition(599.9, { min: 600 })).toBe(false)
        expect(matchesBreakpointDefinition(600, { min: 600, minInclusive: false })).toBe(false)
        expect(matchesBreakpointDefinition(600.1, { min: 600, minInclusive: false })).toBe(true)
        expect(matchesBreakpointDefinition(900, { max: 900 })).toBe(false) // maxInclusive default false
        expect(matchesBreakpointDefinition(899.9, { max: 900 })).toBe(true)
        expect(matchesBreakpointDefinition(900, { max: 900, maxInclusive: true })).toBe(true)
        expect(matchesBreakpointDefinition(900.1, { max: 900 })).toBe(false)
        expect(matchesBreakpointDefinition(900, { max: 900, maxInclusive: false })).toBe(false)
        expect(matchesBreakpointDefinition(899.9, { max: 900, maxInclusive: false })).toBe(true)
        expect(matchesBreakpointDefinition(1000, { eq: 1000 })).toBe(true)
        expect(matchesBreakpointDefinition(1001, { eq: 1000 })).toBe(false)
        expect(matchesBreakpointDefinition(1000, { ne: 1000 })).toBe(false)
        expect(matchesBreakpointDefinition(1001, { ne: 1000 })).toBe(true)
        const obj2 = { min: 500, max: 1000, ne: 750 }
        expect(matchesBreakpointDefinition(500, obj2)).toBe(true)
        expect(matchesBreakpointDefinition(750, obj2)).toBe(false)
        expect(matchesBreakpointDefinition(999.9, obj2)).toBe(true)
        expect(matchesBreakpointDefinition(1000, obj2)).toBe(false) // maxInclusive default false
        expect(matchesBreakpointDefinition(1000, { min: 500, max: 1000, maxInclusive: true, ne: 750 })).toBe(true)
        expect(matchesBreakpointDefinition(1001, obj2)).toBe(false)
    })

    it('evaluates nested AND / OR definitions', () => {
        expect(matchesBreakpointDefinition(700, { and: ['>= 600px', '< 840px', '!= 700px'] })).toBe(false)
        expect(matchesBreakpointDefinition(701, { and: ['>= 600px', '< 840px', '!= 700px'] })).toBe(true)
        expect(matchesBreakpointDefinition(700, { and: [] })).toBe(true)
        expect(matchesBreakpointDefinition(500, { or: ['< 600px', '>= 1200px'] })).toBe(true)
        expect(matchesBreakpointDefinition(800, { or: ['< 600px', '>= 1200px'] })).toBe(false)
        expect(matchesBreakpointDefinition(1400, { or: ['< 600px', '>= 1200px'] })).toBe(true)
        expect(matchesBreakpointDefinition(700, { or: [] })).toBe(false)
    })

    it('throws TypeError for empty object or invalid types', () => {
        expect(() => matchesBreakpointDefinition(100, {} as any)).toThrow(TypeError)
        expect(() => matchesBreakpointDefinition(100, null as any)).toThrow(TypeError)
        expect(() => matchesBreakpointDefinition(100, undefined as any)).toThrow(TypeError)
        expect(() => matchesBreakpointDefinition(100, true as any)).toThrow(TypeError)
        expect(() => matchesBreakpointDefinition(100, false as any)).toThrow(TypeError)
        expect(() => matchesBreakpointDefinition(100, Symbol('invalid') as any)).toThrow(TypeError)
        expect(() => matchesBreakpointDefinition(100, { customKey: 'val' } as any)).toThrow(TypeError)
    })
})

describe('evaluateBreakpointMap — edge cases', () => {
    it('evaluates empty breakpoint map', () => {
        const result = evaluateBreakpointMap({}, 800)
        expect(result.activeBreakpoints).toEqual([])
        expect(result.matchesTable).toEqual({})
    })

    it('respects custom remBase and emBase', () => {
        const map = {
            r: '>= 5rem',
            e: '>= 5em',
        }
        const r1 = evaluateBreakpointMap(map, 49, { remBase: 10, emBase: 20 })
        expect(r1.activeBreakpoints).toEqual([])
        const r2 = evaluateBreakpointMap(map, 50, { remBase: 10, emBase: 20 })
        expect(r2.activeBreakpoints).toEqual(['r'])
        const r3 = evaluateBreakpointMap(map, 100, { remBase: 10, emBase: 20 })
        expect(r3.activeBreakpoints).toEqual(['r', 'e'])
    })
})

describe('createBreakpointObserver — dimension configurations & queries', () => {
    afterEach(() => vi.restoreAllMocks())

    it('initializes with height dimension only', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 })

        const observer = createBreakpointObserver({
            dimension: 'height',
            heightBreakpoints: DEFAULT_HEIGHT_BREAKPOINTS,
        })

        const state = observer.snapshot
        expect(state.width).toBe(1024)
        expect(state.height).toBe(768)
        expect(state.activeWidthBreakpoints).toEqual([])
        expect(state.widthMatches).toEqual({})
        expect(state.activeHeightBreakpoints).toContain('medium')
        expect(state.heightMatches.medium).toBe(true)
        expect(state.primaryWidthBreakpoint).toBeNull()
        expect(state.primaryHeightBreakpoint).toBe('medium')
        expect(state.matches).toBe(true)

        observer.dispose()
    })

    it('has / matches with different dimensions', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })

        const observer = createBreakpointObserver({
            dimension: 'both',
            widthBreakpoints: { sm: { and: ['>= 600px', '< 840px'] } },
            heightBreakpoints: { h_med: { and: ['>= 480px', '< 900px'] } },
        })

        expect(observer.hasWidthBreakpoint('sm')).toBe(true)
        expect(observer.hasBreakpoint('sm')).toBe(true)
        expect(observer.hasBreakpoint('nonexistent')).toBe(false)
        expect(observer.matchesWidthBreakpoint('>= 600px')).toBe(true)
        expect(observer.matchesWidthBreakpoint('< 600px')).toBe(false)
        expect(observer.matchesWidthBreakpoint({ min: 600, max: 800 })).toBe(true)

        expect(observer.hasHeightBreakpoint('h_med')).toBe(true)
        expect(observer.hasHeightBreakpoint('sm')).toBe(false)
        expect(observer.matchesHeightBreakpoint('>= 480px')).toBe(true)
        expect(observer.matchesHeightBreakpoint('< 400px')).toBe(false)
        expect(observer.matchesHeightBreakpoint({ min: 480, max: 900 })).toBe(true)

        expect(observer.hasBreakpoint('sm', 'both')).toBe(true)
        expect(observer.hasBreakpoint('h_med', 'both')).toBe(true)
        expect(observer.hasBreakpoint('unknown', 'both')).toBe(false)
        expect(observer.matchesBreakpoint('>= 600px', 'both')).toBe(true)
        expect(observer.matchesBreakpoint('< 600px', 'both')).toBe(true)
        expect(observer.matchesBreakpoint('> 1000px', 'both')).toBe(false)

        observer.dispose()
    })

    it('handles subscribeHeight and watch', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })

        const observer = createBreakpointObserver({
            dimension: 'both',
            heightBreakpoints: { tall: '>= 800px' },
        })

        const watchValues: boolean[] = []
        const subscription = observer.watchHeightBreakpoint('>= 800px').subscribe((value) => watchValues.push(value))
        expect(watchValues).toEqual([false])

        Object.defineProperty(window, 'innerHeight', { writable: true, value: 900 })
        ;(observer as any)._scheduleEmitImmediate()
        expect(watchValues).toEqual([false, true])

        Object.defineProperty(window, 'innerHeight', { writable: true, value: 1000 })
        ;(observer as any)._scheduleEmitImmediate()
        expect(watchValues).toEqual([false, true])

        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        ;(observer as any)._scheduleEmitImmediate()
        expect(watchValues).toEqual([false, true, false])

        subscription.unsubscribe()
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 900 })
        ;(observer as any)._scheduleEmitImmediate()
        expect(watchValues.length).toBe(3)

        observer.dispose()
    })

    it('watchHeight and watch streams', async () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })

        const observer = createBreakpointObserver({
            dimension: 'both',
            heightBreakpoints: { tall: '>= 800px' },
        })

        const emitted: boolean[] = []
        const subscription = observer.watchHeightBreakpoint('>= 800px').subscribe((value) => emitted.push(value))

        expect(emitted).toEqual([false])

        Object.defineProperty(window, 'innerHeight', { writable: true, value: 900 })
        ;(observer as any)._scheduleEmitImmediate()
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(emitted).toEqual([false, true])

        subscription.unsubscribe()

        observer.dispose()
    })
})

describe('createBreakpointObserver — element strategy edge cases', () => {
    it('handles element whose getBoundingClientRect returns 0 with offsetWidth/Height fallback', () => {
        const element = document.createElement('div')
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
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
        Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 750 })
        Object.defineProperty(element, 'offsetHeight', { configurable: true, value: 450 })

        const observer = createBreakpointObserver({ element })
        expect(observer.snapshot.width).toBe(750)
        expect(observer.snapshot.height).toBe(450)
        observer.dispose()
    })

    it('handles element whose getBoundingClientRect throws an error', () => {
        const element = document.createElement('div')
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            throw new Error('Detached or inaccessible DOM node')
        })

        const observer = createBreakpointObserver({ element })
        expect(observer.snapshot.width).toBe(0)
        expect(observer.snapshot.height).toBe(0)
        observer.dispose()
    })

    it('attachElement with same element is a noop', () => {
        const element = document.createElement('div')
        const observer = createBreakpointObserver({ element })
        const spyTeardown = vi.spyOn(observer as any, '_teardownStrategy')

        observer.attachElement(element)
        expect(spyTeardown).not.toHaveBeenCalled()

        observer.dispose()
    })

    it('attachElement after dispose is a noop and does not crash', () => {
        const element = document.createElement('div')
        const observer = createBreakpointObserver({ element })
        observer.dispose()

        const element2 = document.createElement('div')
        expect(() => observer.attachElement(element2)).not.toThrow()
        expect(observer.attachedElement).toBeNull()
    })

    it('handles ResizeObserver callback with and without contentRect', () => {
        let resizeObserverCallback: ResizeObserverCallback | null = null
        class TestResizeObserver {
            constructor(callback: ResizeObserverCallback) {
                resizeObserverCallback = callback
            }
            observe = vi.fn()
            unobserve = vi.fn()
            disconnect = vi.fn()
        }
        vi.stubGlobal('ResizeObserver', TestResizeObserver as unknown as typeof ResizeObserver)
        vi.stubGlobal('window', { ...window, ResizeObserver: TestResizeObserver } as unknown as Window)

        const element = document.createElement('div')
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
            width: 500,
            height: 300,
            top: 0,
            left: 0,
            right: 500,
            bottom: 300,
            x: 0,
            y: 0,
            toJSON: () => {},
        } as DOMRect)

        const observer = createBreakpointObserver({ element, widthBreakpoints: { wide: '>= 800px' } })
        expect(observer.snapshot.width).toBe(500)
        expect(resizeObserverCallback).not.toBeNull()

        if (resizeObserverCallback) {
            ;(resizeObserverCallback as ResizeObserverCallback)(
                [{ contentRect: { width: 900, height: 600 } as DOMRectReadOnly } as ResizeObserverEntry],
                {} as ResizeObserver,
            )
        }
        ;(observer as any)._scheduleEmitImmediate()
        expect(observer.snapshot.width).toBe(900)
        expect(observer.snapshot.height).toBe(600)
        expect(observer.snapshot.activeWidthBreakpoints).toContain('wide')

        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
            width: 400,
            height: 250,
            top: 0,
            left: 0,
            right: 400,
            bottom: 250,
            x: 0,
            y: 0,
            toJSON: () => {},
        } as DOMRect)
        if (resizeObserverCallback) {
            ;(resizeObserverCallback as ResizeObserverCallback)([{} as ResizeObserverEntry], {} as ResizeObserver)
        }
        ;(observer as any)._scheduleEmitImmediate()
        expect(observer.snapshot.width).toBe(400)
        expect(observer.snapshot.height).toBe(250)
        expect(observer.snapshot.activeWidthBreakpoints).toEqual([])

        observer.dispose()
        vi.unstubAllGlobals()
    })
})

describe('createBreakpointObserver — dispose & singleton lifecycle', () => {
    it('getState() method returns same value as snapshot getter', () => {
        const observer = createBreakpointObserver()
        expect(observer.getState()).toBe(observer.snapshot)
        observer.dispose()
    })

    it('getDefaultViewportObserver re-creates instance if disposed', () => {
        const instance1 = getDefaultViewportObserver()
        expect(instance1).toBeDefined()
        instance1.dispose()

        const instance2 = getDefaultViewportObserver()
        expect(instance2).toBeDefined()
        expect(instance2).not.toBe(instance1)
        expect(instance2.isDisposed).toBe(false)
        instance2.dispose()
    })
})

describe('createBreakpointObserver — SSR partial matches & edge cases', () => {
    it('SSR dimension both with only defaultWidthMatches specified', () => {
        const originalWindow = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window

        const observer = createBreakpointObserver({
            dimension: 'both',
            widthBreakpoints: { w1: '> 500px', w2: '< 500px' },
            heightBreakpoints: { h1: '> 400px' },
            defaultWidthMatches: { w1: true },
        })

        expect(observer.snapshot.activeWidthBreakpoints).toEqual(['w1'])
        expect(observer.snapshot.widthMatches).toEqual({ w1: true, w2: false })
        expect(observer.snapshot.activeHeightBreakpoints).toEqual([])
        expect(observer.snapshot.heightMatches).toEqual({ h1: false })
        expect(observer.snapshot.matches).toBe(true)

        observer.dispose()
        ;(globalThis as any).window = originalWindow
    })

    it('SSR dimension both with only defaultHeightMatches specified', () => {
        const originalWindow = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window

        const observer = createBreakpointObserver({
            dimension: 'both',
            widthBreakpoints: { w1: '> 500px' },
            heightBreakpoints: { h1: '> 400px', h2: '< 400px' },
            defaultHeightMatches: { h1: true },
        })

        expect(observer.snapshot.activeWidthBreakpoints).toEqual([])
        expect(observer.snapshot.widthMatches).toEqual({ w1: false })
        expect(observer.snapshot.activeHeightBreakpoints).toEqual(['h1'])
        expect(observer.snapshot.heightMatches).toEqual({ h1: true, h2: false })
        expect(observer.snapshot.matches).toBe(true)

        observer.dispose()
        ;(globalThis as any).window = originalWindow
    })
})

describe('createBreakpointObserver — dimension query isolation', () => {
    it('hasWidthBreakpoint ignores keys in heightBreakpoints when in width mode', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })

        const observer = createBreakpointObserver({
            dimension: 'width',
            widthBreakpoints: { w_sm: '< 600px', w_lg: '>= 600px' },
            heightBreakpoints: { h_compact: '< 600px' },
        })

        expect(observer.hasWidthBreakpoint('w_lg')).toBe(true)
        expect(observer.hasWidthBreakpoint('w_sm')).toBe(false)
        expect(observer.hasWidthBreakpoint('h_compact')).toBe(false)

        observer.dispose()
    })

    it('hasHeightBreakpoint ignores keys in widthBreakpoints when in height mode', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })

        const observer = createBreakpointObserver({
            dimension: 'height',
            widthBreakpoints: { w_active: '>= 400px' },
            heightBreakpoints: { h_med: '>= 480px' },
        })

        expect(observer.hasHeightBreakpoint('h_med')).toBe(true)
        expect(observer.hasHeightBreakpoint('w_active')).toBe(false)

        observer.dispose()
    })

    it('matches both dimension', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })

        const observer = createBreakpointObserver({
            dimension: 'both',
            widthBreakpoints: { md: { and: ['>= 840px', '< 1200px'] } },
            heightBreakpoints: { compact: '< 480px' },
        })

        expect(observer.matchesBreakpoint({ and: ['>= 840px', '< 1200px'] }, 'width')).toBe(true)
        expect(observer.matchesBreakpoint({ and: ['>= 300px', '< 500px'] }, 'height')).toBe(true)
        expect(observer.matchesBreakpoint({ and: ['>= 2000px', '< 3000px'] }, 'both')).toBe(false)

        observer.dispose()
    })
})

describe('createBreakpointObserver — concurrent instances', () => {
    it('multiple observers operate independently without interference', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })

        const observer1 = createBreakpointObserver({ widthBreakpoints: { a: '< 800px' } })
        const observer2 = createBreakpointObserver({ widthBreakpoints: { b: '>= 800px' } })

        expect(observer1.snapshot.activeWidthBreakpoints).toEqual(['a'])
        expect(observer2.snapshot.activeWidthBreakpoints).toEqual([])

        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        ;(observer1 as any)._scheduleEmitImmediate()
        ;(observer2 as any)._scheduleEmitImmediate()

        expect(observer1.snapshot.activeWidthBreakpoints).toEqual([])
        expect(observer2.snapshot.activeWidthBreakpoints).toEqual(['b'])

        observer1.dispose()
        observer2.dispose()
    })
})

