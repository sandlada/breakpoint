import { Subject, takeUntil } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BreakingPointObserver, BreakpointObserver, evaluateAll, matchesCondition, matchesDefinition, parseCondition } from './breakpoint-observer.js'
import { shallowEqual } from './rx.js'

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

describe('matchesDefinition AND/OR', () => {
    it("string[] default AND", () => {
        expect(matchesDefinition(900, ['> 840px', '< 1200px'])).toBe(true)
        expect(matchesDefinition(840, ['> 840px', '< 1200px'])).toBe(false)
        expect(matchesDefinition(1200, ['> 840px', '< 1200px'])).toBe(false)
        expect(matchesDefinition(1199, ['> 840px', '< 1200px'])).toBe(true)
        expect(matchesDefinition(960, ['> 840px', '< 1200px', '!= 960px'])).toBe(false)
        expect(matchesDefinition(961, ['> 840px', '< 1200px', '!= 960px'])).toBe(true)
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

    it("number shorthand", () => {
        expect(matchesDefinition(700, 600)).toBe(true)
        expect(matchesDefinition(500, 600)).toBe(false)
    })

    it("object min/max", () => {
        expect(matchesDefinition(700, { min: 600, max: 960 })).toBe(true)
        expect(matchesDefinition(960, { min: 600, max: 960 })).toBe(true) // inclusive default
        expect(matchesDefinition(960, { min: 600, max: 960, maxInclusive: false })).toBe(false)
        expect(matchesDefinition(600, { min: 600, minInclusive: false })).toBe(false)
        expect(matchesDefinition(600, { eq: 600 })).toBe(true)
        expect(matchesDefinition(601, { ne: 600 })).toBe(true)
        expect(matchesDefinition(600, { ne: 600 })).toBe(false)
    })
})

describe('evaluateAll overlap', () => {
    it('overlap a/b', () => {
        const map = { a: ['> 600px', '< 960px'] as const, b: ['> 840px', '< 1200px'] as const }
        // normalize to string[]
        const m: Record<string, any> = { a: ['> 600px', '< 960px'], b: ['> 840px', '< 1200px'] }
        expect(evaluateAll(900, m).active).toEqual(['a', 'b'])
        expect(evaluateAll(960, m).active).toEqual(['b']) // 960 not <960, but <1200 and >840
        // per TASK: 900 -> [a,b], 960 -> [b]? check overlap dedup handling
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
        expect(obs.snapshot.active).toContain('medium')
        expect(obs.snapshot.width).toBe(700)
        obs.dispose()
    })

    it('active$ distinctUntilChanged via shallowEqual', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const obs = new BreakpointObserver()
        const vals: string[][] = []
        const sub = obs.active$.subscribe((v) => vals.push(v))
        expect(vals.length).toBe(1)
        // force same width emission via private recompute path: simulate resize but same width -> should not emit new active
        // directly trigger scheduleEmit with same width
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
            // @ts-ignore access private for test
            ; (obs as any)._scheduleEmitImmediate()
        // active same, so no new emission due to distinctUntilChanged on active$ AND statesEqual guard in subject
        await new Promise((r) => setTimeout(r, 20))
        expect(vals.length).toBe(1)
        // now change to 900 -> should emit
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 20))
        // need check if active changed? 700 medium, 900 expanded
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
        expect(a[0].active).toContain('compact')
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
        // trigger change after destroy -> should not receive
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 0))
        expect(vals.length).toBe(1)
        obs.dispose()
    })

    it('observe returns unsubscribe', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        const obs = new BreakpointObserver({ breakpoints: { a: '> 840px' } })
        const cb = vi.fn()
        const off = obs.observe('> 840px', cb)
        expect(typeof off).toBe('function')
        // cb should have been called at least via subscription immediate? Our observe subscribes immediately so first emit
        // state$ BehaviorSubject emits immediate
        expect(cb).toHaveBeenCalled()
        const callCount = cb.mock.calls.length
        off()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
            ; (obs as any)._scheduleEmitImmediate()
        expect(cb.mock.calls.length).toBe(callCount) // not called after off
        obs.dispose()
    })

    it('observe$ filtered', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ breakpoints: { big: '>= 1000px' } })
        const vals: any[] = []
        const sub = obs.observe$('>= 1000px').subscribe((v) => vals.push(v))
        // reversal semantics: initial state emits even when not matched (false)
        expect(vals.length).toBe(1)
        expect(vals[0].active).not.toContain('big')
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 0))
        expect(vals.length).toBe(2)
        expect(vals[1].active).toContain('big')
        // reversal: leaving should also emit
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 0))
        expect(vals.length).toBe(3)
        expect(vals[2].active).not.toContain('big')
        sub.unsubscribe()
        obs.dispose()
    })

    it('dimension both independent', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ dimension: 'both' })
        expect(obs.snapshot.active).toContain('expanded')
        expect(obs.snapshot.activeHeight).toContain('medium')
        // also active$ and activeHeight$ independent
        expect(obs.snapshot.height).toBe(500)
        obs.dispose()
    })

    it('isMatched', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        const obs = new BreakpointObserver({ breakpoints: { a: ['> 840px', '< 1200px'] } })
        expect(obs.isMatched('> 840px')).toBe(true)
        expect(obs.isMatched('< 840px')).toBe(false)
        expect(obs.isMatched(['> 840px', '< 1200px'])).toBe(true)
        expect(obs.isMatched({ and: ['> 840px', '< 1200px'] })).toBe(true)
        expect(obs.isMatched({ or: ['< 840px', '> 1600px'] })).toBe(false)
        // key lookup
        expect(obs.isMatched('a')).toBe(true)
        obs.dispose()
    })

    it('snapshot current', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        const obs = new BreakpointObserver()
        expect(obs.snapshot.current).toBe('medium')
        expect(obs.current).toBe('medium')
        obs.dispose()
    })

    it('BreakingPointObserver alias', () => {
        expect(BreakingPointObserver).toBe(BreakpointObserver)
    })

    it('dispose completes and cleans', () => {
        const obs = new BreakpointObserver()
        const completed = vi.fn()
        obs.state$.subscribe({ complete: completed })
        obs.dispose()
        expect(completed).toHaveBeenCalled()
        // double dispose safe
        obs.dispose()
    })
})

