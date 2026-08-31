# @sandlada/breakpoint

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-2ea44f?style=flat&logo=github)](https://sandlada.github.io/breakpoint/)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/sandlada/breakpoint)

Responsive viewport / element breakpoint observer — zero framework, pure functional, data-last, 100% RxJS.

A production-grade, framework-agnostic breakpoint evaluation and observation library for viewport and arbitrary DOM elements. Built with a pure functional, higher-order function, parameter-last architecture on `rxjs@^7.8.x`. Supports custom breakpoints, overlapping ranges, precise operator control, AND/OR composition, SSR safety, zero top-level side effects, and runtime element switching with fully symmetric width and height dimensions.

## Features

- **Zero framework** — pure functional design; no class instances, `rxjs` is the only runtime dependency
- **100% reactive** — `state$` (`shareReplay(1)`), `activeWidthBreakpoints$` / `activeHeightBreakpoints$` (`distinctUntilChanged` + `shareReplay`), synchronous `snapshot`
- **Data-last & currying** — `matchesBreakpointDefinition(def)(widthPx)`, `evaluateBreakpointMap(map)(widthPx)`
- **Viewport & element** — observe `window` by default or any `HTMLElement` via `ResizeObserver` + `rAF` coalescing; switch at runtime with `attachElement()`
- **MD3 defaults** — width (`compact <600`, `medium 600–839`, `expanded 840–1199`, `large 1200–1599`, `extraLarge >=1600`) and height (`compact <480`, `medium 480–899`, `expanded >=900`) with aliases `xs/sm/md/lg/xl`
- **String operators** — `>`, `>=`, `<`, `<=`, `=`, `==`, `!=` (e.g. `'> 840px'`, `'= 1200px'`, `'!= 960px'`), whitespace-tolerant, decimal support, `px`/`rem`/`em` and absolute/viewport units
- **AND / OR composition** — `{ and: [...] }` / `{ or: [...] }` explicit composition
- **Overlapping ranges** — each breakpoint evaluated independently; multiple active breakpoints simultaneously
- **SSR safe** — strict `typeof window === 'undefined'` short-circuit; initial state configured via `defaultWidthMatches` / `defaultHeightMatches`
- **Tree-shakable & zero top-level side-effects** (`"sideEffects": false`), ESM-only with unbundled module structure + `d.ts`

## Install

```bash
# npm
npm install @sandlada/breakpoint rxjs
```

## Live Demos (GitHub Pages)

Explore interactive examples directly in your browser without local installation:

| Demo Scene | Description | Live Link |
| :--- | :--- | :--- |
| **1. Viewport MD3 Basics** | Standard Material Design 3 viewport breakpoints (`compact`, `medium`, `expanded`, `large`, `extraLarge`) | [🌐 Open Live Demo](https://sandlada.github.io/breakpoint/index.html) |
| **2. Container Breakpoints** | ResizeObserver-driven element container queries with resizable DOM box & runtime switching | [🌐 Open Live Demo](https://sandlada.github.io/breakpoint/element-query.html) |
| **3. Custom & Composition** | Custom operators (`>`, `<=`, `!=`), `rem`/`em` units, and `{ and: [...] }` / `{ or: [...] }` logical composition | [🌐 Open Live Demo](https://sandlada.github.io/breakpoint/custom-conditions.html) |
| **4. Height & 2D Observer** | Symmetric viewport height breakpoints & 2D dual-dimension responsive metrics | [🌐 Open Live Demo](https://sandlada.github.io/breakpoint/height-observer.html) |
| **5. RxJS Streams & Lifecycle** | Cold observables (`observeWidthBreakpoint`), RxJS pipe operators, and auto-cleanup | [🌐 Open Live Demo](https://sandlada.github.io/breakpoint/rxjs-streams.html) |

## Usages

### Quick Start

> 🌐 **Live Demo**: [Try MD3 Viewport Observer on GitHub Pages](https://sandlada.github.io/breakpoint/index.html)

```ts
import { createBreakpointObserver } from '@sandlada/breakpoint'

const observer = createBreakpointObserver()

// Subscribe to state stream
const subscription = observer.state$.subscribe((state) => {
    console.log(state.activeWidthBreakpoints) // e.g. ['medium', 'sm']
    console.log(state.widthMatches)           // { compact: false, medium: true, ... }
})

// Read synchronous snapshot
console.log(observer.snapshot.activeWidthBreakpoints)

// Clean up when done
subscription.unsubscribe()
observer.dispose()
```

### Standalone Reactive Streams

> 🌐 **Live Demo**: [Try RxJS Streams & Lifecycle on GitHub Pages](https://sandlada.github.io/breakpoint/rxjs-streams.html)

```ts
import {
    observeBreakpointState,
    observeWidthBreakpoint,
    observeActiveWidthBreakpoints,
} from '@sandlada/breakpoint'

// Observe a single condition stream (cold observable, auto-cleans on unsubscription)
const isExpanded$ = observeWidthBreakpoint('>= 840px')
const sub1 = isExpanded$.subscribe((isExpanded) => {
    console.log('isExpanded:', isExpanded)
})

// Observe active breakpoint keys stream
const activeKeys$ = observeActiveWidthBreakpoints()
const sub2 = activeKeys$.subscribe((keys) => {
    console.log('active keys:', keys)
})

// Unsubscribe to clean up underlying listeners
sub1.unsubscribe()
sub2.unsubscribe()
```

### Pure Functional Evaluation & Currying (Data-Last)

All evaluation functions support direct invocation, curried (data-last) partial application, and argument reordering:

```ts
import {
    matchesBreakpointCondition,
    matchesBreakpointDefinition,
    evaluateBreakpointMap,
    DEFAULT_WIDTH_BREAKPOINTS,
} from '@sandlada/breakpoint'

// 1. Curried condition evaluation (data-last)
const isLargeWidth = matchesBreakpointCondition('>= 1200px')
console.log(isLargeWidth(1440)) // true
console.log(isLargeWidth(800))  // false

// 2. Direct condition evaluation
console.log(matchesBreakpointCondition('>= 1200px', 1440)) // true
console.log(matchesBreakpointCondition(1440, '>= 1200px')) // true

// 3. Definition evaluation with AND/OR logic
const isTablet = matchesBreakpointDefinition({ and: ['>= 600px', '< 1024px'] })
console.log(isTablet(768)) // true

// 4. Map evaluation
const evaluateMd3 = evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS)
const result = evaluateMd3(1024)
console.log(result.activeBreakpoints) // ['expanded', 'md']
console.log(result.matchesTable)     // { compact: false, medium: false, expanded: true, ... }
```

### Custom Breakpoints & Logical Composition

> 🌐 **Live Demo**: [Try Custom Conditions & Composition on GitHub Pages](https://sandlada.github.io/breakpoint/custom-conditions.html)

```ts
import { createBreakpointObserver, Breakpoint } from '@sandlada/breakpoint'

const observer = createBreakpointObserver({
    widthBreakpoints: {
        mobile: '< 600px',
        tablet: Breakpoint.interval(600, 1024),
        desktop: '>= 1024px',
        customOr: { or: ['< 480px', '>= 1920px'] },
        customAnd: { and: ['>= 768px', '<= 1440px'] },
        customRange: { min: 600, max: 960, minInclusive: true, maxInclusive: false },
    },
})
```

### Element Observation & Runtime Switching

> 🌐 **Live Demo**: [Try Element Container Queries on GitHub Pages](https://sandlada.github.io/breakpoint/element-query.html)

```ts
import { createBreakpointObserver } from '@sandlada/breakpoint'

const containerElement = document.querySelector('#container') as HTMLElement

const containerObserver = createBreakpointObserver({
    element: containerElement,
    dimension: 'both', // 'width' | 'height' | 'both'
})

containerObserver.state$.subscribe((state) => {
    console.log(state.width, state.height)
    console.log(state.activeWidthBreakpoints, state.activeHeightBreakpoints)
})

// Switch observed element at runtime
const otherElement = document.querySelector('#sidebar') as HTMLElement
containerObserver.attachElement(otherElement)

// Detach element to fall back to viewport observation
containerObserver.detachElement()

// Destroy observer and disconnect ResizeObserver
containerObserver.dispose()
```

### Server-Side Rendering (SSR)

The library safely evaluates on Node.js/SSR environments without window errors:

```ts
import { createBreakpointObserver, isServer } from '@sandlada/breakpoint'

console.log(isServer()) // true on server

const ssrObserver = createBreakpointObserver({
    defaultWidthMatches: {
        compact: true,
        medium: false,
        expanded: false,
    },
})

// Synchronous snapshot and initial stream values use defaults
console.log(ssrObserver.snapshot.activeWidthBreakpoints) // ['compact']
```

## API Reference

### Observer & Stream Creators

- `createBreakpointObserver(configuration?: BreakpointConfiguration): BreakpointObserverInstance`
- `observeBreakpointState(configuration?: BreakpointConfiguration): Observable<BreakpointState>`
- `observeBreakpoint(definition: BreakpointDefinition, dimension?: BreakpointDimension, configuration?: BreakpointConfiguration): Observable<boolean>`
- `observeWidthBreakpoint(definition: BreakpointDefinition, configuration?: BreakpointConfiguration): Observable<boolean>`
- `observeHeightBreakpoint(definition: BreakpointDefinition, configuration?: BreakpointConfiguration): Observable<boolean>`
- `observeActiveBreakpoints(dimension?: BreakpointDimension, configuration?: BreakpointConfiguration): Observable<string[]>`
- `observeActiveWidthBreakpoints(configuration?: BreakpointConfiguration): Observable<string[]>`
- `observeActiveHeightBreakpoints(configuration?: BreakpointConfiguration): Observable<string[]>`
- `getDefaultViewportObserver(): BreakpointObserverInstance`

### Pure Evaluation & Transformation Functions

- `parseBreakpointCondition(conditionString: BreakpointCondition): ParsedBreakpointCondition`
- `matchesBreakpointCondition(condition: BreakpointCondition, options?: BreakpointEvaluationOptions): (value: number) => boolean`
- `matchesBreakpointCondition(condition: BreakpointCondition, value: number, options?: BreakpointEvaluationOptions): boolean`
- `matchesBreakpointCondition(value: number, condition: BreakpointCondition, options?: BreakpointEvaluationOptions): boolean`
- `matchesBreakpointDefinition(definition: BreakpointDefinition, options?: BreakpointEvaluationOptions): (value: number) => boolean`
- `matchesBreakpointDefinition(definition: BreakpointDefinition, value: number, options?: BreakpointEvaluationOptions): boolean`
- `matchesBreakpointDefinition(value: number, definition: BreakpointDefinition, options?: BreakpointEvaluationOptions): boolean`
- `evaluateBreakpointMap(map: BreakpointMap, options?: BreakpointEvaluationOptions): (value: number) => BreakpointEvaluationResult`
- `evaluateBreakpointMap(map: BreakpointMap, value: number, options?: BreakpointEvaluationOptions): BreakpointEvaluationResult`
- `evaluateBreakpointMap(value: number, map: BreakpointMap, options?: BreakpointEvaluationOptions): BreakpointEvaluationResult`
- `computeBreakpointState(targetWidthPx: number, targetHeightPx: number, configuration?: BreakpointConfiguration): BreakpointState`
- `convertConditionToMediaQuery(condition: BreakpointCondition, dimension: 'width' | 'height', mediaQueryExclusiveStep: number): string | null`
- `convertDefinitionToMediaQuery(definition: BreakpointDefinition, dimension: 'width' | 'height', mediaQueryExclusiveStep: number): string | null`

### Breakpoint Builders & Helpers

- `Breakpoint.gt(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `Breakpoint.gte(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `Breakpoint.lt(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `Breakpoint.lte(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `Breakpoint.eq(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `Breakpoint.ne(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `Breakpoint.interval(min: number, max: number, options?: BreakpointIntervalOptions): BreakpointDefinition`
- `Breakpoint.between(min: number, max: number, options?: BreakpointIntervalOptions): BreakpointDefinition`
- `greaterThan(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `greaterThanOrEqual(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `lessThan(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `lessThanOrEqual(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `equals(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `notEquals(value: number, unit?: BreakpointUnit): BreakpointCondition`
- `createBreakpointInterval(min: number, max: number, options?: BreakpointIntervalOptions): BreakpointDefinition`

### Environment & SSR Utilities

- `isServer(): boolean`
- `isBrowser(): boolean`
- `canUseDOM(): boolean`
- `canUseMatchMedia(): boolean`
- `canUseResizeObserver(): boolean`
- `canUseRequestAnimationFrame(): boolean`
- `getWindow(): (Window & typeof globalThis) | undefined`
- `getDocument(): Document | undefined`

### Reactive & Comparison Utilities

- `Subject` (re-exported from `rxjs`)
- `isShallowEqualArray<T>(firstArray: readonly T[], secondArray: readonly T[]): boolean`
- `isShallowEqualRecord(firstRecord: Readonly<Record<string, boolean>>, secondRecord: Readonly<Record<string, boolean>>): boolean`

### Constants

- `DEFAULT_WIDTH_BREAKPOINTS: Readonly<WidthBreakpointMap>`
- `DEFAULT_HEIGHT_BREAKPOINTS: Readonly<HeightBreakpointMap>`
- `ABSOLUTE_PX: Readonly<Record<AbsoluteBreakpointUnit, number>>`
- `REM_BASE: number` (16)
- `EM_BASE: number` (16)

### Types & Interfaces

- `BreakpointObserverInstance`
- `BreakpointState`
- `BreakpointConfiguration`
- `BreakpointDefinition`
- `BreakpointCondition`
- `BreakpointRange`
- `BreakpointDimension` (`'width' | 'height' | 'both'`)
- `BreakpointLogic` (`'and' | 'or'`)
- `BreakpointUnit` / `ParsedBreakpointUnit`
- `AbsoluteBreakpointUnit`
- `WidthBreakpointMap` / `HeightBreakpointMap` / `BreakpointMap`
- `BreakpointEvaluationOptions`
- `BreakpointEvaluationResult`
- `BreakpointIntervalOptions`
- `ParsedBreakpointCondition`

## Testing & Quality Assurance

This repository employs a **Spec-First / Black-Box** testing methodology. Tests verify interface signatures, mathematical boundary constraints, and lifecycle contracts without coupling to internal implementations.

Each test suite organizes specifications with structured nested `describe` blocks:
- **`Happy Path`**: Standard valid inputs, mathematical interval correctness, state calculations, and currying equivalence.
- **`Boundary & Error Handling`**: Critical boundary transitions (±1px, 0px, float precision), malformed syntax exceptions (`TypeError`), and empty or unsupported unit fallbacks.
- **`RxJS Streams & Teardown`**: Cold observable verification, initial synchronous emissions, multi-subscriber multicast, `distinctUntilChanged` deduplication, and complete listener release upon `unsubscribe()` / `dispose()`.
- **`Environment Isolation`**: SSR safety (`isServer: true`), custom `defaultWidthMatches` / `defaultHeightMatches` fallback handling, and graceful degradation when browser APIs are unavailable.

```bash
npm run lint:types    # Typecheck with tsc --noEmit
npm test              # Run vitest test suite
npm run build         # Build dist via tsdown
```

## License

MIT
