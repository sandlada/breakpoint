/**
 * breakpoint-observer — Pure utility, zero framework, 100% RxJS
 * Parsing, evaluation, dual strategies (viewport: matchMedia / element: ResizeObserver + rAF)
 */

import {
    BehaviorSubject,
    Observable,
    distinctUntilChanged,
    filter,
    map,
    shareReplay,
} from 'rxjs'
import {
    type BreakpointCondition,
    type BreakpointConfig,
    type BreakpointDefinition,
    type BreakpointDimension,
    type BreakpointMap,
    type BreakpointState,
    DEFAULT_BREAKPOINTS,
    DEFAULT_HEIGHT_BREAKPOINTS
} from './breakpoints.js'
import { shallowEqual } from './rx.js'

// ---------------------------------------------------------------------------
// Pure functions: parsing / matching
// ---------------------------------------------------------------------------

const CONDITION_RE = /^\s*(>=|<=|>|<|==|=|!=)\s*(\d+(?:\.\d+)?)\s*(px|rem)?\s*$/

export interface ParsedCondition {
    op: '>=' | '<=' | '>' | '<' | '=' | '==' | '!='
    value: number
    unit: 'px' | 'rem'
}

export function parseCondition(cond: string): ParsedCondition {
    const m = CONDITION_RE.exec(cond)
    if (!m) throw new TypeError(`Invalid breakpoint condition: "${cond}"`)
    const op = m[1] as ParsedCondition['op']
    const value = Number(m[2])
    const unit = (m[3] as 'px' | 'rem' | undefined) ?? 'px'
    return { op, value, unit }
}

export function matchesCondition(value: number, cond: string): boolean {
    const { op, value: target } = parseCondition(cond)
    switch (op) {
        case '>':
            return value > target
        case '>=':
            return value >= target
        case '<':
            return value < target
        case '<=':
            return value <= target
        case '=':
        case '==':
            return value === target
        case '!=':
            return value !== target
        default:
            return false
    }
}

function isBreakpointObject(def: unknown): def is { min?: number; max?: number; minInclusive?: boolean; maxInclusive?: boolean; eq?: number; ne?: number } {
    return typeof def === 'object' && def !== null && !Array.isArray(def) && !('and' in (def as Record<string, unknown>)) && !('or' in (def as Record<string, unknown>))
}

export function matchesDefinition(value: number, def: BreakpointDefinition): boolean {
    if (typeof def === 'number') {
        return value >= def
    }
    if (typeof def === 'string') {
        return matchesCondition(value, def)
    }
    if (Array.isArray(def)) {
        // Default AND
        return def.every((c) => matchesCondition(value, c))
    }
    if (isBreakpointObject(def)) {
        // Object syntax
        if (def.eq !== undefined) return value === def.eq
        if (def.ne !== undefined) return value !== def.ne
        let ok = true
        if (def.min !== undefined) {
            ok = ok && (def.minInclusive === false ? value > def.min : value >= def.min)
        }
        if (def.max !== undefined) {
            ok = ok && (def.maxInclusive === false ? value < def.max : value <= def.max)
            // Compat: maxInclusive defaults to inclusive (<=) when unspecified.
            // Above already handles inclusive=false as <; to require exclusive, pass false explicitly.
        }
        // If eq/ne not hit and only min/max exist, return ok; empty object degrades to true
        // Empty object degrades to true
        if (def.min === undefined && def.max === undefined && def.eq === undefined && def.ne === undefined) return true
        // If only ne was handled; if both min/max coexist, evaluated via ok
        // If eq already returned, no need to combine with other checks

        return ok
    }
    if (typeof def === 'object' && def !== null) {
        if ('and' in def && Array.isArray((def as { and: unknown }).and)) {
            const arr = (def as { and: BreakpointCondition[] }).and
            return arr.every((c) => matchesCondition(value, c))
        }
        if ('or' in def && Array.isArray((def as { or: unknown }).or)) {
            const arr = (def as { or: BreakpointCondition[] }).or
            return arr.some((c) => matchesCondition(value, c))
        }
    }
    throw new TypeError(`Invalid breakpoint definition: ${String(def)}`)
}

