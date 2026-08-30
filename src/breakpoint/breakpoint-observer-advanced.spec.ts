import { Subject, take, takeUntil } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    BreakpointObserver,
    evaluateAll,
    getDefaultViewportObserver,
    matchesCondition,
    matchesDefinition,
    parseCondition,
} from './breakpoint-observer.js'
import {
    DEFAULT_HEIGHT_BREAKPOINTS,
    DEFAULT_WIDTH_BREAKPOINTS,
} from './breakpoints.js'

describe('parseCondition — edge cases & full grammar', () => {
    it('handles uppercase and mixed case units', () => {
        expect(parseCondition('> 840PX')).toEqual({ op: '>', value: 840, unit: 'px' })
        expect(parseCondition('>= 10REM')).toEqual({ op: '>=', value: 10, unit: 'rem' })
        expect(parseCondition('<= 20Em')).toEqual({ op: '<=', value: 20, unit: 'em' })
        expect(parseCondition('< 50Vw')).toEqual({ op: '<', value: 50, unit: 'vw' })
        expect(parseCondition('= 100VH')).toEqual({ op: '=', value: 100, unit: 'vh' })
        expect(parseCondition('!= 5VMIN')).toEqual({ op: '!=', value: 5, unit: 'vmin' })
        expect(parseCondition('>= 2.5VMAX')).toEqual({ op: '>=', value: 2.5, unit: 'vmax' })
        expect(parseCondition('<= 100DVW')).toEqual({ op: '<=', value: 100, unit: 'dvw' })
        expect(parseCondition('> 50SVH')).toEqual({ op: '>', value: 50, unit: 'svh' })
        expect(parseCondition('< 80LVW')).toEqual({ op: '<', value: 80, unit: 'lvw' })
        expect(parseCondition('>= 30VI')).toEqual({ op: '>=', value: 30, unit: 'vi' })
        expect(parseCondition('<= 40VB')).toEqual({ op: '<=', value: 40, unit: 'vb' })
    })

    it('handles spacing variations and missing unit (defaults to px)', () => {
        expect(parseCondition('   >=   600.75   px   ')).toEqual({ op: '>=', value: 600.75, unit: 'px' })
        expect(parseCondition('>0')).toEqual({ op: '>', value: 0, unit: 'px' })
        expect(parseCondition('==0px')).toEqual({ op: '==', value: 0, unit: 'px' })
        expect(parseCondition('!=   0')).toEqual({ op: '!=', value: 0, unit: 'px' })
    })

    it('throws TypeError for malformed strings', () => {
        const invalid = [
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
        for (const input of invalid) {
            expect(() => parseCondition(input)).toThrow(TypeError)
        }
    })
})

describe('matchesCondition / toPx — viewport & relative units edge cases', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('handles all CSS units in numeric evaluation', () => {
        expect(matchesCondition(96, '>= 1in')).toBe(true)
        expect(matchesCondition(95.9, '>= 1in')).toBe(false)
        expect(matchesCondition(16, '>= 1pc')).toBe(true)
        expect(matchesCondition(15.9, '>= 1pc')).toBe(false)
        expect(matchesCondition(37.8, '>= 1cm')).toBe(true)
        expect(matchesCondition(3.8, '>= 1mm')).toBe(true)
        expect(matchesCondition(1.34, '>= 1pt')).toBe(true)
        expect(matchesCondition(100, '>= 10rem', 10, 16)).toBe(true)
        expect(matchesCondition(99, '>= 10rem', 10, 16)).toBe(false)
        expect(matchesCondition(120, '>= 10em', 16, 12)).toBe(true)
        expect(matchesCondition(119, '>= 10em', 16, 12)).toBe(false)
    })

    it('handles viewport units with window defined and undefined', () => {
        vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 500 } as unknown as Window)
        expect(matchesCondition(100, '>= 10vw')).toBe(true)
        expect(matchesCondition(99, '>= 10vw')).toBe(false)
        expect(matchesCondition(100, '>= 10dvw')).toBe(true)
        expect(matchesCondition(100, '>= 10svw')).toBe(true)
        expect(matchesCondition(100, '>= 10lvw')).toBe(true)
        expect(matchesCondition(100, '>= 10vi')).toBe(true)
        expect(matchesCondition(50, '>= 10vh')).toBe(true)
        expect(matchesCondition(49, '>= 10vh')).toBe(false)
        expect(matchesCondition(50, '>= 10dvh')).toBe(true)
        expect(matchesCondition(50, '>= 10svh')).toBe(true)
        expect(matchesCondition(50, '>= 10lvh')).toBe(true)
        expect(matchesCondition(50, '>= 10vb')).toBe(true)
        expect(matchesCondition(50, '>= 10vmin')).toBe(true)
        expect(matchesCondition(100, '>= 10vmax')).toBe(true)
        vi.stubGlobal('window', undefined as unknown as Window)
        expect(matchesCondition(100, '>= 10vw')).toBe(false)
        expect(matchesCondition(50, '>= 10vh')).toBe(false)
        expect(matchesCondition(50, '>= 10vmin')).toBe(false)
        expect(matchesCondition(100, '>= 10vmax')).toBe(false)
    })

    it('returns false for non-convertible font/layout units', () => {
        const units = ['ex', 'ch', 'cap', 'ic', 'lh', 'rlh', '%']
        for (const u of units) {
            expect(matchesCondition(100, `>= 10${u}`)).toBe(false)
            expect(matchesCondition(100, `<= 10${u}`)).toBe(false)
            expect(matchesCondition(100, `= 10${u}`)).toBe(false)
        }
    })
})

