/**
 * is-server — SSR / browser capability probes
 * Zero framework, platform:'neutral', tree-shakable pure functions
 * Single source of truth for `typeof window` guards; no `isSSR` constant (always call `isServer()`).
 */

export function isServer(): boolean {
    return typeof window === 'undefined'
}

export function isBrowser(): boolean {
    return !isServer()
}

export function canUseDOM(): boolean {
    return isBrowser() && typeof document !== 'undefined' && typeof document.createElement === 'function'
}

export function canUseMatchMedia(): boolean {
    return isBrowser() && typeof window.matchMedia === 'function'
}

export function canUseResizeObserver(): boolean {
    return isBrowser() && typeof (window as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'function'
}

export function canUseRequestAnimationFrame(): boolean {
    return isBrowser() && typeof window.requestAnimationFrame === 'function'
}

export function getWindow(): (Window & typeof globalThis) | undefined {
    if (typeof window !== 'undefined') return window as unknown as Window & typeof globalThis
    return undefined
}

export function getDocument(): Document | undefined {
    if (typeof document !== 'undefined') return document
    return undefined
}
