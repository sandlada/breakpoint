import { Subject, takeUntil } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BreakpointObserver, evaluateAll, matchesCondition, matchesDefinition, parseCondition } from './breakpoint-observer.js'
import { isShallowEqualArray } from './rx.js'

describe('parseCondition / matchesCondition', () => {
    it('parses all operators', () => {
        expect(parseCondition('> 840px')).toEqual({ op: '>', value: 840, unit: 'px' })
        expect(parseCondition('>= 640px')).toEqual({ op: '>=', value: 640, unit: 'px' })
        expect(parseCondition('< 1200px')).toEqual({ op: '<', value: 1200, unit: 'px' })
        expect(parseCondition('<= 960px')).toEqual({ op: '<=', value: 960, unit: 'px' })
        expect(parseCondition('= 1600px')).toEqual({ op: '=', value: 1600, unit: 'px' })
        expect(parseCondition('== 1600px')).toEqual({ op: '==', value: 1600, unit: 'px' })
        expect(parseCondition('!= 960px')).toEqual({ op: '!=', value: 960, unit: 'px' })
        expect(parseCondition('>840')).toEqual({ op: '>', value: 840, unit: 'px' })
        expect(parseCondition('>= 600.5px')).toEqual({ op: '>=', value: 600.5, unit: 'px' })
        expect(() => parseCondition('invalid')).toThrow(TypeError)
    })

    it('matchesCondition edges', () => {
        expect(matchesCondition(1600, '= 1600px')).toBe(true)
        expect(matchesCondition(1599, '= 1600px')).toBe(false)
        expect(matchesCondition(1600, '== 1600px')).toBe(true)
        expect(matchesCondition(960, '!= 960px')).toBe(false)
        expect(matchesCondition(961, '!= 960px')).toBe(true)
        expect(matchesCondition(840, '> 840px')).toBe(false)
        expect(matchesCondition(841, '> 840px')).toBe(true)
        expect(matchesCondition(840, '>= 840px')).toBe(true)
        expect(matchesCondition(839, '>= 840px')).toBe(false)
    })
})

describe('matchesDefinition', () => {
    it("explicit and/or", () => {
        expect(matchesDefinition(900, { and: ['> 840px', '< 1200px'] })).toBe(true)
        expect(matchesDefinition(840, { and: ['> 840px', '< 1200px'] })).toBe(false)
        expect(matchesDefinition(1200, { and: ['> 840px', '< 1200px'] })).toBe(false)
        expect(matchesDefinition(960, { and: ['> 840px', '< 1200px', '!= 960px'] })).toBe(false)
        expect(matchesDefinition(961, { and: ['> 840px', '< 1200px', '!= 960px'] })).toBe(true)
    })

    it("or logic", () => {
        const def = { or: ['< 840px', '> 1600px'] }
        expect(matchesDefinition(839, def)).toBe(true)
        expect(matchesDefinition(840, def)).toBe(false)
        expect(matchesDefinition(1600, def)).toBe(false)
        expect(matchesDefinition(1601, def)).toBe(true)
        expect(matchesDefinition(1000, def)).toBe(false)
    })

    it("and explicit", () => {
        expect(matchesDefinition(1000, { and: ['> 840px', '< 1200px', '!= 960px'] })).toBe(true)
        expect(matchesDefinition(960, { and: ['> 840px', '< 1200px', '!= 960px'] })).toBe(false)
    })

    it("object min/max", () => {
        expect(matchesDefinition(700, { min: 600, max: 960 })).toBe(true)
        expect(matchesDefinition(960, { min: 600, max: 960 })).toBe(true)
        expect(matchesDefinition(960, { min: 600, max: 960, maxInclusive: false })).toBe(false)
        expect(matchesDefinition(600, { min: 600, minInclusive: false })).toBe(false)
        expect(matchesDefinition(600, { eq: 600 })).toBe(true)
        expect(matchesDefinition(601, { ne: 600 })).toBe(true)
        expect(matchesDefinition(600, { ne: 600 })).toBe(false)
    })
})

