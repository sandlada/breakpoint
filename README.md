# @sandlada/breakpoint

Responsive viewport / element breakpoint observer — zero framework, 100% RxJS.

A production-grade, framework-agnostic breakpoint observer for viewport and arbitrary DOM elements. Built on `rxjs@^7.8.x` only (`BehaviorSubject` + `Observable` + pipeable operators). Supports custom breakpoints, overlapping ranges, precise operator control, AND/OR composition, SSR safety, and runtime element switching.

> Correct spelling is `breakpoint`; `BreakingPointObserver` alias is exported for backward compatibility.

## Features

- **Zero framework** — no `lit` / `vue` / `react` dependencies; `rxjs` is the only runtime dependency
- **100% reactive** — `state$` (`shareReplay(1)`), `active$` / `activeHeight$` (`distinctUntilChanged` + `shareReplay`), synchronous `snapshot`
- **Viewport & element** — observe `window` by default or any `HTMLElement` via `ResizeObserver` + `rAF` coalescing; switch at runtime with `observeElement()`
- **MD3 defaults** — width (`compact <600`, `medium 600–839`, `expanded 840–1199`, `large 1200–1599`, `extraLarge >=1600`) and height (`compact <480`, `medium 480–899`, `expanded >=900`) with aliases `xs/sm/md/lg/xl`
- **String operators** — `>`, `>=`, `<`, `<=`, `=`, `==`, `!=` (e.g. `'> 840px'`, `'= 1200px'`, `'!= 960px'`), whitespace-tolerant, decimal support, `px`/`rem`
- **AND / OR composition** — `string[]` defaults to AND, `{ and: [...] }` / `{ or: [...] }` explicit
- **Overlapping ranges** — each breakpoint evaluated independently; multiple `active` values at once
- **SSR safe** — `typeof window === 'undefined'` short-circuit; first frame via `defaultMatches`
- **Tree-shakable**, `platform: 'neutral'`, ESM-only + d.ts

## Installation

```bash
npm install @sandlada/breakpoint rxjs
# or
pnpm add @sandlada/breakpoint rxjs
```

## Quick Start

```ts
import { BreakpointObserver } from '@sandlada/breakpoint'

const obs = new BreakpointObserver()
const sub = obs.state$.subscribe(s => console.log(s.active)) // ['medium']
console.log(obs.snapshot.active) // sync snapshot

// Derive streams with RxJS operators
import { map, distinctUntilChanged } from 'rxjs'
const isExpanded$ = obs.state$.pipe(
  map(s => s.active.includes('expanded')),
  distinctUntilChanged(),
)

// Cleanup (framework-agnostic)
import { Subject, takeUntil } from 'rxjs'
const destroy$ = new Subject<void>()
obs.state$.pipe(takeUntil(destroy$)).subscribe(render)
destroy$.next(); destroy$.complete(); obs.dispose()
```

## Custom Breakpoints

```ts
const obs = new BreakpointObserver({
  breakpoints: {
    a: ['> 840px', '< 1200px'],
    b: ['> 600px', '< 960px'],
    c: '= 1200px',
    extreme: { or: ['< 840px', '> 1600px'] },
    complex: { and: ['> 840px', '< 1200px', '!= 960px'] },
  }
})
```

String syntax: `[operator] [value][unit]` — `'> 840px'`, `'>= 640px'`, `'< 1200px'`, `'<= 960px'`, `'= 1600px'` / `'== 1600px'`, `'!= 960px'`. Unit `px` is optional (defaults to `px`).

Factory helpers:

```ts
import { Breakpoint } from '@sandlada/breakpoint'

Breakpoint.gt(840)          // '> 840px'
Breakpoint.between(600, 840) // { and: ['>= 600px', '< 840px'] }  // left-closed, right-open
Breakpoint.range(840, 1199)  // { and: ['>= 840px', '<= 1199px'] } // inclusive both ends
```

## Element Observer + Runtime Switching

```ts
const panel = new BreakpointObserver({
  element: document.querySelector('#panel'),
  dimension: 'both', // 'width' | 'height' | 'both'
})
panel.state$.subscribe(s => console.log(s.active, s.activeHeight))
panel.active$.subscribe(a => console.log('width active:', a))
panel.activeHeight$.subscribe(a => console.log('height active:', a))

// Switch element at runtime — old element stops triggering, new element recomputes first frame immediately
panel.observeElement(document.querySelector('#other'))
panel.unobserveElement() // back to viewport
```

## API

### `breakpoints.ts`

```ts
export const DEFAULT_BREAKPOINTS: BreakpointMap
export const DEFAULT_HEIGHT_BREAKPOINTS: HeightBreakpointMap
export const Breakpoint: { gt, gte, lt, lte, eq, ne, between, range }
export type BreakpointMap, HeightBreakpointMap, BreakpointDefinition, BreakpointCondition, BreakpointConfig, BreakpointState
```

### `BreakpointObserver`

```ts
class BreakpointObserver {
  static readonly defaultBreakpoints: BreakpointMap
  static readonly defaultHeightBreakpoints: HeightBreakpointMap

  readonly state$: Observable<BreakpointState>       // shareReplay(1)
  readonly active$: Observable<string[]>              // width hits
  readonly activeHeight$: Observable<string[]>        // height hits (dimension:'both')

  get snapshot(): BreakpointState
  getState(): BreakpointState
  get observedElement(): HTMLElement | null
  get current(): string | null
  get currentHeight(): string | null

  constructor(config?: BreakpointConfig)
  // config: { breakpoints?, heightBreakpoints?, dimension?:'width'|'height'|'both',
  //           element?: HTMLElement|null, defaultMatches?, defaultHeightMatches?,
  //           unit?:'px'|'rem', step?:number }

  isMatched(query: string | string[] | BreakpointDefinition): boolean
  observe(query: BreakpointDefinition | BreakpointDefinition[], cb?: (s: BreakpointState)=>void): () => void
  observe$(query: BreakpointDefinition): Observable<BreakpointState>
  observeElement(el: HTMLElement | null): void
  unobserveElement(): void
  dispose(): void
}
export { BreakpointObserver as BreakingPointObserver }
export const defaultBreakpointObserver: BreakpointObserver
```

`BreakpointState`:

```ts
interface BreakpointState {
  width: number; height: number
  active: string[]; activeHeight: string[]
  breakpoints: Readonly<Record<string, boolean>>
  heightBreakpoints: Readonly<Record<string, boolean>>
  matches: boolean
  current: string | null; currentHeight: string | null
}
```

### `rx.ts`

```ts
export function shallowEqual(a: string[], b: string[]): boolean
export function shallowEqualArray<T>(a: T[], b: T[]): boolean
export function fromBreakpointObserver(obs: BreakpointObserver): Observable<BreakpointState>
export function activeFrom(obs: BreakpointObserver): Observable<string[]>
```

## SSR

```ts
// Server: no window access, first frame falls back to defaultMatches
const obs = new BreakpointObserver({
  defaultMatches: { compact: true, medium: false },
})
console.log(obs.snapshot.active) // ['compact']
```

`typeof window === 'undefined' || typeof window.matchMedia === 'undefined'` guards all `window` / `ResizeObserver` / `matchMedia` access.

## License

MIT