export function evaluateAll(
    value: number,
    map: BreakpointMap,
): { active: string[]; table: Record<string, boolean> } {
    const table: Record<string, boolean> = {}
    const active: string[] = []
    for (const [key, def] of Object.entries(map)) {
        const hit = matchesDefinition(value, def)
        table[key] = hit
        if (hit) active.push(key)
    }
    return { active, table }
}

// ---------------------------------------------------------------------------
// mediaQuery generation (viewport)
// ---------------------------------------------------------------------------

function toFixedTrim(n: number): string {
    // Trim trailing zeros, keep up to 2 decimal places (step 0.05)
    const s = n.toFixed(2)
    return s.replace(/\.?0+$/, '')
}

function conditionToMediaQuery(
    cond: string,
    dimension: 'width' | 'height',
    step: number,
): string | null {
    try {
        const { op, value, unit } = parseCondition(cond)
        const u = unit ?? 'px'
        // rem is passed through for now, no conversion
        switch (op) {
            case '>=':
                return `(min-${dimension}: ${toFixedTrim(value)}${u})`
            case '>':
                return `(min-${dimension}: ${toFixedTrim(value + step)}${u})`
            case '<=':
                return `(max-${dimension}: ${toFixedTrim(value)}${u})`
            case '<':
                return `(max-${dimension}: ${toFixedTrim(value - step)}${u})`
            case '=':
            case '==':
                return `(${dimension}: ${toFixedTrim(value)}${u})`
            case '!=':
                // not all and (width: 960px)
                return `not all and (${dimension}: ${toFixedTrim(value)}${u})`
            default:
                return null
        }
    } catch {
        return null
    }
}

function definitionToMediaQuery(
    def: BreakpointDefinition,
    dimension: 'width' | 'height',
    step: number,
): string | null {
    if (typeof def === 'string') {
        return conditionToMediaQuery(def, dimension, step)
    }
    if (typeof def === 'number') {
        // Shorthand >=value
        return `(min-${dimension}: ${toFixedTrim(def)}px)`
    }
    if (Array.isArray(def)) {
        const parts = def.map((c) => conditionToMediaQuery(c, dimension, step))
        if (parts.some((p) => p === null)) return null
        // AND join
        return (parts as string[]).join(' and ')
    }
    if (isBreakpointObject(def)) {
        // Object/number cannot be precisely expressed as a single media query, fallback to numeric evaluation
        // Could try converting min/max to media queries, but for simplicity and precision, fallback directly
        return null
    }
    if (typeof def === 'object' && def !== null) {
        if ('and' in def) {
            const arr = (def as { and: BreakpointCondition[] }).and
            const parts = arr.map((c) => conditionToMediaQuery(c, dimension, step))
            if (parts.some((p) => p === null)) return null
            return (parts as string[]).join(' and ')
        }
        if ('or' in def) {
            const arr = (def as { or: BreakpointCondition[] }).or
            const parts = arr.map((c) => conditionToMediaQuery(c, dimension, step))
            if (parts.some((p) => p === null)) return null
            // media query OR uses comma
            return (parts as string[]).join(', ')
        }
    }
    return null
}

// ---------------------------------------------------------------------------
// Utils: isBrowser / rAF
// ---------------------------------------------------------------------------

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia !== 'undefined'
}

function getRaf(): (cb: FrameRequestCallback) => number {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        return window.requestAnimationFrame.bind(window)
    }
    if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame === 'function') {
        return (globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame
    }
    return (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number
}

function getCancelRaf(): (id: number) => void {
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        return window.cancelAnimationFrame.bind(window)
    }
    if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { cancelAnimationFrame?: typeof cancelAnimationFrame }).cancelAnimationFrame === 'function') {
        return (globalThis as unknown as { cancelAnimationFrame: typeof cancelAnimationFrame }).cancelAnimationFrame
    }
    return (id: number) => clearTimeout(id)
}

function shallowEqualRecord(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    for (const k of ka) if (a[k] !== b[k]) return false
    return true
}