describe('evaluateAll overlap', () => {
    it('overlap a/b', () => {
        const m: Record<string, any> = { a: { and: ['> 600px', '< 960px'] }, b: { and: ['> 840px', '< 1200px'] } }
        expect(evaluateAll(900, m).active).toEqual(['a', 'b'])
        expect(evaluateAll(960, m).active).toEqual(['b'])
        expect(evaluateAll(500, m).active).toEqual([])
        expect(evaluateAll(700, m).active).toEqual(['a'])
        expect(evaluateAll(1000, m).active).toEqual(['b'])
    })
})

describe('BreakpointObserver — viewport & state$', () => {
    const originalInnerWidth = window.innerWidth
    const originalInnerHeight = window.innerHeight

    afterEach(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: originalInnerWidth })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: originalInnerHeight })
        vi.restoreAllMocks()
    })

    it('initial active from window width', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const obs = new BreakpointObserver()
        expect(obs.snapshot.activeWidthKeys).toContain('medium')
        expect(obs.snapshot.width).toBe(700)
        obs.dispose()
    })

    it('activeWidthKeys$ distinctUntilChanged via isShallowEqualArray', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const obs = new BreakpointObserver()
        const vals: string[][] = []
        const sub = obs.activeWidthKeys$.subscribe((v) => vals.push(v))
        expect(vals.length).toBe(1)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 20))
        expect(vals.length).toBe(1)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 20))
        expect(vals.length).toBe(2)
        expect(vals[1]).toContain('expanded')
        sub.unsubscribe()
        obs.dispose()
    })

    it('state$ shareReplay(1) multicast', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const obs = new BreakpointObserver()
        const a: any[] = []
        const b: any[] = []
        const s1 = obs.state$.subscribe((v) => a.push(v))
        const s2 = obs.state$.subscribe((v) => b.push(v))
        expect(a[0]).toEqual(b[0])
        expect(a[0].activeWidthKeys).toContain('compact')
        s1.unsubscribe()
        s2.unsubscribe()
        obs.dispose()
    })

    it('takeUntil destroy pattern', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const obs = new BreakpointObserver()
        const destroy$ = new Subject<void>()
        const vals: any[] = []
        obs.state$.pipe(takeUntil(destroy$)).subscribe((v) => vals.push(v))
        expect(vals.length).toBe(1)
        destroy$.next()
        destroy$.complete()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 0))
        expect(vals.length).toBe(1)
        obs.dispose()
    })

    it('subscribe returns unsubscribe', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        const cb = vi.fn()
        const off = obs.subscribeWidth('> 840px', cb)
        expect(typeof off).toBe('function')
        expect(cb).toHaveBeenCalled()
        const callCount = cb.mock.calls.length
        off()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
            ; (obs as any)._scheduleEmitImmediate()
        expect(cb.mock.calls.length).toBe(callCount)
        obs.dispose()
    })

    it('watch filtered boolean', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ widthBreakpoints: { big: '>= 1000px' } })
        const vals: boolean[] = []
        const sub = obs.watchWidth('>= 1000px').subscribe((v) => vals.push(v))
        expect(vals.length).toBe(1)
        expect(vals[0]).toBe(false)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 0))
        expect(vals.length).toBe(2)
        expect(vals[1]).toBe(true)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 0))
        expect(vals.length).toBe(3)
        expect(vals[2]).toBe(false)
        sub.unsubscribe()
        obs.dispose()
    })

    it('dimension both independent', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ dimension: 'both' })
        expect(obs.snapshot.activeWidthKeys).toContain('expanded')
        expect(obs.snapshot.activeHeightKeys).toContain('medium')
        expect(obs.snapshot.primaryWidth).toBe('expanded')
        expect(obs.snapshot.primaryHeight).toBe('medium')
        expect(obs.primaryWidth).toBe('expanded')
        expect(obs.primaryHeight).toBe('medium')
        expect(obs.snapshot.widthMatches.expanded).toBe(true)
        expect(obs.snapshot.heightMatches.medium).toBe(true)
        expect(obs.snapshot.height).toBe(500)

        const valsW: string[][] = []
        const valsH: string[][] = []
        const subW = obs.activeWidthKeys$.subscribe(v => valsW.push(v))
        const subH = obs.activeHeightKeys$.subscribe(v => valsH.push(v))
        expect(valsW.length).toBe(1)
        expect(valsH.length).toBe(1)
        subW.unsubscribe()
        subH.unsubscribe()
        obs.dispose()
    })

    it('has / matches', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: { and: ['> 840px', '< 1200px'] } } })
        expect(obs.matchesWidth('> 840px')).toBe(true)
        expect(obs.matchesWidth('< 840px')).toBe(false)
        expect(obs.matchesWidth({ and: ['> 840px', '< 1200px'] })).toBe(true)
        expect(obs.matchesWidth({ or: ['< 840px', '> 1600px'] })).toBe(false)
        expect(obs.hasWidth('a')).toBe(true)
        expect(obs.has('a')).toBe(true)
        expect(obs.has('nonexistent')).toBe(false)
        obs.dispose()
    })

    it('snapshot primaryWidth', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const obs = new BreakpointObserver()
        expect(obs.snapshot.primaryWidth).toBe('medium')
        expect(obs.primaryWidth).toBe('medium')
        obs.dispose()
    })

    it('dispose completes and cleans', () => {
        const obs = new BreakpointObserver()
        const completed = vi.fn()
        obs.state$.subscribe({ complete: completed })
        obs.dispose()
        expect(completed).toHaveBeenCalled()
        obs.dispose()
    })
})

