/**
 * Environment probing utilities for server-side rendering and browser capability detection.
 * Zero framework dependencies, tree-shakeable pure functions.
 */

/**
 * Determines whether code is currently executing in a server-side rendering environment.
 * Single source of truth for SSR detection across the library.
 *
 * @returns True if running on the server (window is undefined), false in browser.
 *
 * @example
 * ```ts
 * if (isServer()) {
 *     console.log('Running on server');
 * }
 * ```
 */
export function isServer(): boolean {
    return typeof window === 'undefined'
}

/**
 * Determines whether the current execution environment is a browser runtime.
 *
 * @returns True if running in a browser environment, false otherwise.
 *
 * @example
 * ```ts
 * if (isBrowser()) {
 *     console.log('Running in browser');
 * }
 * ```
 */
export function isBrowser(): boolean {
    return !isServer()
}

/**
 * Determines whether the DOM environment and document object are available for node creation.
 *
 * @returns True if document and document.createElement are available.
 *
 * @example
 * ```ts
 * if (canUseDOM()) {
 *     const element = document.createElement('div');
 * }
 * ```
 */
export function canUseDOM(): boolean {
    return isBrowser() && typeof document !== 'undefined' && typeof document.createElement === 'function'
}

/**
 * Determines whether the browser window supports the matchMedia API.
 *
 * @returns True if window.matchMedia is a function.
 *
 * @example
 * ```ts
 * if (canUseMatchMedia()) {
 *     const mediaQueryList = window.matchMedia('(min-width: 600px)');
 * }
 * ```
 */
export function canUseMatchMedia(): boolean {
    return isBrowser() && typeof window.matchMedia === 'function'
}

/**
 * Determines whether the ResizeObserver API is available in the current browser environment.
 *
 * @returns True if window.ResizeObserver is available as a constructor/function.
 *
 * @example
 * ```ts
 * if (canUseResizeObserver()) {
 *     const observer = new ResizeObserver(entries => {});
 * }
 * ```
 */
export function canUseResizeObserver(): boolean {
    return isBrowser() && typeof (window as unknown as { ResizeObserver?: unknown }).ResizeObserver === 'function'
}

/**
 * Determines whether the requestAnimationFrame API is available in the browser window.
 *
 * @returns True if window.requestAnimationFrame is a function.
 *
 * @example
 * ```ts
 * if (canUseRequestAnimationFrame()) {
 *     window.requestAnimationFrame(() => {});
 * }
 * ```
 */
export function canUseRequestAnimationFrame(): boolean {
    return isBrowser() && typeof window.requestAnimationFrame === 'function'
}

/**
 * Safely accesses the global Window object if running in a browser environment.
 *
 * @returns The global Window object or undefined in server environments.
 *
 * @example
 * ```ts
 * const currentWindow = getWindow();
 * const currentWidth = currentWindow ? currentWindow.innerWidth : 0;
 * ```
 */
export function getWindow(): (Window & typeof globalThis) | undefined {
    if (isBrowser()) {
        return window as unknown as Window & typeof globalThis
    }
    return undefined
}

/**
 * Safely accesses the global Document object if running in a browser DOM environment.
 *
 * @returns The global Document object or undefined in server environments.
 *
 * @example
 * ```ts
 * const currentDocument = getDocument();
 * const rootElement = currentDocument ? currentDocument.documentElement : undefined;
 * ```
 */
export function getDocument(): Document | undefined {
    if (isBrowser() && typeof document !== 'undefined') {
        return document
    }
    return undefined
}