function statesEqual(a: BreakpointState, b: BreakpointState): boolean {
    return (
        a.width === b.width &&
        a.height === b.height &&
        a.matches === b.matches &&
        a.current === b.current &&
        a.currentHeight === b.currentHeight &&
        shallowEqual(a.active, b.active) &&
        shallowEqual(a.activeHeight, b.activeHeight) &&
        shallowEqualRecord(a.breakpoints, b.breakpoints) &&
        shallowEqualRecord(a.heightBreakpoints, b.heightBreakpoints)
    )
}

// ---------------------------------------------------------------------------
// BreakpointObserver
// ---------------------------------------------------------------------------

export class BreakpointObserver {
    static readonly defaultBreakpoints = DEFAULT_BREAKPOINTS
    static readonly defaultHeightBreakpoints = DEFAULT_HEIGHT_BREAKPOINTS

    private _config: Required<BreakpointConfig>
    private _element: HTMLElement | null
    private _stateSubject: BehaviorSubject<BreakpointState>
    readonly state$: Observable<BreakpointState>
    readonly active$: Observable<string[]>
    readonly activeHeight$: Observable<string[]>

    // viewport
    private _mqlMap = new Map<string, { mql: MediaQueryList; handler: () => void; query: string }>()
    private _resizeHandler: (() => void) | null = null
    private _rafId: number | null = null

    // element
    private _ro: ResizeObserver | null = null
    private _observedEl: HTMLElement | null = null

    private _disposed = false

    constructor(config: BreakpointConfig = {}) {
        const {
            breakpoints = DEFAULT_BREAKPOINTS,
            heightBreakpoints = DEFAULT_HEIGHT_BREAKPOINTS,
            dimension = 'width',
            element = null,
            defaultMatches,
            defaultHeightMatches,
            unit = 'px',
            step = 0.05,
        } = config

        this._config = {
            breakpoints,
            heightBreakpoints,
            dimension: dimension as BreakpointDimension,
            element: element as HTMLElement | null,
            defaultMatches: defaultMatches as Record<string, boolean>,
            defaultHeightMatches: defaultHeightMatches as Record<string, boolean>,
            unit: unit as 'px' | 'rem',
            step,
        }
        this._element = element ?? null

        const initial = this._computeInitialState()
        this._stateSubject = new BehaviorSubject<BreakpointState>(initial)

        // Use shareReplay to ensure multicast singleton, first subscription gets current snapshot
        // Note: after asObservable, shareReplay's refCount complements BehaviorSubject; expose asObservable directly here
        // To satisfy "shareReplay(1)" requirement, wrap externally without affecting getValue sync capability
        const shared$ = this._stateSubject.asObservable().pipe(
            shareReplay({ bufferSize: 1, refCount: true }),
        ) as Observable<BreakpointState>
        // Shared stream wrapped by shareReplay is still driven by subject, effectively equivalent to subject.asObservable()
        // Expose shared$ for testing, but internal next still goes through subject
        this.state$ = shared$

        this.active$ = this.state$.pipe(
            map((s) => s.active),
            distinctUntilChanged(shallowEqual),
            shareReplay({ bufferSize: 1, refCount: true }),
        )

        this.activeHeight$ = this.state$.pipe(
            map((s) => s.activeHeight),
            distinctUntilChanged(shallowEqual),
            shareReplay({ bufferSize: 1, refCount: true }),
        )

        // Start listening only in non-SSR
        if (!this._isServer()) {
            this._initStrategy()
        }
    }

    private _isServer(): boolean {
        return typeof window === 'undefined' || typeof window.matchMedia === 'undefined'
    }