describe('element strategy', () => {
    it('attachElement dynamic switch', async () => {
        const div1 = document.createElement('div')
        const div2 = document.createElement('div')
        vi.spyOn(div1, 'getBoundingClientRect').mockReturnValue({ width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect)
        vi.spyOn(div2, 'getBoundingClientRect').mockReturnValue({ width: 1700, height: 300, top: 0, left: 0, right: 1700, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect)

        const obs = new BreakpointObserver({
            element: div1,
            widthBreakpoints: { extreme: { or: ['< 840px', '> 1600px'] } },
        })
        expect(obs.snapshot.activeWidthKeys).toContain('extreme')
        expect(obs.attachedElement).toBe(div1)

        obs.attachElement(div2)
        expect(obs.attachedElement).toBe(div2)
        expect(obs.snapshot.activeWidthKeys).toContain('extreme')

        obs.attachElement(null)
        expect(obs.attachedElement).toBe(null)

        obs.dispose()
    })

    it('detachElement', () => {
        const div = document.createElement('div')
        vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => { } } as DOMRect)
        const obs = new BreakpointObserver({ element: div })
        expect(obs.attachedElement).toBe(div)
        obs.detachElement()
        expect(obs.attachedElement).toBe(null)
        obs.dispose()
    })

    it('ResizeObserver triggers on rAF', async () => {
        const div = document.createElement('div')
        let w = 500
        vi.spyOn(div, 'getBoundingClientRect').mockImplementation(() => ({ width: w, height: 300, top: 0, left: 0, right: w, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect))
        const obs = new BreakpointObserver({ element: div, widthBreakpoints: { a: '> 600px' } })
        expect(obs.snapshot.activeWidthKeys).toEqual([])

        w = 800
        // @ts-ignore private
        obs['_scheduleEmitImmediate']()
        expect(obs.snapshot.activeWidthKeys).toEqual(['a'])
        obs.dispose()
    })
})

describe('SSR defaultWidthMatches', () => {
    it('uses defaultWidthMatches when window undefined', () => {
        const originalWindow = globalThis.window
        // @ts-ignore
        delete (globalThis as any).window
        const obs = new BreakpointObserver({
            widthBreakpoints: { a: '> 840px', b: '< 600px' },
            defaultWidthMatches: { a: true, b: false },
        })
        expect(obs.snapshot.widthMatches['a']).toBe(true)
        expect(obs.snapshot.activeWidthKeys).toContain('a')
        expect(obs.snapshot.width).toBe(0)
        obs.dispose()
            ; (globalThis as any).window = originalWindow
    })
})

describe('media query generation with step', () => {
    it('viewport uses matchMedia for expressible queries', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false,
            media: q,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const obs = new BreakpointObserver({
            widthBreakpoints: { a: '> 840px', b: '< 1200px' },
        })
        expect(mockMM).toHaveBeenCalled()
        const calls = mockMM.mock.calls.map((c) => c[0] as string)
        expect(calls.some((q) => q.includes('840.05'))).toBe(true)
        expect(calls.some((q) => q.includes('1199.95'))).toBe(true)
        obs.dispose()
    })

    it('fallback to resize when unexpressible (object)', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false,
            media: q,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const addSpy = vi.spyOn(window, 'addEventListener')
        const obs = new BreakpointObserver({
            widthBreakpoints: { a: { min: 600, max: 900 } as any },
        })
        expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        expect(mockMM).not.toHaveBeenCalled()
        obs.dispose()
        addSpy.mockRestore()
    })
})

