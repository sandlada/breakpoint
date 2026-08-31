/**
 * RxJS and equality utilities for reactive breakpoint streams.
 * Zero framework dependencies, pure functions.
 */

import type { Observable } from 'rxjs'

/**
 * Compares two arrays for shallow element-by-element reference equality.
 *
 * @param firstArray - The first array to compare.
 * @param secondArray - The second array to compare.
 * @returns True if both arrays have the same length and identical elements at every index.
 *
 * @example
 * ```ts
 * isShallowEqualArray(['compact', 'medium'], ['compact', 'medium']); // true
 * isShallowEqualArray(['compact'], ['medium']); // false
 * ```
 */
export function isShallowEqualArray<T>(firstArray: readonly T[], secondArray: readonly T[]): boolean {
    if (firstArray === secondArray) {
        return true
    }
    if (firstArray.length !== secondArray.length) {
        return false
    }
    for (let index = 0; index < firstArray.length; index++) {
        if (firstArray[index] !== secondArray[index]) {
            return false
        }
    }
    return true
}

/**
 * Compares two boolean dictionary records for shallow key-value equality.
 *
 * @param firstRecord - The first record to compare.
 * @param secondRecord - The second record to compare.
 * @returns True if both records have identical keys and matching boolean values.
 *
 * @example
 * ```ts
 * isShallowEqualRecord({ compact: true }, { compact: true }); // true
 * isShallowEqualRecord({ compact: true }, { compact: false }); // false
 * ```
 */
export function isShallowEqualRecord(
    firstRecord: Readonly<Record<string, boolean>>,
    secondRecord: Readonly<Record<string, boolean>>,
): boolean {
    if (firstRecord === secondRecord) {
        return true
    }
    const firstKeys = Object.keys(firstRecord)
    const secondKeys = Object.keys(secondRecord)
    if (firstKeys.length !== secondKeys.length) {
        return false
    }
    for (const key of firstKeys) {
        if (firstRecord[key] !== secondRecord[key]) {
            return false
        }
    }
    return true
}

/**
 * Re-export of RxJS Subject for framework-agnostic teardown signaling.
 *
 * @example
 * ```ts
 * const destroy$ = new Subject<void>();
 * state$.pipe(takeUntil(destroy$)).subscribe(...);
 * destroy$.next();
 * destroy$.complete();
 * ```
 */
export { Subject } from 'rxjs'