describe('element strategy', () => {
    it('observeElement dynamic switch', async () => {
        const div1 = document.createElement('div')
        const div2 = document.createElement('div')
        // mock getBoundingClientRect
        vi.spyOn(div1, 'getBoundingClientRect').mockReturnValue({ width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect)
        vi.spyOn(div2, 'getBoundingClientRect').mockReturnValue({ width: 1700, height: 300, top: 0, left: 0, right: 1700, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect)

        const obs = new BreakpointObserver({
            element: div1,
            breakpoints: { extreme: { or: ['< 840px', '> 1600px'] } },
        })
        // need to flush rAF for initial?
        expect(obs.snapshot.active).toContain('extreme') // 500 <840
        expect(obs.observedElement).toBe(div1)

        // switch to div2 1700 -> extreme (>1600)
        obs.observeElement(div2)
        expect(obs.observedElement).toBe(div2)
        // immediate recompute already done in observeElement
        expect(obs.snapshot.active).toContain('extreme')

        // switch to viewport (null)
        obs.observeElement(null)
        expect(obs.observedElement).toBe(null)

        obs.dispose()
    })

    it('unobserveElement', () => {
        const div = document.createElement('div')
        vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => { } } as DOMRect)
        const obs = new BreakpointObserver({ element: div })
        expect(obs.observedElement).toBe(div)
        obs.unobserveElement()
        expect(obs.observedElement).toBe(null)
        obs.dispose()
    })

    it('ResizeObserver triggers on rAF', async () => {
        const div = document.createElement('div')
        let w = 500
        vi.spyOn(div, 'getBoundingClientRect').mockImplementation(() => ({ width: w, height: 300, top: 0, left: 0, right: w, bottom: 300, x: 0, y: 0, toJSON: () => { } } as DOMRect))
        const obs = new BreakpointObserver({ element: div, breakpoints: { a: '> 600px' } })
        expect(obs.snapshot.active).toEqual([]) // 500 not >600

        // simulate ResizeObserver callback by changing mock and triggering _scheduleEmit
        w = 800
        // @ts-ignore private
        obs['_scheduleEmitImmediate']()
        expect(obs.snapshot.active).toEqual(['a'])
        obs.dispose()
    })
})