describe('full units — parse & matches', () => {
    it('parseCondition full units', () => {
        expect(parseCondition('> 10vw')).toEqual({ op: '>', value: 10, unit: 'vw' })
        expect(parseCondition('>= 50vh')).toEqual({ op: '>=', value: 50, unit: 'vh' })
        expect(parseCondition('< 5em')).toEqual({ op: '<', value: 5, unit: 'em' })
        expect(parseCondition('<= 1cm')).toEqual({ op: '<=', value: 1, unit: 'cm' })
        expect(parseCondition('= 10%')).toEqual({ op: '=', value: 10, unit: '%' })
        expect(parseCondition('!= 2ex')).toEqual({ op: '!=', value: 2, unit: 'ex' })
        expect(parseCondition('> 10CM')).toEqual({ op: '>', value: 10, unit: 'cm' })
    })

    it('matchesCondition rem & em independent', () => {
        expect(matchesCondition(32, '>= 2rem')).toBe(true)
        expect(matchesCondition(31, '>= 2rem')).toBe(false)
        expect(matchesCondition(32, '>= 2rem', 16, 20)).toBe(true)
        expect(matchesCondition(40, '>= 2em', 16, 20)).toBe(true)
        expect(matchesCondition(39, '>= 2em', 16, 20)).toBe(false)
        expect(matchesCondition(32, '>= 2em', 16, 16)).toBe(true)
        expect(matchesCondition(40, '>= 2rem', 20, 16)).toBe(true)
        expect(matchesCondition(32, '>= 2rem', 20, 16)).toBe(false)
    })

    it('matchesCondition absolute units', () => {
        expect(matchesCondition(96, '>= 1in')).toBe(true)
        expect(matchesCondition(95, '>= 1in')).toBe(false)
        expect(matchesCondition(38, '>= 1cm')).toBe(true)
        expect(matchesCondition(16, '>= 1pc')).toBe(true)
        expect(matchesCondition(3.8, '>= 1mm')).toBe(true)
    })

    it('matchesCondition viewport units', () => {
        const origW = window.innerWidth
        const origH = window.innerHeight
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1000 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 })
        expect(matchesCondition(100, '>= 10vw')).toBe(true)
        expect(matchesCondition(99, '>= 10vw')).toBe(false)
        expect(matchesCondition(80, '>= 10vh')).toBe(true)
        expect(matchesCondition(79, '>= 10vh')).toBe(false)
        expect(matchesCondition(80, '>= 10vmin')).toBe(true)
        expect(matchesCondition(100, '>= 10vmax')).toBe(true)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: origW })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: origH })
    })

    it('matchesCondition non-convertible units return false numeric', () => {
        expect(matchesCondition(100, '>= 10%')).toBe(false)
        expect(matchesCondition(100, '>= 2ex')).toBe(false)
        expect(matchesCondition(100, '>= 2ch')).toBe(false)
    })

    it('evaluateAll with emBase', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        expect(evaluateAll(40, { a: '>= 2em' }, 16, 20).active).toContain('a')
        expect(evaluateAll(39, { a: '>= 2em' }, 16, 20).active).not.toContain('a')
    })
})

