import { describe, expect, it } from 'vitest'
import { BreakpointObserver } from './breakpoint-observer.js'
import { Subject, isShallowEqualArray } from './rx.js'

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

    it('BreakpointObserver active streams via state$', () => {
        const obs = new BreakpointObserver()
        expect(obs.state$).toBeDefined()
        expect(obs.activeWidthKeys$).toBeDefined()
        expect(obs.activeHeightKeys$).toBeDefined()
        let emitted = false
        const sub = obs.state$.subscribe((s) => {
            expect(s.width).toBeDefined()
            emitted = true
        })
        expect(emitted).toBe(true)
        sub.unsubscribe()
        obs.dispose()
    })

    it('activeWidthKeys$ shareReplay', () => {
        const obs = new BreakpointObserver({ dimension: 'both' })
        const width$ = obs.activeWidthKeys$
        const valsA: string[][] = []
        const valsB: string[][] = []
        const subA = width$.subscribe(v => valsA.push(v))
        const subB = width$.subscribe(v => valsB.push(v))
        expect(valsA).toEqual(valsB)
        subA.unsubscribe()
        subB.unsubscribe()
        obs.dispose()
    })

    it('Subject re-export functions as RxJS Subject', () => {
        const s = new Subject<number>()
        let val = 0
        s.subscribe((v) => { val = v })
        s.next(42)
        expect(val).toBe(42)
        s.complete()
    })
})
