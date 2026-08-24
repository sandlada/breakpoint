import { Subject, takeUntil } from 'rxjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BreakingPointObserver, BreakpointObserver, evaluateAll, matchesCondition, matchesDefinition, parseCondition } from './breakpoint-observer.js'
import { Breakpoint, DEFAULT_BREAKPOINTS, DEFAULT_HEIGHT_BREAKPOINTS } from './breakpoints.js'
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

describe('DEFAULT_BREAKPOINTS', () => {
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
})

describe('Breakpoint factory', () => {
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
        // 500 not match -> no emission (BehaviorSubject initial state not matched)
        expect(vals.length).toBe(0)
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
            ; (obs as any)._scheduleEmitImmediate()
        await new Promise((r) => setTimeout(r, 0))
        expect(vals.length).toBe(1)
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

describe('shallowEqual', () => {
    it('true for same arrays', () => {
        expect(shallowEqual(['a', 'b'], ['a', 'b'])).toBe(true)
        expect(shallowEqual(['a'], ['b'])).toBe(false)
        expect(shallowEqual(['a'], ['a', 'b'])).toBe(false)
    })
})