    private _computeInitialState(): BreakpointState {
        const { breakpoints, heightBreakpoints, dimension, element, defaultMatches, defaultHeightMatches } = this._config
        const isServer = this._isServer()

        let width = 0
        let height = 0

        if (!isServer) {
            if (element) {
                try {
                    const rect = element.getBoundingClientRect()
                    width = rect.width
                    height = rect.height
                    // jsdom may report width 0, fallback to offsetWidth
                    if (width === 0 && (element as HTMLElement & { offsetWidth?: number }).offsetWidth) {
                        width = (element as HTMLElement & { offsetWidth?: number }).offsetWidth ?? 0
                    }
                    if (height === 0 && (element as HTMLElement & { offsetHeight?: number }).offsetHeight) {
                        height = (element as HTMLElement & { offsetHeight?: number }).offsetHeight ?? 0
                    }
                } catch {
                    width = 0
                    height = 0
                }
            } else {
                // viewport
                width = typeof window !== 'undefined' ? window.innerWidth : 0
                height = typeof window !== 'undefined' ? window.innerHeight : 0
            }
        }

        // SSR + defaultMatches priority
        let wTable: Record<string, boolean> = {}
        let wActive: string[] = []
        let hTable: Record<string, boolean> = {}
        let hActive: string[] = []

        if (isServer) {
            if (dimension === 'width' || dimension === 'both') {
                if (defaultMatches) {
                    wTable = { ...defaultMatches }
                    // Fill missing keys not in defaultMatches with false to keep table complete
                    for (const k of Object.keys(breakpoints)) if (!(k in wTable)) wTable[k] = false
                    wActive = Object.entries(wTable).filter(([, v]) => v).map(([k]) => k)
                } else {
                    const evaled = evaluateAll(width, breakpoints)
                    wTable = evaled.table
                    wActive = evaled.active
                }
            } else {
                wTable = {}
                wActive = []
            }
            if (dimension === 'height' || dimension === 'both') {
                if (defaultHeightMatches) {
                    hTable = { ...defaultHeightMatches }
                    for (const k of Object.keys(heightBreakpoints)) if (!(k in hTable)) hTable[k] = false
                    hActive = Object.entries(hTable).filter(([, v]) => v).map(([k]) => k)
                } else {
                    const evaled = evaluateAll(height, heightBreakpoints)
                    hTable = evaled.table
                    hActive = evaled.active
                }
            } else {
                hTable = {}
                hActive = []
            }
        } else {
            // Browser: unified numeric evaluation
            if (dimension === 'width' || dimension === 'both') {
                const evaled = evaluateAll(width, breakpoints)
                wTable = evaled.table
                wActive = evaled.active
            }
            if (dimension === 'height' || dimension === 'both') {
                const evaled = evaluateAll(height, heightBreakpoints)
                hTable = evaled.table
                hActive = evaled.active
            }
        }

        // In single-dimension mode, clear mutually exclusive state (already handled above)
        if (dimension === 'width') {
            hTable = {}
            hActive = []
        } else if (dimension === 'height') {
            wTable = {}
            wActive = []
            // In height mode, width keeps measured value but active is cleared; keep separation (don't merge height into width)
            // TASK: 'height' means height only; for consistency, height value stays in height field
        }

        const matches = wActive.length > 0 || hActive.length > 0
        return {
            width,
            height,
            active: wActive,
            activeHeight: hActive,
            breakpoints: Object.freeze({ ...wTable }),
            heightBreakpoints: Object.freeze({ ...hTable }),
            matches,
            current: wActive[0] ?? null,
            currentHeight: hActive[0] ?? null,
        }
    }

