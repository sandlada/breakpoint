import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    canUseDOM,
    canUseMatchMedia,
    canUseRequestAnimationFrame,
    canUseResizeObserver,
    getDocument,
    getWindow,
    isBrowser,
    isServer,
} from './is-server.js'

describe('is-server — isServer / isBrowser', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('isServer false in jsdom', () => {
        expect(isServer()).toBe(false)
        expect(isBrowser()).toBe(true)
    })

    it('isServer true when window undefined', () => {
        vi.stubGlobal('window', undefined as unknown as Window)
        expect(isServer()).toBe(true)
        expect(isBrowser()).toBe(false)
    })

    it('getWindow / getDocument', () => {
        expect(getWindow()).toBeDefined()
        expect(getDocument()).toBeDefined()
        vi.stubGlobal('window', undefined as unknown as Window)
        expect(getWindow()).toBeUndefined()
        // document may still exist in jsdom even without window; isServer true implies getWindow undefined
    })

    it('canUseDOM', () => {
        expect(canUseDOM()).toBe(true)
        vi.stubGlobal('document', undefined as unknown as Document)
        expect(canUseDOM()).toBe(false)
    })

    it('canUseDOM false when createElement not function', () => {
        vi.stubGlobal('document', { createElement: 42 } as unknown as Document)
        expect(canUseDOM()).toBe(false)
    })

    it('getDocument undefined when document missing', () => {
        vi.stubGlobal('document', undefined as unknown as Document)
        expect(getDocument()).toBeUndefined()
    })
})

describe('is-server — canUseMatchMedia', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('true when window.matchMedia exists', () => {
        expect(canUseMatchMedia()).toBe(true)
    })

    it('false when window undefined', () => {
        vi.stubGlobal('window', undefined as unknown as Window)
        expect(canUseMatchMedia()).toBe(false)
    })

    it('false when matchMedia missing', () => {
        const w = { ...window } as unknown as Window
        // @ts-ignore
        delete (w as unknown as { matchMedia?: unknown }).matchMedia
        vi.stubGlobal('window', w)
        expect(canUseMatchMedia()).toBe(false)
    })

    it('false when matchMedia not function', () => {
        vi.stubGlobal('window', { matchMedia: 'not-a-function' } as unknown as Window)
        expect(canUseMatchMedia()).toBe(false)
        vi.stubGlobal('window', { matchMedia: 42 } as unknown as Window)
        expect(canUseMatchMedia()).toBe(false)
    })
})

describe('is-server — canUseResizeObserver', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('true when globalThis.ResizeObserver exists (vitest.setup mock)', () => {
        expect(canUseResizeObserver()).toBe(true)
    })

    it('false when both missing', () => {
        vi.stubGlobal('ResizeObserver', undefined as unknown as typeof ResizeObserver)
        const w = { ...window } as unknown as Window & { ResizeObserver?: unknown }
        // @ts-ignore
        delete w.ResizeObserver
        vi.stubGlobal('window', w)
        expect(canUseResizeObserver()).toBe(false)
    })

    it('true via window.ResizeObserver fallback', () => {
        vi.stubGlobal('ResizeObserver', undefined as unknown as typeof ResizeObserver)
        const w = { ...window, ResizeObserver: class {} } as unknown as Window
        vi.stubGlobal('window', w)
        expect(canUseResizeObserver()).toBe(true)
    })

    it('false when ResizeObserver not function', () => {
        vi.stubGlobal('ResizeObserver', {} as unknown as typeof ResizeObserver)
        vi.stubGlobal('window', { ResizeObserver: null } as unknown as Window)
        expect(canUseResizeObserver()).toBe(false)
    })

    it('true when globalThis has RO but window undefined (SSR)', () => {
        vi.stubGlobal('window', undefined as unknown as Window)
        // globalThis still has mock RO from setup
        expect(canUseResizeObserver()).toBe(true)
    })
})

describe('is-server — canUseRequestAnimationFrame', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('true in jsdom (vitest.setup polyfills)', () => {
        expect(canUseRequestAnimationFrame()).toBe(true)
    })

    it('false when stubbed', () => {
        const w = { ...window } as unknown as Window
        // @ts-ignore
        delete w.requestAnimationFrame
        vi.stubGlobal('window', w)
        vi.stubGlobal('requestAnimationFrame', undefined as unknown as typeof requestAnimationFrame)
        // globalThis.requestAnimationFrame may still exist via stub? Force delete
        // @ts-ignore
        const g = globalThis as unknown as { requestAnimationFrame?: unknown }
        const prev = g.requestAnimationFrame
        // @ts-ignore
        delete g.requestAnimationFrame
        expect(canUseRequestAnimationFrame()).toBe(false)
        // restore
        // @ts-ignore
        g.requestAnimationFrame = prev
    })

    it('true via window.rAF when globalThis missing', () => {
        const g = globalThis as unknown as { requestAnimationFrame?: unknown }
        const prevG = g.requestAnimationFrame
        const prevW = (window as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame
        // @ts-ignore
        delete g.requestAnimationFrame
        // window still has rAF in jsdom, but globalThis===window in jsdom so both deleted; re-stub window
        vi.stubGlobal('window', { requestAnimationFrame: prevW } as unknown as Window)
        expect(canUseRequestAnimationFrame()).toBe(true)
        // @ts-ignore
        g.requestAnimationFrame = prevG
    })

    it('true via globalThis.rAF when window missing', () => {
        vi.stubGlobal('window', undefined as unknown as Window)
        vi.stubGlobal('requestAnimationFrame', (() => 1) as unknown as typeof requestAnimationFrame)
        expect(canUseRequestAnimationFrame()).toBe(true)
    })
})