describe('matchesDefinition — complex combinations & invalid inputs', () => {
    it('evaluates complex object definitions', () => {
        const obj1 = { min: 600, max: 900, minInclusive: false, maxInclusive: false }
        expect(matchesDefinition(600, obj1)).toBe(false)
        expect(matchesDefinition(600.1, obj1)).toBe(true)
        expect(matchesDefinition(899.9, obj1)).toBe(true)
        expect(matchesDefinition(900, obj1)).toBe(false)
        expect(matchesDefinition(600, { min: 600 })).toBe(true)
        expect(matchesDefinition(599.9, { min: 600 })).toBe(false)
        expect(matchesDefinition(600, { min: 600, minInclusive: false })).toBe(false)
        expect(matchesDefinition(600.1, { min: 600, minInclusive: false })).toBe(true)
        expect(matchesDefinition(900, { max: 900 })).toBe(true)
        expect(matchesDefinition(900.1, { max: 900 })).toBe(false)
        expect(matchesDefinition(900, { max: 900, maxInclusive: false })).toBe(false)
        expect(matchesDefinition(899.9, { max: 900, maxInclusive: false })).toBe(true)
        expect(matchesDefinition(1000, { eq: 1000 })).toBe(true)
        expect(matchesDefinition(1001, { eq: 1000 })).toBe(false)
        expect(matchesDefinition(1000, { ne: 1000 })).toBe(false)
        expect(matchesDefinition(1001, { ne: 1000 })).toBe(true)
        const obj2 = { min: 500, max: 1000, ne: 750 }
        expect(matchesDefinition(500, obj2)).toBe(true)
        expect(matchesDefinition(750, obj2)).toBe(false)
        expect(matchesDefinition(1000, obj2)).toBe(true)
        expect(matchesDefinition(1001, obj2)).toBe(false)
    })

    it('evaluates nested AND / OR definitions', () => {
        expect(matchesDefinition(700, { and: ['>= 600px', '< 840px', '!= 700px'] })).toBe(false)
        expect(matchesDefinition(701, { and: ['>= 600px', '< 840px', '!= 700px'] })).toBe(true)
        expect(matchesDefinition(700, { and: [] })).toBe(true)
        expect(matchesDefinition(500, { or: ['< 600px', '>= 1200px'] })).toBe(true)
        expect(matchesDefinition(800, { or: ['< 600px', '>= 1200px'] })).toBe(false)
        expect(matchesDefinition(1400, { or: ['< 600px', '>= 1200px'] })).toBe(true)
        expect(matchesDefinition(700, { or: [] })).toBe(false)
    })

    it('throws TypeError for empty object or invalid types', () => {
        expect(() => matchesDefinition(100, {} as any)).toThrow(TypeError)
        expect(() => matchesDefinition(100, null as any)).toThrow(TypeError)
        expect(() => matchesDefinition(100, undefined as any)).toThrow(TypeError)
        expect(() => matchesDefinition(100, true as any)).toThrow(TypeError)
        expect(() => matchesDefinition(100, false as any)).toThrow(TypeError)
        expect(() => matchesDefinition(100, Symbol('invalid') as any)).toThrow(TypeError)
        expect(() => matchesDefinition(100, { customKey: 'val' } as any)).toThrow(TypeError)
    })
})