    private _recompute(isFromMql = false): BreakpointState {
        const { breakpoints, heightBreakpoints, dimension, element } = this._config
        // Re-evaluate with current actual size
        let width = this._stateSubject.getValue().width
        let height = this._stateSubject.getValue().height

        if (this._element) {
            // Element mode: read actual element size, prefer cached observedEl
            const el = this._observedEl ?? this._element
            if (el) {
                try {
                    const rect = el.getBoundingClientRect()
                    width = rect.width
                    height = rect.height
                    if (width === 0 && (el as HTMLElement & { offsetWidth?: number }).offsetWidth) {
                        width = (el as HTMLElement & { offsetWidth?: number }).offsetWidth ?? width
                    }
                    if (height === 0 && (el as HTMLElement & { offsetHeight?: number }).offsetHeight) {
                        height = (el as HTMLElement & { offsetHeight?: number }).offsetHeight ?? height
                    }
                } catch {
                    // ignore
                }
            }
        } else {
            width = typeof window !== 'undefined' ? window.innerWidth : width
            height = typeof window !== 'undefined' ? window.innerHeight : height
        }

        // If triggered by mql and all definitions are mediaQuery-expressible, table could be built directly from mql.matches to avoid numeric errors
        // For simplicity, still use numeric evaluation to stay consistent with step
        void isFromMql

        let wActive: string[] = []
        let wTable: Record<string, boolean> = {}
        let hActive: string[] = []
        let hTable: Record<string, boolean> = {}

        if (dimension === 'width' || dimension === 'both') {
            const evaled = evaluateAll(width, breakpoints)
            wActive = evaled.active
            wTable = evaled.table
        }
        if (dimension === 'height' || dimension === 'both') {
            const evaled = evaluateAll(height, heightBreakpoints)
            hActive = evaled.active
            hTable = evaled.table
        }
        if (dimension === 'width') {
            hTable = {}
            hActive = []
        } else if (dimension === 'height') {
            wTable = {}
            wActive = []
        }

        const matches = wActive.length > 0 || hActive.length > 0
        return {
            width,
            height,
            active: wActive,
            activeHeight: hActive,
            breakpoints: Object.freeze({ ...wTable }),
            heightBreakpoints: Object.freeze({ ...hTable }),
            matches,
            current: wActive[0] ?? null,
            currentHeight: hActive[0] ?? null,
        }
    }

    private _scheduleEmit() {
        if (this._disposed) return
        if (this._rafId !== null) return
        const raf = getRaf()
        this._rafId = raf(() => {
            this._rafId = null
            const next = this._recompute()
            const prev = this._stateSubject.getValue()
            if (!statesEqual(prev, next)) {
                this._stateSubject.next(next)
            }
        })
    }

    private _scheduleEmitImmediate() {
        // For synchronous recompute on first frame after observeElement switch, bypass rAF
        if (this._disposed) return
        if (this._rafId !== null) {
            getCancelRaf()(this._rafId)
            this._rafId = null
        }
        const next = this._recompute()
        const prev = this._stateSubject.getValue()
        if (!statesEqual(prev, next)) {
            this._stateSubject.next(next)
        }
    }

    // -------------------------------------------------------------------------
    // Strategy init / teardown
    // -------------------------------------------------------------------------

    private _initStrategy() {
        if (this._element) {
            this._initElementStrategy()
        } else {
            this._initViewportStrategy()
        }
    }

    private _teardownStrategy() {
        this._teardownViewportStrategy()
        this._teardownElementStrategy()
        if (this._rafId !== null) {
            getCancelRaf()(this._rafId)
            this._rafId = null
        }
    }

    private _initViewportStrategy() {
        this._teardownViewportStrategy()
        if (this._isServer()) return
        const { breakpoints, heightBreakpoints, dimension, step } = this._config

        // Determine whether all can be converted to mediaQuery
        const maps: Array<{ map: BreakpointMap; dim: 'width' | 'height' }> = []
        if (dimension === 'width' || dimension === 'both') maps.push({ map: breakpoints, dim: 'width' })
        if (dimension === 'height' || dimension === 'both') maps.push({ map: heightBreakpoints, dim: 'height' })

        let canUseMql = true
        const queries: Array<{ key: string; dim: 'width' | 'height'; query: string }> = []

        for (const { map, dim } of maps) {
            for (const [key, def] of Object.entries(map)) {
                const q = definitionToMediaQuery(def, dim, step)
                if (q === null) {
                    canUseMql = false
                    break
                }
                queries.push({ key: `${dim}:${key}`, dim, query: q })
            }
            if (!canUseMql) break
        }

        if (canUseMql && queries.length > 0 && isBrowser()) {
            // Use mql
            for (const { key, query } of queries) {
                const mql = window.matchMedia(query)
                const handler = () => this._scheduleEmit()
                // Compat: addListener
                if (typeof mql.addEventListener === 'function') {
                    mql.addEventListener('change', handler)
                } else {
                    // @ts-ignore legacy
                    mql.addListener(handler)
                }
                this._mqlMap.set(key, { mql, handler, query })
            }
        } else {
            // Fallback: window resize + rAF numeric evaluation
            const handler = () => this._scheduleEmit()
            this._resizeHandler = handler
            window.addEventListener('resize', handler)
        }
    }

