/**
 * rx — RxJS helpers (zero framework)
 */

import type { Observable } from 'rxjs'

/**
 * Shallow compare arrays (order-sensitive, reference equality per element)
 */
export function isShallowEqualArray<T>(a: T[], b: T[]): boolean {
    if (a === b) return true
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

/**
 * Create destroy-signal helper (framework-agnostic)
 * @example
 * const destroy$ = new Subject<void>()
 * obs.state$.pipe(takeUntil(destroy$)).subscribe(...)
 * // on unmount: destroy$.next(); destroy$.complete()
 */
export { Subject } from 'rxjs'
