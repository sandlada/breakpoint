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

describe('isServer & isBrowser', () => {
    afterEach(() => vi.unstubAllGlobals())

    describe('Happy Path', () => {
        it('detects browser environment when window is globally available', () => {
            expect(isServer()).toBe(false)
            expect(isBrowser()).toBe(true)
        })
    })

    describe('Environment Isolation', () => {
        it('detects server environment when window is undefined', () => {
            vi.stubGlobal('window', undefined as unknown as Window)
            expect(isServer()).toBe(true)
            expect(isBrowser()).toBe(false)
        })
    })
})

describe('getWindow & getDocument', () => {
    afterEach(() => vi.unstubAllGlobals())

    describe('Happy Path', () => {
        it('returns global window and document objects in browser runtime', () => {
            expect(getWindow()).toBe(window)
            expect(getDocument()).toBe(document)
        })
    })

    describe('Environment Isolation', () => {
        it('returns undefined when running in server environment', () => {
            vi.stubGlobal('window', undefined as unknown as Window)
            expect(getWindow()).toBeUndefined()
            vi.stubGlobal('document', undefined as unknown as Document)
            expect(getDocument()).toBeUndefined()
        })
    })
})

describe('canUseDOM', () => {
    afterEach(() => vi.unstubAllGlobals())

    describe('Happy Path', () => {
        it('returns true when document and createElement are fully available', () => {
            expect(canUseDOM()).toBe(true)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('returns false when document.createElement is missing or not a function', () => {
            vi.stubGlobal('document', { createElement: null } as unknown as Document)
            expect(canUseDOM()).toBe(false)
            vi.stubGlobal('document', { createElement: 'invalid' } as unknown as Document)
            expect(canUseDOM()).toBe(false)
        })
    })

    describe('Environment Isolation', () => {
        it('returns false when window or document is undefined in SSR', () => {
            vi.stubGlobal('window', undefined as unknown as Window)
            expect(canUseDOM()).toBe(false)
            vi.unstubAllGlobals()
            vi.stubGlobal('document', undefined as unknown as Document)
            expect(canUseDOM()).toBe(false)
        })
    })
})

describe('canUseMatchMedia', () => {
    afterEach(() => vi.unstubAllGlobals())

    describe('Happy Path', () => {
        it('returns true when window.matchMedia is a valid function', () => {
            expect(canUseMatchMedia()).toBe(true)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('returns false when matchMedia is missing or not a function', () => {
            const currentWindow = { ...window } as unknown as Window
            // @ts-ignore
            delete (currentWindow as unknown as { matchMedia?: unknown }).matchMedia
            vi.stubGlobal('window', currentWindow)
            expect(canUseMatchMedia()).toBe(false)

            vi.stubGlobal('window', { matchMedia: 'not-a-fn' } as unknown as Window)
            expect(canUseMatchMedia()).toBe(false)

            vi.stubGlobal('window', { matchMedia: 123 } as unknown as Window)
            expect(canUseMatchMedia()).toBe(false)

            vi.stubGlobal('window', { matchMedia: null } as unknown as Window)
            expect(canUseMatchMedia()).toBe(false)
        })
    })

    describe('Environment Isolation', () => {
        it('returns false in server environment', () => {
            vi.stubGlobal('window', undefined as unknown as Window)
            expect(canUseMatchMedia()).toBe(false)
        })
    })
})

describe('canUseResizeObserver', () => {
    afterEach(() => vi.unstubAllGlobals())

    describe('Happy Path', () => {
        it('returns true when ResizeObserver is available', () => {
            expect(canUseResizeObserver()).toBe(true)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('returns false when window.ResizeObserver is missing or invalid', () => {
            const currentWindow = { ...window } as unknown as Window & { ResizeObserver?: unknown }
            // @ts-ignore
            delete currentWindow.ResizeObserver
            vi.stubGlobal('window', currentWindow)
            expect(canUseResizeObserver()).toBe(false)

            vi.stubGlobal('window', { ResizeObserver: null } as unknown as Window)
            expect(canUseResizeObserver()).toBe(false)

            vi.stubGlobal('window', { ResizeObserver: {} } as unknown as Window)
            expect(canUseResizeObserver()).toBe(false)
        })
    })

    describe('Environment Isolation', () => {
        it('returns false when window is undefined in SSR', () => {
            vi.stubGlobal('window', undefined as unknown as Window)
            expect(canUseResizeObserver()).toBe(false)
        })
    })
})

describe('canUseRequestAnimationFrame', () => {
    afterEach(() => vi.unstubAllGlobals())

    describe('Happy Path', () => {
        it('returns true in browser environment with requestAnimationFrame', () => {
            expect(canUseRequestAnimationFrame()).toBe(true)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('returns false when requestAnimationFrame is missing or not a function', () => {
            const currentWindow = { ...window } as unknown as Window
            // @ts-ignore
            delete currentWindow.requestAnimationFrame
            vi.stubGlobal('window', currentWindow)
            expect(canUseRequestAnimationFrame()).toBe(false)

            vi.stubGlobal('window', { requestAnimationFrame: 'not-a-fn' } as unknown as Window)
            expect(canUseRequestAnimationFrame()).toBe(false)
        })
    })

    describe('Environment Isolation', () => {
        it('returns false in server environment', () => {
            vi.stubGlobal('window', undefined as unknown as Window)
            expect(canUseRequestAnimationFrame()).toBe(false)
        })
    })
})
