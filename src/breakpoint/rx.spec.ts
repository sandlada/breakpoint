import { describe, expect, it } from 'vitest'
import { createBreakpointObserver } from './breakpoint-observer.js'
import { Subject, isShallowEqualArray, isShallowEqualRecord } from './rx.js'

describe('rx utilities', () => {
    it('isShallowEqualArray compares generic arrays correctly', () => {
        expect(isShallowEqualArray([], [])).toBe(true)
        expect(isShallowEqualArray(['a', 'b'], ['a', 'b'])).toBe(true)
        expect(isShallowEqualArray(['a', 'b'], ['b', 'a'])).toBe(false)
        expect(isShallowEqualArray(['a'], ['a', 'b'])).toBe(false)
        expect(isShallowEqualArray(['a', 'b'], ['a'])).toBe(false)
        expect(isShallowEqualArray(['a', 'b', 'c'], ['x', 'b', 'c'])).toBe(false)
        expect(isShallowEqualArray(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe(false)
        expect(isShallowEqualArray(['a', 'b', 'c'], ['a', 'b', 'x'])).toBe(false)
        expect(isShallowEqualArray(['a', 'a'], ['a', 'a'])).toBe(true)
        expect(isShallowEqualArray(['A'], ['a'])).toBe(false)
        const arr = ['a', 'b']
        expect(isShallowEqualArray(arr, arr)).toBe(true)
        // generic checks
        expect(isShallowEqualArray([1, 2, 3], [1, 2, 3])).toBe(true)
        expect(isShallowEqualArray([1, 2], [2, 1])).toBe(false)
        expect(isShallowEqualArray([true, false], [true, false])).toBe(true)
        expect(isShallowEqualArray([true, false], [false, true])).toBe(false)
        const obj = { id: 1 }
        expect(isShallowEqualArray([obj], [obj])).toBe(true)
        expect(isShallowEqualArray([{ id: 1 }], [{ id: 1 }])).toBe(false)
    })

    it('isShallowEqualRecord compares boolean records correctly', () => {
        expect(isShallowEqualRecord({}, {})).toBe(true)
        expect(isShallowEqualRecord({ a: true, b: false }, { a: true, b: false })).toBe(true)
        expect(isShallowEqualRecord({ a: true, b: false }, { a: true, b: true })).toBe(false)
        expect(isShallowEqualRecord({ a: true }, { a: true, b: false })).toBe(false)
        expect(isShallowEqualRecord({ a: true, b: false }, { a: true })).toBe(false)
        const record = { a: true }
        expect(isShallowEqualRecord(record, record)).toBe(true)
    })

    it('createBreakpointObserver active streams via state$', () => {
        const observer = createBreakpointObserver()
        expect(observer.state$).toBeDefined()
        expect(observer.activeWidthBreakpoints$).toBeDefined()
        expect(observer.activeHeightBreakpoints$).toBeDefined()
        let emitted = false
        const sub = observer.state$.subscribe((state) => {
            expect(state.width).toBeDefined()
            emitted = true
        })
        expect(emitted).toBe(true)
        sub.unsubscribe()
        observer.dispose()
    })

    it('activeWidthBreakpoints$ shareReplay', () => {
        const observer = createBreakpointObserver({ dimension: 'both' })
        const width$ = observer.activeWidthBreakpoints$
        const valuesA: string[][] = []
        const valuesB: string[][] = []
        const subA = width$.subscribe((value) => valuesA.push(value))
        const subB = width$.subscribe((value) => valuesB.push(value))
        expect(valuesA).toEqual(valuesB)
        subA.unsubscribe()
        subB.unsubscribe()
        observer.dispose()
    })

    it('Subject re-export functions as RxJS Subject', () => {
        const subject = new Subject<number>()
        let value = 0
        subject.subscribe((emittedValue) => { value = emittedValue })
        subject.next(42)
        expect(value).toBe(42)
        subject.complete()
    })
})

