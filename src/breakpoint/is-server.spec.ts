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
    })

    it('canUseDOM', () => {
        expect(canUseDOM()).toBe(true)
        vi.stubGlobal('document', undefined as unknown as Document)
        expect(canUseDOM()).toBe(false)
    })

    it('canUseDOM false when createElement is null or not a function', () => {
        vi.stubGlobal('document', { createElement: null } as unknown as Document)
        expect(canUseDOM()).toBe(false)
        vi.stubGlobal('document', { createElement: 'not-a-fn' } as unknown as Document)
        expect(canUseDOM()).toBe(false)
    })

    it('canUseDOM false when window undefined (SSR)', () => {
        vi.stubGlobal('window', undefined as unknown as Window)
        expect(canUseDOM()).toBe(false)
    })

    it('getDocument returns document when present and undefined when stubbed', () => {
        expect(getDocument()).toBe(document)
        vi.stubGlobal('document', undefined as unknown as Document)
        expect(getDocument()).toBeUndefined()
    })

    it('getWindow returns window when present and undefined when stubbed', () => {
        expect(getWindow()).toBe(window)
        vi.stubGlobal('window', undefined as unknown as Window)
        expect(getWindow()).toBeUndefined()
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
        vi.stubGlobal('window', { matchMedia: null } as unknown as Window)
        expect(canUseMatchMedia()).toBe(false)
    })
})

describe('is-server — canUseResizeObserver', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('true when window.ResizeObserver exists', () => {
        expect(canUseResizeObserver()).toBe(true)
    })

    it('false when window undefined (SSR)', () => {
        vi.stubGlobal('window', undefined as unknown as Window)
        expect(canUseResizeObserver()).toBe(false)
    })

    it('false when both missing', () => {
        const w = { ...window } as unknown as Window & { ResizeObserver?: unknown }
        // @ts-ignore
        delete w.ResizeObserver
        vi.stubGlobal('window', w)
        expect(canUseResizeObserver()).toBe(false)
    })

    it('true via window.ResizeObserver', () => {
        const w = { ...window, ResizeObserver: class {} } as unknown as Window
        vi.stubGlobal('window', w)
        expect(canUseResizeObserver()).toBe(true)
    })

    it('false when ResizeObserver not function', () => {
        vi.stubGlobal('window', { ResizeObserver: null } as unknown as Window)
        expect(canUseResizeObserver()).toBe(false)
        vi.stubGlobal('window', { ResizeObserver: {} } as unknown as Window)
        expect(canUseResizeObserver()).toBe(false)
    })

    it('false when window undefined even if globalThis has RO', () => {
        vi.stubGlobal('window', undefined as unknown as Window)
        // even though vitest.setup mocks globalThis.RO, canUse should be false because it requires isBrowser()
        expect(canUseResizeObserver()).toBe(false)
    })
})

describe('is-server — canUseRequestAnimationFrame', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('true in jsdom', () => {
        expect(canUseRequestAnimationFrame()).toBe(true)
    })

    it('false when window undefined', () => {
        vi.stubGlobal('window', undefined as unknown as Window)
        expect(canUseRequestAnimationFrame()).toBe(false)
    })

    it('false when rAF missing', () => {
        const w = { ...window } as unknown as Window
        // @ts-ignore
        delete w.requestAnimationFrame
        vi.stubGlobal('window', w)
        expect(canUseRequestAnimationFrame()).toBe(false)
    })

    it('false when rAF not function', () => {
        vi.stubGlobal('window', { requestAnimationFrame: 'not-a-fn' } as unknown as Window)
        expect(canUseRequestAnimationFrame()).toBe(false)
    })
})