describe('SSR defaultMatches', () => {
    it('uses defaultMatches when window undefined simulated via config', () => {
        // Simulate SSR by directly constructing with isServer true? Our isServer checks window existence.
        // In jsdom window exists, so we test by passing defaultMatches and forcing initial via _compute logic
        // Instead, test that SSR path would use defaultMatches by checking observer created with mocked window undefined
        const originalWindow = globalThis.window
        // @ts-ignore
        delete (globalThis as any).window
        const obs = new BreakpointObserver({
            breakpoints: { a: '> 840px', b: '< 600px' },
            defaultMatches: { a: true, b: false },
        })
        expect(obs.snapshot.breakpoints['a']).toBe(true)
        expect(obs.snapshot.active).toContain('a')
        expect(obs.snapshot.width).toBe(0)
        obs.dispose()
            // restore
            ; (globalThis as any).window = originalWindow
    })
})

describe('media query generation with step', () => {
    it('viewport uses matchMedia for expressible queries', () => {
        // window.matchMedia is mocked in vitest.setup.ts
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
            breakpoints: { a: '> 840px', b: '< 1200px' },
        })
        // should have created mql entries
        expect(mockMM).toHaveBeenCalled()
        // queries: >840 -> min-width: 840.05px, <1200 -> max-width: 1199.95px
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
            breakpoints: { a: { min: 600, max: 900 } as any }, // object not expressible
        })
        expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        expect(mockMM).not.toHaveBeenCalled() // fallback
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
        expect(parseCondition('> 10CM')).toEqual({ op: '>', value: 10, unit: 'cm' }) // case-insensitive
    })

    it('matchesCondition rem & em independent', () => {
        expect(matchesCondition(32, '>= 2rem')).toBe(true) // 2*16
        expect(matchesCondition(31, '>= 2rem')).toBe(false)
        expect(matchesCondition(32, '>= 2rem', 16, 20)).toBe(true)
        expect(matchesCondition(40, '>= 2em', 16, 20)).toBe(true) // 2*20
        expect(matchesCondition(39, '>= 2em', 16, 20)).toBe(false)
        // emBase independent from remBase
        expect(matchesCondition(32, '>= 2em', 16, 16)).toBe(true)
        expect(matchesCondition(40, '>= 2rem', 20, 16)).toBe(true) // rem uses remBase, em uses emBase
        expect(matchesCondition(32, '>= 2rem', 20, 16)).toBe(false) // 2*20=40 >32
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
        expect(matchesCondition(100, '>= 10vw')).toBe(true) // 10% of 1000
        expect(matchesCondition(99, '>= 10vw')).toBe(false)
        expect(matchesCondition(80, '>= 10vh')).toBe(true) // 10% of 800
        expect(matchesCondition(79, '>= 10vh')).toBe(false)
        expect(matchesCondition(80, '>= 10vmin')).toBe(true) // min 800
        expect(matchesCondition(100, '>= 10vmax')).toBe(true) // max 1000
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
        const obsRem = new BreakpointObserver({ breakpoints: { a: '>= 2rem' }, remBase: 16, emBase: 20 })
        expect(obsRem.snapshot.active).toContain('a') // 32
        obsRem.dispose()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 39 })
        const obsEm = new BreakpointObserver({ breakpoints: { a: '>= 2em' }, remBase: 16, emBase: 20 })
        expect(obsEm.snapshot.active).not.toContain('a') // 40 needed
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 40 })
        const obsEm2 = new BreakpointObserver({ breakpoints: { a: '>= 2em' }, remBase: 16, emBase: 20 })
        expect(obsEm2.snapshot.active).toContain('a')
        obsEm.dispose(); obsEm2.dispose()
    })

    it('absolute unit in observer', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 96 })
        const obs = new BreakpointObserver({ breakpoints: { a: '>= 1in' } })
        expect(obs.snapshot.active).toContain('a')
        obs.dispose()
    })
})