describe('evaluateAll — edge cases', () => {
    it('evaluates empty breakpoint map', () => {
        const result = evaluateAll(800, {})
        expect(result.active).toEqual([])
        expect(result.table).toEqual({})
    })

    it('respects custom remBase and emBase', () => {
        const map = {
            r: '>= 5rem',
            e: '>= 5em',
        }
        const r1 = evaluateAll(49, map, 10, 20)
        expect(r1.active).toEqual([])
        const r2 = evaluateAll(50, map, 10, 20)
        expect(r2.active).toEqual(['r'])
        const r3 = evaluateAll(100, map, 10, 20)
        expect(r3.active).toEqual(['r', 'e'])
    })
})

describe('BreakpointObserver — dimension configurations & queries', () => {
    afterEach(() => vi.restoreAllMocks())

    it('initializes with height dimension only', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 })

        const obs = new BreakpointObserver({
            dimension: 'height',
            heightBreakpoints: DEFAULT_HEIGHT_BREAKPOINTS,
        })

        const state = obs.snapshot
        expect(state.width).toBe(1024)
        expect(state.height).toBe(768)
        expect(state.activeWidthKeys).toEqual([])
        expect(state.widthMatches).toEqual({})
        expect(state.activeHeightKeys).toContain('medium')
        expect(state.heightMatches.medium).toBe(true)
        expect(state.primaryWidth).toBeNull()
        expect(state.primaryHeight).toBe('medium')
        expect(state.matches).toBe(true)

        obs.dispose()
    })

    it('has / matches with different dimensions', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })

        const obs = new BreakpointObserver({
            dimension: 'both',
            widthBreakpoints: { sm: { and: ['>= 600px', '< 840px'] } },
            heightBreakpoints: { h_med: { and: ['>= 480px', '< 900px'] } },
        })

        expect(obs.hasWidth('sm')).toBe(true)
        expect(obs.has('sm')).toBe(true)
        expect(obs.has('nonexistent')).toBe(false)
        expect(obs.matchesWidth('>= 600px')).toBe(true)
        expect(obs.matchesWidth('< 600px')).toBe(false)
        expect(obs.matchesWidth({ min: 600, max: 800 })).toBe(true)

        expect(obs.hasHeight('h_med')).toBe(true)
        expect(obs.hasHeight('sm')).toBe(false)
        expect(obs.matchesHeight('>= 480px')).toBe(true)
        expect(obs.matchesHeight('< 400px')).toBe(false)
        expect(obs.matchesHeight({ min: 480, max: 900 })).toBe(true)

        expect(obs.has('sm', 'both')).toBe(true)
        expect(obs.has('h_med', 'both')).toBe(true)
        expect(obs.has('unknown', 'both')).toBe(false)
        expect(obs.matches('>= 600px', 'both')).toBe(true)
        expect(obs.matches('< 600px', 'both')).toBe(true)
        expect(obs.matches('> 1000px', 'both')).toBe(false)

        obs.dispose()
    })

    it('handles subscribeHeight and watch', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })

        const obs = new BreakpointObserver({
            dimension: 'both',
            heightBreakpoints: { tall: '>= 800px' },
        })

        const heightVals: boolean[] = []
        const offH = obs.subscribeHeight('>= 800px', () => heightVals.push(obs.matchesHeight('>= 800px')))
        // initial call via subscribe? subscribeHeight calls cb immediately via state$ BehaviorSubject
        // But we track via watch instead for dedup? Check subscribeHeight still emits immediate via state$ subscription
        // We'll directly test watch
        const watchVals: boolean[] = []
        const sub = obs.watchHeight('>= 800px').subscribe(v => watchVals.push(v))
        expect(watchVals).toEqual([false])

        Object.defineProperty(window, 'innerHeight', { writable: true, value: 900 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(watchVals).toEqual([false, true])

        Object.defineProperty(window, 'innerHeight', { writable: true, value: 1000 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(watchVals).toEqual([false, true])

        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(watchVals).toEqual([false, true, false])

        offH()
        sub.unsubscribe()
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 900 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(watchVals.length).toBe(3)

        obs.dispose()
    })

    it('watchHeight and watch streams', async () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })

        const obs = new BreakpointObserver({
            dimension: 'both',
            heightBreakpoints: { tall: '>= 800px' },
        })

        const emitted: boolean[] = []
        const sub = obs.watchHeight('>= 800px').subscribe((v) => emitted.push(v))

        expect(emitted).toEqual([false])

        Object.defineProperty(window, 'innerHeight', { writable: true, value: 900 })
        ;(obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 0))
        expect(emitted).toEqual([false, true])

        sub.unsubscribe()

        obs.dispose()
    })
})