describe('BreakpointObserver — full units observer', () => {
    afterEach(() => vi.restoreAllMocks())

    it('remBase and emBase independent in observer', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 40 })
        const obsRem = new BreakpointObserver({ widthBreakpoints: { a: '>= 2rem' }, remBase: 16, emBase: 20 })
        expect(obsRem.snapshot.activeWidthKeys).toContain('a')
        obsRem.dispose()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 39 })
        const obsEm = new BreakpointObserver({ widthBreakpoints: { a: '>= 2em' }, remBase: 16, emBase: 20 })
        expect(obsEm.snapshot.activeWidthKeys).not.toContain('a')
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 40 })
        const obsEm2 = new BreakpointObserver({ widthBreakpoints: { a: '>= 2em' }, remBase: 16, emBase: 20 })
        expect(obsEm2.snapshot.activeWidthKeys).toContain('a')
        obsEm.dispose(); obsEm2.dispose()
    })

    it('absolute unit in observer', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 96 })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '>= 1in' } })
        expect(obs.snapshot.activeWidthKeys).toContain('a')
        obs.dispose()
    })
})

describe('dimension both & height — has/matches', () => {
    afterEach(() => vi.restoreAllMocks())

    it('both: has height key and matches condition', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        const obs = new BreakpointObserver({ dimension: 'both', heightBreakpoints: { h: '< 480px' } })
        expect(obs.hasWidth('h')).toBe(false)
        expect(obs.hasHeight('h')).toBe(true)
        expect(obs.has('h', 'both')).toBe(true)
        expect(obs.matchesWidth('< 480px')).toBe(false)
        expect(obs.matchesHeight('< 480px')).toBe(true)
        expect(obs.matches('< 840px', 'height')).toBe(true)
        expect(obs.matches('< 840px', 'both')).toBe(true)
        expect(obs.matchesWidth('< 840px')).toBe(false)
        obs.dispose()
    })

    it('height dimension isolated', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ dimension: 'height', heightBreakpoints: { m: { and: ['>= 480px', '< 900px'] } } })
        expect(obs.snapshot.activeWidthKeys).toEqual([])
        expect(obs.snapshot.activeHeightKeys).toContain('m')
        expect(obs.snapshot.height).toBe(500)
        expect(obs.matchesHeight('>= 480px')).toBe(true)
        obs.dispose()
    })

    it('activeHeightKeys$ distinct', async () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        const obs = new BreakpointObserver({ dimension: 'both' })
        const vals: string[][] = []
        const sub = obs.activeHeightKeys$.subscribe(v => vals.push(v))
        expect(vals.length).toBe(1)
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        ;(obs as any)._scheduleEmitImmediate()
        await new Promise(r => setTimeout(r, 0))
        expect(vals.length).toBe(1)
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 900 })
        ;(obs as any)._scheduleEmitImmediate()
        await new Promise(r => setTimeout(r, 0))
        expect(vals.length).toBe(2)
        sub.unsubscribe(); obs.dispose()
    })
})