describe('dimension both & height — isMatched height side', () => {
    afterEach(() => vi.restoreAllMocks())

    it('both: isMatched height table key and condition', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        const obs = new BreakpointObserver({ dimension: 'both', heightBreakpoints: { h: '< 480px' } })
        expect(obs.isMatched('h')).toBe(true)
        expect(obs.isMatched('< 480px')).toBe(true) // height 400
        expect(obs.isMatched('< 840px')).toBe(true) // either width 900? actually <840 false for width but true for height 400, both => true
        // array AND in both
        expect(obs.isMatched(['> 300px', '< 500px'])).toBe(true) // height 400 matches both
        obs.dispose()
    })

    it('height dimension isolated', () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ dimension: 'height', heightBreakpoints: { m: { and: ['>= 480px', '< 900px'] } } })
        expect(obs.snapshot.active).toEqual([])
        expect(obs.snapshot.activeHeight).toContain('m')
        expect(obs.snapshot.height).toBe(500)
        expect(obs.isMatched('>= 480px')).toBe(true) // height
        obs.dispose()
    })

    it('activeHeight$ distinct', async () => {
        Object.defineProperty(window, 'innerHeight', { writable: true, value: 400 })
        const obs = new BreakpointObserver({ dimension: 'both' })
        const vals: string[][] = []
        const sub = obs.activeHeight$.subscribe(v => vals.push(v))
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

describe('observe reversal — both dimensions & edge cases', () => {
    afterEach(() => vi.restoreAllMocks())

    it('observe emits on enter and leave, dedup same matched', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ breakpoints: { a: '>= 1000px' } })
        const vals: boolean[] = []
        const off = obs.observe('>= 1000px', s => vals.push(s.active.includes('a')))
        expect(vals.length).toBe(1) // initial false
        expect(vals[0]).toBe(false)
        // still false (500->600) should not emit
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 600 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(1)
        // enter
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(2)
        expect(vals[1]).toBe(true)
        // same matched true (1200->1300) should not emit
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1300 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(2)
        // leave
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(3)
        expect(vals[2]).toBe(false)
        // callback receives current snapshot
        const last = vals[2]
        expect(last).toBe(false)
        off()
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(vals.length).toBe(3) // off
        obs.dispose()
    })

    it('observe with no cb returns noop', () => {
        const obs = new BreakpointObserver()
        const off = obs.observe('>= 600px')
        expect(typeof off).toBe('function')
        expect(() => off()).not.toThrow()
        obs.dispose()
    })

    it('observe$ null returns state$', () => {
        const obs = new BreakpointObserver()
        expect(obs.observe$(null as any)).toBe(obs.state$)
        expect(obs.observe$(undefined as any)).toBe(obs.state$)
        obs.dispose()
    })

    it('observe with and/or object query reversal', () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 })
        const obs = new BreakpointObserver({ breakpoints: { a: '> 840px' } })
        const vals: boolean[] = []
        const off = obs.observe({ and: ['> 840px', '< 1200px'] }, s => vals.push(s.active.includes('a')))
        expect(vals.length).toBe(1) // 900 matches
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1300 })
        ;(obs as any)._scheduleEmitImmediate()
        // query still matches? 1300 not <1200 so leave => false but active table a is >840 true, but query and is false
        // _isMatchedOnState uses query definition against width, so should flip to false
        expect(vals.length).toBe(2)
        off(); obs.dispose()
    })
})

describe('SSR — empty hit and both', () => {
    it('SSR without defaultMatches empty hit', () => {
        const orig = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const obs = new BreakpointObserver({ breakpoints: { a: '> 840px', b: '< 600px' } })
        expect(obs.snapshot.active).toEqual([])
        expect(obs.snapshot.breakpoints).toEqual({ a: false, b: false })
        expect(obs.snapshot.width).toBe(0)
        obs.dispose()
        ;(globalThis as any).window = orig
    })

    it('SSR both dimension empty', () => {
        const orig = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const obs = new BreakpointObserver({ dimension: 'both' })
        expect(obs.snapshot.active).toEqual([])
        expect(obs.snapshot.activeHeight).toEqual([])
        obs.dispose()
        ;(globalThis as any).window = orig
    })

    it('SSR defaultHeightMatches', () => {
        const orig = (globalThis as any).window
        // @ts-ignore
        delete (globalThis as any).window
        const obs = new BreakpointObserver({ dimension: 'height', heightBreakpoints: { h: '< 480px' }, defaultHeightMatches: { h: true } })
        expect(obs.snapshot.activeHeight).toContain('h')
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
        expect(Object.isFrozen(obs.snapshot.active)).toBe(true)
        expect(Object.isFrozen(obs.snapshot.breakpoints)).toBe(true)
        expect(Object.isFrozen(obs.snapshot.heightBreakpoints)).toBe(true)
        expect(() => (obs.snapshot.active as string[]).push('x')).toThrow()
        obs.dispose()
    })

    it('activeHeight frozen', () => {
        const obs = new BreakpointObserver({ dimension: 'both' })
        expect(Object.isFrozen(obs.snapshot.activeHeight)).toBe(true)
        obs.dispose()
    })

    it('singleton same', async () => {
        const { getDefaultBreakpointObserver, defaultBreakpointObserver } = await import('./breakpoint-observer.js')
        expect(getDefaultBreakpointObserver()).toBe(defaultBreakpointObserver)
        expect(getDefaultBreakpointObserver()).toBe(getDefaultBreakpointObserver())
    })
})