describe('BreakpointObserver — element strategy edge cases', () => {
    it('handles element whose getBoundingClientRect returns 0 with offsetWidth/Height fallback', () => {
        const el = document.createElement('div')
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
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
        Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 750 })
        Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 450 })

        const obs = new BreakpointObserver({ element: el })
        expect(obs.snapshot.width).toBe(750)
        expect(obs.snapshot.height).toBe(450)
        obs.dispose()
    })

    it('handles element whose getBoundingClientRect throws an error', () => {
        const el = document.createElement('div')
        vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => {
            throw new Error('Detached or inaccessible DOM node')
        })

        const obs = new BreakpointObserver({ element: el })
        expect(obs.snapshot.width).toBe(0)
        expect(obs.snapshot.height).toBe(0)
        obs.dispose()
    })

    it('attachElement with same element is a noop', () => {
        const el = document.createElement('div')
        const obs = new BreakpointObserver({ element: el })
        const spyTeardown = vi.spyOn(obs as any, '_teardownStrategy')

        obs.attachElement(el)
        expect(spyTeardown).not.toHaveBeenCalled()

        obs.dispose()
    })

    it('attachElement after dispose is a noop and does not crash', () => {
        const el = document.createElement('div')
        const obs = new BreakpointObserver({ element: el })
        obs.dispose()

        const el2 = document.createElement('div')
        expect(() => obs.attachElement(el2)).not.toThrow()
        expect(obs.attachedElement).toBeNull()
    })

    it('handles ResizeObserver callback with and without contentRect', () => {
        let roCallback: ResizeObserverCallback | null = null
        class TestResizeObserver {
            constructor(cb: ResizeObserverCallback) {
                roCallback = cb
            }
            observe = vi.fn()
            unobserve = vi.fn()
            disconnect = vi.fn()
        }
        vi.stubGlobal('ResizeObserver', TestResizeObserver as unknown as typeof ResizeObserver)
        // also need window.ResizeObserver for new isBrowser check
        vi.stubGlobal('window', { ...window, ResizeObserver: TestResizeObserver } as unknown as Window)

        const el = document.createElement('div')
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
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

        const obs = new BreakpointObserver({ element: el, widthBreakpoints: { wide: '>= 800px' } })
        expect(obs.snapshot.width).toBe(500)
        expect(roCallback).not.toBeNull()

        if (roCallback) {
            ;(roCallback as ResizeObserverCallback)(
                [{ contentRect: { width: 900, height: 600 } as DOMRectReadOnly } as ResizeObserverEntry],
                {} as ResizeObserver,
            )
        }
        ;(obs as any)._scheduleEmitImmediate()
        expect(obs.snapshot.width).toBe(900)
        expect(obs.snapshot.height).toBe(600)
        expect(obs.snapshot.activeWidthKeys).toContain('wide')

        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
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
        if (roCallback) {
            ;(roCallback as ResizeObserverCallback)([{} as ResizeObserverEntry], {} as ResizeObserver)
        }
        ;(obs as any)._scheduleEmitImmediate()
        expect(obs.snapshot.width).toBe(400)
        expect(obs.snapshot.height).toBe(250)
        expect(obs.snapshot.activeWidthKeys).toEqual([])

        obs.dispose()
        vi.unstubAllGlobals()
    })
})

describe('BreakpointObserver — dispose & singleton lifecycle', () => {
    it('getState() method returns same value as snapshot getter', () => {
        const obs = new BreakpointObserver()
        expect(obs.getState()).toBe(obs.snapshot)
        obs.dispose()
    })

    it('getDefaultViewportObserver re-creates instance if disposed', () => {
        const instance1 = getDefaultViewportObserver()
        expect(instance1).toBeDefined()
        instance1.dispose()

        const instance2 = getDefaultViewportObserver()
        expect(instance2).toBeDefined()
        expect(instance2).not.toBe(instance1)
        expect((instance2 as any)._disposed).toBe(false)
        instance2.dispose()
    })
})