describe('watch reversal', () => {
    afterEach(() => vi.restoreAllMocks())

    it('watch emits boolean on enter and leave, dedup', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '>= 1000px' } })
        const vals: boolean[] = []
        const off = obs.subscribeWidth('>= 1000px', () => {})
        const sub = obs.watchWidth('>= 1000px').subscribe(v => vals.push(v))
        expect(vals.length).toBe(1)
        expect(vals[0]).toBe(false)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 600 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(1)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(2)
        expect(vals[1]).toBe(true)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1300 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(2)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(3)
        expect(vals[2]).toBe(false)
        off()
        sub.unsubscribe()
        obs.dispose()
    })

    it('watch with and/or', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        const vals: boolean[] = []
        const sub = obs.watchWidth({ and: ['> 840px', '< 1200px'] }).subscribe(v => vals.push(v))
        expect(vals.length).toBe(1)
        expect(vals[0]).toBe(true)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1300 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(2)
        expect(vals[1]).toBe(false)
        sub.unsubscribe(); obs.dispose()
    })
})

describe('SSR — empty hit and both', () => {
    it('SSR without defaultWidthMatches empty hit', () => {
        const orig = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '> 840px', b: '< 600px' } })
        expect(obs.snapshot.activeWidthKeys).toEqual([])
        expect(obs.snapshot.widthMatches).toEqual({ a: false, b: false })
        expect(obs.snapshot.width).toBe(0)
        obs.dispose()
        ;(globalThis as any).window = orig
    })

    it('SSR both dimension empty', () => {
        const orig = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const obs = new BreakpointObserver({ dimension: 'both' })
        expect(obs.snapshot.activeWidthKeys).toEqual([])
        expect(obs.snapshot.activeHeightKeys).toEqual([])
        obs.dispose()
        ;(globalThis as any).window = orig
    })

    it('SSR defaultHeightMatches', () => {
        const orig = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const obs = new BreakpointObserver({ dimension: 'height', heightBreakpoints: { h: '< 480px' }, defaultHeightMatches: { h: true } })
        expect(obs.snapshot.activeHeightKeys).toContain('h')
        obs.dispose()
        ;(globalThis as any).window = orig
    })

    it('SSR with element still empty', () => {
        const orig = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const div = { getBoundingClientRect: () => ({ width: 500, height: 500 } as DOMRect) } as unknown as HTMLElement
        const obs = new BreakpointObserver({ element: div })
        expect(obs.snapshot.width).toBe(0)
        obs.dispose()
        ;(globalThis as any).window = orig
    })
})

describe('freeze & singleton', () => {
    it('snapshot frozen', () => {
        const obs = new BreakpointObserver()
        expect(Object.isFrozen(obs.snapshot.activeWidthKeys)).toBe(true)
        expect(Object.isFrozen(obs.snapshot.widthMatches)).toBe(true)
        expect(Object.isFrozen(obs.snapshot.heightMatches)).toBe(true)
        expect(() => (obs.snapshot.activeWidthKeys as string[]).push('x')).toThrow()
        obs.dispose()
    })

    it('activeHeight frozen', () => {
        const obs = new BreakpointObserver({ dimension: 'both' })
        expect(Object.isFrozen(obs.snapshot.activeHeightKeys)).toBe(true)
        obs.dispose()
    })

    it('static defaultWidthBreakpoints', () => {
        expect(BreakpointObserver.defaultWidthBreakpoints).toBeDefined()
    })

    it('singleton same', async () => {
        const { getDefaultViewportObserver } = await import('./breakpoint-observer.js')
        expect(getDefaultViewportObserver()).toBe(getDefaultViewportObserver())
    })
})

