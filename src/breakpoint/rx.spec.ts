import { describe, expect, it } from 'vitest'
import { Subject, isShallowEqualArray, isShallowEqualRecord } from './rx.js'

describe('isShallowEqualArray', () => {
    describe('Happy Path', () => {
        it('returns true for empty arrays or identical element sequences', () => {
            expect(isShallowEqualArray([], [])).toBe(true)
            expect(isShallowEqualArray(['a', 'b'], ['a', 'b'])).toBe(true)
            expect(isShallowEqualArray([1, 2, 3], [1, 2, 3])).toBe(true)
            expect(isShallowEqualArray([true, false], [true, false])).toBe(true)
            const sameRef = ['x', 'y']
            expect(isShallowEqualArray(sameRef, sameRef)).toBe(true)
        })

        it('compares object references element by element', () => {
            const objectRef = { id: 1 }
            expect(isShallowEqualArray([objectRef], [objectRef])).toBe(true)
            expect(isShallowEqualArray([{ id: 1 }], [{ id: 1 }])).toBe(false)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('returns false for length mismatches, element position changes, or case differences', () => {
            expect(isShallowEqualArray(['a', 'b'], ['b', 'a'])).toBe(false)
            expect(isShallowEqualArray(['a'], ['a', 'b'])).toBe(false)
            expect(isShallowEqualArray(['a', 'b'], ['a'])).toBe(false)
            expect(isShallowEqualArray(['a', 'b', 'c'], ['x', 'b', 'c'])).toBe(false)
            expect(isShallowEqualArray(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe(false)
            expect(isShallowEqualArray(['a', 'b', 'c'], ['a', 'b', 'x'])).toBe(false)
            expect(isShallowEqualArray(['A'], ['a'])).toBe(false)
        })
    })
})

describe('isShallowEqualRecord', () => {
    describe('Happy Path', () => {
        it('returns true for empty records or identical boolean maps', () => {
            expect(isShallowEqualRecord({}, {})).toBe(true)
            expect(isShallowEqualRecord({ a: true, b: false }, { a: true, b: false })).toBe(true)
            const recordRef = { a: true }
            expect(isShallowEqualRecord(recordRef, recordRef)).toBe(true)
        })
    })

    describe('Boundary & Error Handling', () => {
        it('returns false when values differ or key sets mismatch', () => {
            expect(isShallowEqualRecord({ a: true, b: false }, { a: true, b: true })).toBe(false)
            expect(isShallowEqualRecord({ a: true }, { a: true, b: false })).toBe(false)
            expect(isShallowEqualRecord({ a: true, b: false }, { a: true })).toBe(false)
            expect(isShallowEqualRecord({ a: true }, { b: true })).toBe(false)
        })
    })
})

describe('Subject', () => {
    describe('Happy Path', () => {
        it('re-exports RxJS Subject capable of multicasting and teardown', () => {
            const subject = new Subject<number>()
            const receivedValues: number[] = []
            const subscription = subject.subscribe((val) => receivedValues.push(val))
            subject.next(42)
            subject.next(100)
            expect(receivedValues).toEqual([42, 100])
            subscription.unsubscribe()
            subject.next(200)
            expect(receivedValues).toEqual([42, 100])
            subject.complete()
        })
    })

    describe('RxJS Streams & Teardown', () => {
        it('handles completion signal and unsubscribes all downstream listeners', () => {
            const subject = new Subject<void>()
            let isCompleted = false
            subject.subscribe({
                complete: () => {
                    isCompleted = true
                },
            })
            subject.complete()
            expect(isCompleted).toBe(true)
        })
    })
})