describe('BreakpointObserver — SSR partial matches & edge cases', () => {
    it('SSR dimension both with only defaultWidthMatches specified', () => {
        const orig = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window

        const obs = new BreakpointObserver({
            dimension: 'both',
            widthBreakpoints: { w1: '> 500px', w2: '< 500px' },
            heightBreakpoints: { h1: '> 400px' },
            defaultWidthMatches: { w1: true },
        })

        expect(obs.snapshot.activeWidthKeys).toEqual(['w1'])
        expect(obs.snapshot.widthMatches).toEqual({ w1: true, w2: false })
        expect(obs.snapshot.activeHeightKeys).toEqual([])
        expect(obs.snapshot.heightMatches).toEqual({ h1: false })
        expect(obs.snapshot.matches).toBe(true)

        obs.dispose()
        ;(globalThis as any).window = orig
    })

    it('SSR dimension both with only defaultHeightMatches specified', () => {
        const orig = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window

        const obs = new BreakpointObserver({
            dimension: 'both',
            widthBreakpoints: { w1: '> 500px' },
            heightBreakpoints: { h1: '> 400px', h2: '< 400px' },
            defaultHeightMatches: { h1: true },
        })

        expect(obs.snapshot.activeWidthKeys).toEqual([])
        expect(obs.snapshot.widthMatches).toEqual({ w1: false })
        expect(obs.snapshot.activeHeightKeys).toEqual(['h1'])
        expect(obs.snapshot.heightMatches).toEqual({ h1: true, h2: false })
        expect(obs.snapshot.matches).toBe(true)

        obs.dispose()
        ;(globalThis as any).window = orig
    })
})

describe('BreakpointObserver — dimension query isolation', () => {
    it('hasWidth ignores keys in heightBreakpoints when in width mode', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })

        const obs = new BreakpointObserver({
            dimension: 'width',
            widthBreakpoints: { w_sm: '< 600px', w_lg: '>= 600px' },
            heightBreakpoints: { h_compact: '< 600px' },
        })

        expect(obs.hasWidth('w_lg')).toBe(true)
        expect(obs.hasWidth('w_sm')).toBe(false)
        expect(obs.hasWidth('h_compact')).toBe(false)

        obs.dispose()
    })

    it('hasHeight ignores keys in widthBreakpoints when in height mode', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })

        const obs = new BreakpointObserver({
            dimension: 'height',
            widthBreakpoints: { w_active: '>= 400px' },
            heightBreakpoints: { h_med: '>= 480px' },
        })

        expect(obs.hasHeight('h_med')).toBe(true)
        expect(obs.hasHeight('w_active')).toBe(false)

        obs.dispose()
    })

    it('matches both dimension', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })

        const obs = new BreakpointObserver({
            dimension: 'both',
            widthBreakpoints: { md: { and: ['>= 840px', '< 1200px'] } },
            heightBreakpoints: { compact: '< 480px' },
        })

        expect(obs.matches({ and: ['>= 840px', '< 1200px'] }, 'width')).toBe(true)
        expect(obs.matches({ and: ['>= 300px', '< 500px'] }, 'height')).toBe(true)
        expect(obs.matches({ and: ['>= 2000px', '< 3000px'] }, 'both')).toBe(false)

        obs.dispose()
    })
})

describe('BreakpointObserver — concurrent instances', () => {
    it('multiple observers operate independently without interference', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })

        const obs1 = new BreakpointObserver({ widthBreakpoints: { a: '< 800px' } })
        const obs2 = new BreakpointObserver({ widthBreakpoints: { b: '>= 800px' } })

        expect(obs1.snapshot.activeWidthKeys).toEqual(['a'])
        expect(obs2.snapshot.activeWidthKeys).toEqual([])

        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        ;(obs1 as any)._scheduleEmitImmediate()
        ;(obs2 as any)._scheduleEmitImmediate()

        expect(obs1.snapshot.activeWidthKeys).toEqual([])
        expect(obs2.snapshot.activeWidthKeys).toEqual(['b'])

        obs1.dispose()
        obs2.dispose()
    })
})