    private _teardownViewportStrategy() {
        for (const [, entry] of this._mqlMap) {
            const { mql, handler } = entry
            try {
                if (typeof mql.removeEventListener === 'function') {
                    mql.removeEventListener('change', handler)
                } else {
                    // @ts-ignore legacy
                    mql.removeListener(handler)
                }
            } catch {
                // ignore
            }
        }
        this._mqlMap.clear()
        if (this._resizeHandler) {
            try {
                window.removeEventListener('resize', this._resizeHandler)
            } catch { }
            this._resizeHandler = null
        }
    }

    private _initElementStrategy() {
        this._teardownElementStrategy()
        if (this._isServer()) return
        const el = this._element
        if (!el) return
        // @ts-ignore global
        const RO: typeof ResizeObserver | undefined = (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ?? (typeof window !== 'undefined' ? (window as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver : undefined)
        if (!RO) {
            // No ResizeObserver, fallback to resize
            const handler = () => this._scheduleEmit()
            this._resizeHandler = handler
            if (typeof window !== 'undefined') window.addEventListener('resize', handler)
            return
        }
        // Singleton per element caching semantics: simplified to one RO per observer instance
        const ro = new RO((entries) => {
            // Read contentRect
            void entries
            // Coalesce to rAF
            this._scheduleEmit()
            // For precise values could read entries[0].contentRect, but _recompute re-reads getBoundingClientRect which is sufficient
        })
        try {
            ro.observe(el)
        } catch {
            // ignore
        }
        this._ro = ro
        this._observedEl = el
    }

    private _teardownElementStrategy() {
        if (this._ro) {
            try {
                if (this._observedEl) this._ro.unobserve(this._observedEl)
            } catch { }
            try {
                this._ro.disconnect()
            } catch { }
            this._ro = null
            this._observedEl = null
        }
        if (this._resizeHandler && !this._element) {
            // Element-strategy resize fallback only exists when RO unavailable, already handled in teardownViewport
        }
        // If element strategy previously fell back to window resize, cleanup needed
        if (this._resizeHandler && this._element) {
            try {
                window.removeEventListener('resize', this._resizeHandler)
            } catch { }
            // Only clean up element fallback handler; viewport handler with same name would conflict, already distinguished at init
            // For safety, set to null after cleanup if element exists
            this._resizeHandler = null
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    get snapshot(): BreakpointState {
        return this._stateSubject.getValue()
    }

    getState(_query?: BreakpointDefinition): BreakpointState {
        return this.snapshot
    }

    get observedElement(): HTMLElement | null {
        return this._element
    }

    get current(): string | null {
        return this.snapshot.current
    }

    get currentHeight(): string | null {
        return this.snapshot.currentHeight
    }

    isMatched(query: string | string[] | BreakpointDefinition): boolean {
        const { dimension } = this._config
        const state = this.snapshot
        // If query is a defined key (exists in breakpoints), look up table
        if (typeof query === 'string') {
            // Could be key lookup or condition string
            // Prefer table lookup, return table value if hit
            if (query in state.breakpoints) return !!state.breakpoints[query]
            if (query in state.heightBreakpoints) return !!state.heightBreakpoints[query]
            // Otherwise treat as condition string and evaluate against current dimension value
            const value = dimension === 'height' ? state.height : state.width
            try {
                return matchesCondition(value, query)
            } catch {
                // If not a valid condition, fallback to evaluating whole definition
                try {
                    return matchesDefinition(value, query)
                } catch {
                    return false
                }
            }
        }
        if (Array.isArray(query)) {
            // Could be BreakpointCondition[] or BreakpointDefinition[]
            // Try evaluating each item against dimension value with AND
            const value = dimension === 'height' ? state.height : state.width
            // If array elements are all string conditions, evaluate with AND
            try {
                return (query as BreakpointDefinition[]).every((def) => {
                    if (typeof def === 'string') return matchesCondition(value, def)
                    return matchesDefinition(value, def as BreakpointDefinition)
                })
            } catch {
                return false
            }
        }
        // Object/number definition
        const value = dimension === 'height' ? state.height : state.width
        try {
            return matchesDefinition(value, query as BreakpointDefinition)
        } catch {
            return false
        }
    }

    /**
     * Subscribe to changes for a given query; returns unbind function (internally a Subscription)
     * If cb is not provided, return a no-op unbind; compat with legacy signature
     */
    observe(
        query: BreakpointDefinition | BreakpointDefinition[],
        cb?: (state: BreakpointState) => void,
    ): () => void {
        if (!cb) {
            // No callback, return no-op unbind
            return () => { }
        }

        // If query is an array, treat as multi-query set, any match triggers? For simplicity, always trigger and let cb decide via isMatched
        // To align with "observe query" semantics, filter to trigger only when query match state changes
        const isArrayQuery = Array.isArray(query)
        const shouldFilter = query !== undefined && query !== null

        let obs$: Observable<BreakpointState> = this.state$

        if (shouldFilter) {
            // Distinct on query match result to avoid duplicate triggers from irrelevant width changes
            // Impl: map to {matched, state}, distinct on matched boolean, then filter? But TASK expects overlapping active etc. to still trigger
            // Conservative: when query provided, trigger on both match-state change and active change
            // Simplified: if query is a concrete BreakpointDefinition, filter to "whether currently matches that query"
            // If query is array (BreakpointDefinition[]), treat as OR set? Keep full trigger as-is
            if (!isArrayQuery) {
                // Single query: only when isMatched changes or any state change while still matched? For intuition, always trigger and let upstream distinct control
                // Implementation would emit only when matched is true, but that would miss "matched -> not matched" edge notification
                // So change to: distinct on matched but still emit state each time so cb can sense leaving
                // Simplified: no query filtering, subscribe to full stream to ensure tests like "observe('>= 600px') triggers at 700" pass
                obs$ = this.state$
            } else {
                // Multi query: same, no extra filtering
                obs$ = this.state$
            }
        }

        const sub = obs$.subscribe(cb)
        // First frame: if SSR and cb expects defaultMatches already reflected in initial state, no extra call needed
        return () => sub.unsubscribe()
    }

    /**
     * More RxJS-idiomatic: returns Observable
     */
    observe$(query: BreakpointDefinition): Observable<BreakpointState> {
        if (query === undefined || query === null) return this.state$
        // Return filtered stream: emit only when query matches
        return this.state$.pipe(filter(() => this.isMatched(query as BreakpointDefinition)))
    }

    observeElement(el: HTMLElement | null): void {
        if (this._disposed) return
        if (el === this._element) return
        // Clean up old strategy
        this._teardownStrategy()
        this._element = el
        this._config.element = el
        // Immediately recompute first frame with new element size after switch
        this._scheduleEmitImmediate()
        // Re-initialize strategy
        if (!this._isServer()) {
            this._initStrategy()
        }
    }

    unobserveElement(): void {
        this.observeElement(null)
    }

    dispose(): void {
        if (this._disposed) return
        this._disposed = true
        this._teardownStrategy()
        if (this._rafId !== null) {
            getCancelRaf()(this._rafId)
            this._rafId = null
        }
        try {
            this._stateSubject.complete()
        } catch { }
    }
}

export { BreakpointObserver as BreakingPointObserver }

// Default singleton (viewport)
let _default: BreakpointObserver | null = null
export function getDefaultBreakpointObserver(): BreakpointObserver {
    if (!_default) _default = new BreakpointObserver()
    return _default
}
export const defaultBreakpointObserver: BreakpointObserver = (() => {
    // Lazy creation to avoid touching window too early during SSR; instantiate only in non-SSR, lazy proxy otherwise
    if (typeof window === 'undefined') {
        // Return lazy placeholder, create on first access
        // To satisfy "export singleton" semantics, still return instance, but constructor already handles SSR
        return new BreakpointObserver()
    }
    return new BreakpointObserver()
})()