describe('rAF coalescing & ResizeObserver fallback', () => {
    it('rAF dedup — two scheduleEmit only one next', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
        const obs = new BreakpointObserver({ breakpoints: { a: '> 600px' } })
        const vals: string[][] = []
        const sub = obs.state$.subscribe(s => vals.push(s.active))
        const initial = vals.length
        // trigger two scheduleEmit without flushing
        ;(obs as any)._scheduleEmit()
        ;(obs as any)._scheduleEmit()
        // second should be ignored due to rafId
        expect((obs as any)._rafId).not.toBeNull()
        // change width to trigger actual next
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 700 })
        await new Promise(r => setTimeout(r, 30))
        expect(vals.length).toBe(initial + 1)
        sub.unsubscribe(); obs.dispose()
    })

    it('fallback to resize when RO missing', () => {
        const origRO = (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver
        // @ts-ignore
        delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver
        const origWRo = (window as unknown as { ResizeObserver?: unknown }).ResizeObserver
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
        // restore
        ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = origRO
        ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = origWRo as unknown as typeof ResizeObserver
    })

    it('observeElement null back to viewport', () => {
        const div = document.createElement('div')
        vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({ width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300, x: 0, y: 0, toJSON: () => {} } as DOMRect)
        const obs = new BreakpointObserver({ element: div })
        expect(obs.observedElement).toBe(div)
        obs.observeElement(null)
        expect(obs.observedElement).toBe(null)
        // should have viewportResizeHandler
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
        const obs = new BreakpointObserver({ breakpoints: { ext: { or: ['< 840px', '> 1600px'] }, c: '!= 960px' } })
        const calls = mockMM.mock.calls.map(c => c[0] as string)
        expect(calls.some(q => q.includes(', '))).toBe(true) // or → comma
        expect(calls.some(q => q.includes('not all and'))).toBe(true) // !=
        obs.dispose()
    })

    it('and join', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const obs = new BreakpointObserver({ breakpoints: { a: { and: ['> 840px', '< 1200px'] } } })
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
        const obs = new BreakpointObserver({ breakpoints: { a: '> 840px' } })
        // mixed: mql + resize
        expect(mockMM).toHaveBeenCalled()
        expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        obs.dispose()
        addSpy.mockRestore()
    })

    it('legacy addListener fallback', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            // no addEventListener
            dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const obs = new BreakpointObserver({ breakpoints: { a: '> 840px' } })
        expect(mockMM).toHaveBeenCalled()
        // should have called addListener via fallback
        const mql = mockMM.mock.results[0]!.value as { addListener: ReturnType<typeof vi.fn> }
        expect(mql.addListener).toHaveBeenCalled()
        obs.dispose()
    })

    it('step gap 840.01 — resize covers mql gap', async () => {
        const origW = window.innerWidth
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 840 })
        const obs = new BreakpointObserver({ breakpoints: { a: '> 840px' } })
        expect(obs.snapshot.active).not.toContain('a') // 840 not >840
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 840.01 })
        ;(obs as any)._scheduleEmitImmediate()
        expect(obs.snapshot.active).toContain('a') // numeric true
        Object.defineProperty(window, 'innerWidth', { writable: true, value: origW })
        obs.dispose()
    })

    it('custom step', () => {
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const obs = new BreakpointObserver({ breakpoints: { a: '> 840px' }, step: 0.1 })
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
        // % is invalid for width media feature, should fall back to resize (no mql)
        const mockMM = vi.fn().mockImplementation((q: string) => ({
            matches: false, media: q, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        }))
        Object.defineProperty(window, 'matchMedia', { writable: true, value: mockMM })
        const addSpy = vi.spyOn(window, 'addEventListener')
        const obs = new BreakpointObserver({ breakpoints: { a: '>= 10%' } })
        expect(mockMM).not.toHaveBeenCalled()
        expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        obs.dispose()
        addSpy.mockRestore()
    })
})

describe('shallowEqual', () => {
    it('true for same arrays', () => {
        expect(shallowEqual(['a', 'b'], ['a', 'b'])).toBe(true)
        expect(shallowEqual(['a'], ['b'])).toBe(false)
        expect(shallowEqual(['a'], ['a', 'b'])).toBe(false)
    })
})
