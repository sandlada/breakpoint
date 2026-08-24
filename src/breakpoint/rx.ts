/**
 * rx — RxJS helpers (zero framework)
 * Provides shallowEqual, fromBreakpointObserver and other pipeable helpers
 */

import type { Observable } from 'rxjs'
import type { BreakpointObserver } from './breakpoint-observer.js'
import type { BreakpointState } from './breakpoints.js'

/**
 * Shallow compare string arrays (order-sensitive)
 */
export function shallowEqual(a: string[], b: string[]): boolean {
    if (a === b) return true
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

/**
 * Shallow compare arbitrary arrays
 */
export function shallowEqualArray<T>(a: T[], b: T[]): boolean {
    if (a === b) return true
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

/**
 * Get state stream from observer (semantic alias)
 */
export function fromBreakpointObserver(obs: BreakpointObserver): Observable<BreakpointState> {
    return obs.state$
}

/**
 * Convert BreakpointObserver to active stream
 */
export function activeFrom(obs: BreakpointObserver): Observable<string[]> {
    return obs.active$
}

/**
 * Create destroy-signal helper (framework-agnostic)
 * @example
 * const destroy$ = new Subject<void>()
 * obs.state$.pipe(takeUntil(destroy$)).subscribe(...)
 * // on unmount: destroy$.next(); destroy$.complete()
 */
export { Subject } from 'rxjs'