describe('rAF coalescing & ResizeObserver fallback', () => {
    it('rAF dedup — two scheduleEmit only one next', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '> 600px' } })
        const vals: string[][] = []
        const sub = obs.state$.subscribe(s => vals.push(s.activeWidthKeys))
        const initial = vals.length
        ;(obs as any)._scheduleEmit()
        ;(obs as any)._scheduleEmit()
        expect((obs as any)._rafId).not.toBeNull()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        await new Promise(r => setTimeout(r, 30))
        expect(vals.length).toBe(initial + 1)
        sub.unsubscribe(); obs.dispose()
    })

    it('fallback to resize when RO missing', () => {
        const origRO = (window as unknown as { ResizeObserver?: unknown }).ResizeObserver
        // @ts-ignore
        delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver
        const addSpy = vi.spyOn(window, 'addEventListener')
        const div = document.createElement('div')
        vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({ width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, x: 0, y: 0, toJSON: () => {} } as DOMRect)
        const obs = new BreakpointObserver({ element: div })
        expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        expect((obs as any)._elementResizeHandler).not.toBeNull()
        obs.dispose()
        expect((obs as any)._elementResizeHandler).toBeNull()
        addSpy.mockRestore()
        ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = origRO as unknown as typeof ResizeObserver
    })

    it('attachElement null back to viewport', () => {
        const div = document.createElement('div')
        vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({ width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, x: 0, y: 0, toJSON: () => {} } as DOMRect)
        const obs = new BreakpointObserver({ element: div })
        expect(obs.attachedElement).toBe(div)
        obs.attachElement(null)
        expect(obs.attachedElement).toBe(null)
        expect((obs as any)._viewportResizeHandler).not.toBeNull()
        obs.dispose()
    })
})

describe('media query — advanced', () => {
    it('or comma join and !=', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const obs = new BreakpointObserver({ widthBreakpoints: { ext: { or: ['< 840px', '> 1600px'] }, c: '!= 960px' } })
        const calls = mockMM.mock.calls.map(c => c[0] as string)
        expect(calls.some(q => q.includes(', '))).toBe(true)
        expect(calls.some(q => q.includes('not all and'))).toBe(true)
        obs.dispose()
    })

    it('and join', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: { and: ['> 840px', '< 1200px'] } } })
        const calls = mockMM.mock.calls.map(c => c[0] as string)
        expect(calls[0]).toContain(' and ')
        obs.dispose()
    })

    it('mql+resize mixed for step gap', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const addSpy = vi.spyOn(window, 'addEventListener')
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        expect(mockMM).toHaveBeenCalled()
        expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        obs.dispose()
        addSpy.mockRestore()
    })

    it('legacy addListener fallback', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        expect(mockMM).toHaveBeenCalled()
        const mql = mockMM.mock.results[0]!.value as { addListener: ReturnType<typeof vi.fn> }
        expect(mql.addListener).toHaveBeenCalled()
        obs.dispose()
    })

    it('step gap 840.01 — resize covers mql gap', async () => {
        const origW = window.innerWidth
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 840 })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '> 840px' } })
        expect(obs.snapshot.activeWidthKeys).not.toContain('a')
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 840.01 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(obs.snapshot.activeWidthKeys).toContain('a')
        Object.defineProperty(window, 'innerWidth', { writable: true, value: origW })
        obs.dispose()
    })

    it('custom mediaQueryExclusiveStep', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '> 840px' }, mediaQueryExclusiveStep: 0.1 })
        const calls = mockMM.mock.calls.map(c => c[0] as string)
        expect(calls[0]).toContain('840.1')
        obs.dispose()
    })
})

describe('edge — object empty throw & unsupported unit', () => {
    it('empty object throws', () => {
        expect(() => matchesDefinition(100, {} as any)).toThrow(TypeError)
    })

    it('unsupported unit % returns false numeric and falls back to resize', () => {
        expect(matchesCondition(100, '>= 10%')).toBe(false)
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const addSpy = vi.spyOn(window, 'addEventListener')
        const obs = new BreakpointObserver({ widthBreakpoints: { a: '>= 10%' } })
        expect(mockMM).not.toHaveBeenCalled()
        expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        obs.dispose()
        addSpy.mockRestore()
    })
})

describe('isShallowEqualArray', () => {
    it('true for same arrays', () => {
        expect(isShallowEqualArray(['a', 'b'], ['a', 'b'])).toBe(true)
        expect(isShallowEqualArray(['a'], ['b'])).toBe(false)
        expect(isShallowEqualArray(['a'], ['a', 'b'])).toBe(false)
    })
})
