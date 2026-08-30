/**
 * breakpoint-observer — Pure utility, zero framework, 100% RxJS
 * Parsing, evaluation, dual strategies (viewport: matchMedia / element: ResizeObserver + rAF)
 */

import {
    BehaviorSubject,
    Observable,
    distinctUntilChanged,
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
    DEFAULT_HEIGHT_BREAKPOINTS,
    EM_BASE,
    REM_BASE,
} from './breakpoints.js'
import { shallowEqual } from './rx.js'
import { canUseMatchMedia, canUseRequestAnimationFrame, canUseResizeObserver, getWindow, isServer } from './is-server.js'

// ---------------------------------------------------------------------------
// Pure functions: parsing / matching
// ---------------------------------------------------------------------------

const UNIT = '(px|rem|em|ex|ch|cap|ic|lh|rlh|vw|vh|vmin|vmax|vi|vb|dvw|dvh|svw|svh|lvw|lvh|cm|mm|in|pt|pc|%)'
const CONDITION_RE = new RegExp(`^\\s*(>=|<=|>|<|==|=|!=)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT}?\\s*$`, 'i')

export type ParsedUnit = import('./breakpoints.js').BreakpointUnit

export interface ParsedCondition {
    op: '>=' | '<=' | '>' | '<' | '=' | '==' | '!='
    value: number
    unit: ParsedUnit
}

export function parseCondition(cond: string): ParsedCondition {
    const m = CONDITION_RE.exec(cond)
    if (!m) throw new TypeError(`Invalid breakpoint condition: "${cond}"`)
    const op = m[1] as ParsedCondition['op']
    const value = Number(m[2])
    const unit = ((m[3] as string | undefined)?.toLowerCase() as ParsedUnit | undefined) ?? 'px'
    return { op, value, unit }
}

function toPx(target: number, unit: ParsedUnit, remBase: number, emBase: number): number {
    switch (unit) {
        case 'px': return target
        case 'rem': return target * remBase
        case 'em': return target * emBase
        case 'cm': return target * 37.795275591
        case 'mm': return target * 3.7795275591
        case 'in': return target * 96
        case 'pt': return target * 1.3333333333
        case 'pc': return target * 16
        case 'vw':
        case 'dvw':
        case 'svw':
        case 'lvw':
        case 'vi': {
            const w = typeof window !== 'undefined' ? window.innerWidth : NaN
            return Number.isNaN(w) ? NaN : target * w / 100
        }
        case 'vh':
        case 'dvh':
        case 'svh':
        case 'lvh':
        case 'vb': {
            const h = typeof window !== 'undefined' ? window.innerHeight : NaN
            return Number.isNaN(h) ? NaN : target * h / 100
        }
        case 'vmin': {
            if (typeof window === 'undefined') return NaN
            return target * Math.min(window.innerWidth, window.innerHeight) / 100
        }
        case 'vmax': {
            if (typeof window === 'undefined') return NaN
            return target * Math.max(window.innerWidth, window.innerHeight) / 100
        }
        // Relative font/view units that cannot be reliably converted without layout context → NaN → fallback to mql
        case 'ex':
        case 'ch':
        case 'cap':
        case 'ic':
        case 'lh':
        case 'rlh':
        case '%':
            return NaN
        default:
            return NaN
    }
}

export function matchesCondition(value: number, cond: string, remBase: number = REM_BASE, emBase: number = EM_BASE): boolean {
    const { op, value: target, unit } = parseCondition(cond)
    const pxTarget = toPx(target, unit, remBase, emBase)
    // Non-convertible units (%, ex, ch ...) → NaN → treat as non-matching in numeric path; viewport strategy will use mql
    if (Number.isNaN(pxTarget)) return false
    switch (op) {
        case '>':
            return value > pxTarget
        case '>=':
            return value >= pxTarget
        case '<':
            return value < pxTarget
        case '<=':
            return value <= pxTarget
        case '=':
        case '==':
            return value === pxTarget
        case '!=':
            return value !== pxTarget
        default:
            return false
    }
}

function isBreakpointObject(def: unknown): def is { min?: number; max?: number; minInclusive?: boolean; maxInclusive?: boolean; eq?: number; ne?: number } {
    return typeof def === 'object' && def !== null && !Array.isArray(def) && !('and' in (def as Record<string, unknown>)) && !('or' in (def as Record<string, unknown>))
}

export function matchesDefinition(value: number, def: BreakpointDefinition, remBase: number = REM_BASE, emBase: number = EM_BASE): boolean {
    if (typeof def === 'number') {
        return value >= def
    }
    if (typeof def === 'string') {
        return matchesCondition(value, def, remBase, emBase)
    }
    if (Array.isArray(def)) {
        // Default AND
        return def.every((c) => matchesCondition(value, c, remBase, emBase))
    }
    if (isBreakpointObject(def)) {
        // Empty object is invalid — previously returned true, now throws to surface logic error
        if (def.min === undefined && def.max === undefined && def.eq === undefined && def.ne === undefined) {
            throw new TypeError(`Invalid breakpoint definition: empty object`)
        }
        let ok = true
        if (def.eq !== undefined) ok = ok && value === def.eq
        if (def.ne !== undefined) ok = ok && value !== def.ne
        if (def.min !== undefined) {
            ok = ok && (def.minInclusive === false ? value > def.min : value >= def.min)
        }
        if (def.max !== undefined) {
            ok = ok && (def.maxInclusive === false ? value < def.max : value <= def.max)
        }
        return ok
    }
    if (typeof def === 'object' && def !== null) {
        if ('and' in def && Array.isArray((def as { and: unknown }).and)) {
            const arr = (def as { and: BreakpointCondition[] }).and
            return arr.every((c) => matchesCondition(value, c, remBase, emBase))
        }
        if ('or' in def && Array.isArray((def as { or: unknown }).or)) {
            const arr = (def as { or: BreakpointCondition[] }).or
            return arr.some((c) => matchesCondition(value, c, remBase, emBase))
        }
    }
    throw new TypeError(`Invalid breakpoint definition: ${String(def)}`)
}

export function evaluateAll(
    value: number,
    map: BreakpointMap,
    remBase: number = REM_BASE,
    emBase: number = EM_BASE,
): { active: string[]; table: Record<string, boolean> } {
    const table: Record<string, boolean> = {}
    const active: string[] = []
    for (const [key, def] of Object.entries(map)) {
        const hit = matchesDefinition(value, def, remBase, emBase)
        table[key] = hit
        if (hit) active.push(key)
    }
    return { active, table }
}

// ---------------------------------------------------------------------------
// mediaQuery generation (viewport)
// ---------------------------------------------------------------------------

function toFixedTrim(n: number): string {
    // Keep up to 4 decimal places to preserve custom step precision; trim trailing zeros
    const s = n.toFixed(4)
    return s.replace(/\.?0+$/, '')
}

// Units that are invalid for width/height media features — fall back to numeric resize
const INVALID_MEDIA_UNITS = new Set(['%', 'ex', 'ch', 'cap', 'ic', 'lh', 'rlh'])

function conditionToMediaQuery(
    cond: string,
    dimension: 'width' | 'height',
    step: number,
): string | null {
    try {
        const { op, value, unit } = parseCondition(cond)
        const u = unit ?? 'px'
        if (INVALID_MEDIA_UNITS.has(u)) return null
        // step is px-based; only apply for px to avoid rem/vw drift (0.05px != 0.05rem)
        const isPx = u === 'px'
        switch (op) {
            case '>=':
                return `(min-${dimension}: ${toFixedTrim(value)}${u})`
            case '>':
                return isPx
                    ? `(min-${dimension}: ${toFixedTrim(value + step)}${u})`
                    : `(min-${dimension}: ${toFixedTrim(value)}${u})`
            case '<=':
                return `(max-${dimension}: ${toFixedTrim(value)}${u})`
            case '<':
                return isPx
                    ? `(max-${dimension}: ${toFixedTrim(value - step)}${u})`
                    : `(max-${dimension}: ${toFixedTrim(value)}${u})`
            case '=':
            case '==':
                return `(${dimension}: ${toFixedTrim(value)}${u})`
            case '!=':
                // not all and (width: 960px) — spec-correct per MQ3
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
// Utils: rAF (via is-server)
// ---------------------------------------------------------------------------

function getRaf(): (cb: FrameRequestCallback) => number {
    const w = getWindow()
    if (w && typeof w.requestAnimationFrame === 'function') {
        return w.requestAnimationFrame.bind(w)
    }
    if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { requestAnimationFrame?: typeof requestAnimationFrame }).requestAnimationFrame === 'function') {
        return (globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame }).requestAnimationFrame
    }
    if (canUseRequestAnimationFrame()) {
        const win = getWindow()
        if (win) return win.requestAnimationFrame.bind(win)
    }
    return (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number
}

function getCancelRaf(): (id: number) => void {
    const w = getWindow()
    if (w && typeof w.cancelAnimationFrame === 'function') {
        return w.cancelAnimationFrame.bind(w)
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
    private _viewportResizeHandler: (() => void) | null = null
    /** @deprecated compat — kept as getter/setter alias to _viewportResizeHandler */
    private get _resizeHandler(): (() => void) | null { return this._viewportResizeHandler }
    private set _resizeHandler(v: (() => void) | null) { this._viewportResizeHandler = v }
    private _elementResizeHandler: (() => void) | null = null
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
            remBase = REM_BASE,
            emBase = EM_BASE,
        } = config

        this._config = {
            breakpoints,
            heightBreakpoints,
            dimension: dimension as BreakpointDimension,
            element: element as HTMLElement | null,
            defaultMatches: defaultMatches as Record<string, boolean>,
            defaultHeightMatches: defaultHeightMatches as Record<string, boolean>,
            unit: unit as import('./breakpoints.js').BreakpointUnit,
            step,
            remBase,
            emBase,
        }
        this._element = element ?? null

        const initial = this._computeInitialState()
        this._stateSubject = new BehaviorSubject<BreakpointState>(initial)

        // BehaviorSubject itself is multicast + replay(1); no extra shareReplay needed for state$
        // Keep asObservable() for encapsulation; active$ still uses shareReplay for derived state
        this.state$ = this._stateSubject.asObservable() as Observable<BreakpointState>

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
        if (!isServer()) {
            this._initStrategy()
        }
    }

    private _computeInitialState(): BreakpointState {
        const { breakpoints, heightBreakpoints, dimension, element, defaultMatches, defaultHeightMatches, remBase, emBase } = this._config
        const isServer_ = isServer()

        let width = 0
        let height = 0

        if (!isServer_) {
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
                const w = getWindow()
                width = w ? w.innerWidth : 0
                height = w ? w.innerHeight : 0
            }
        }

        // SSR + defaultMatches priority
        let wTable: Record<string, boolean> = {}
        let wActive: string[] = []
        let hTable: Record<string, boolean> = {}
        let hActive: string[] = []

        if (isServer_) {
            if (dimension === 'width' || dimension === 'both') {
                if (defaultMatches) {
                    wTable = { ...defaultMatches }
                    // Fill missing keys not in defaultMatches with false to keep table complete
                    for (const k of Object.keys(breakpoints)) if (!(k in wTable)) wTable[k] = false
                    wActive = Object.entries(wTable).filter(([, v]) => v).map(([k]) => k)
                } else {
                    // V7: empty hit instead of guessing width 0
                    wTable = Object.fromEntries(Object.keys(breakpoints).map(k => [k, false]))
                    wActive = []
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
                    hTable = Object.fromEntries(Object.keys(heightBreakpoints).map(k => [k, false]))
                    hActive = []
                }
            } else {
                hTable = {}
                hActive = []
            }
        } else {
            // Browser: unified numeric evaluation
            if (dimension === 'width' || dimension === 'both') {
                const evaled = evaluateAll(width, breakpoints, remBase, emBase)
                wTable = evaled.table
                wActive = evaled.active
            }
            if (dimension === 'height' || dimension === 'both') {
                const evaled = evaluateAll(height, heightBreakpoints, remBase, emBase)
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
            active: Object.freeze([...wActive]) as string[],
            activeHeight: Object.freeze([...hActive]) as string[],
            breakpoints: Object.freeze({ ...wTable }),
            heightBreakpoints: Object.freeze({ ...hTable }),
            matches,
            current: wActive[0] ?? null,
            currentHeight: hActive[0] ?? null,
        }
    }

    private _recompute(isFromMql = false): BreakpointState {
        const { breakpoints, heightBreakpoints, dimension, remBase, emBase } = this._config
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
            const w = getWindow()
            width = w ? w.innerWidth : width
            height = w ? w.innerHeight : height
        }

        // If triggered by mql and all definitions are mediaQuery-expressible, table could be built directly from mql.matches to avoid numeric errors
        // For simplicity, still use numeric evaluation to stay consistent with step
        void isFromMql

        let wActive: string[] = []
        let wTable: Record<string, boolean> = {}
        let hActive: string[] = []
        let hTable: Record<string, boolean> = {}

        if (dimension === 'width' || dimension === 'both') {
            const evaled = evaluateAll(width, breakpoints, remBase, emBase)
            wActive = evaled.active
            wTable = evaled.table
        }
        if (dimension === 'height' || dimension === 'both') {
            const evaled = evaluateAll(height, heightBreakpoints, remBase, emBase)
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
            active: Object.freeze([...wActive]) as string[],
            activeHeight: Object.freeze([...hActive]) as string[],
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
            if (this._disposed) return
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
        if (isServer()) return
        // matchMedia missing → fallback to resize numeric (do NOT early-return)
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

        if (canUseMql && queries.length > 0 && canUseMatchMedia()) {
            // Use mql + keep resize as safety for step gap (V3)
            for (const { key, query } of queries) {
                const mql = getWindow()!.matchMedia(query)
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
            // Mixed strategy: also listen resize to handle sub-pixel step gaps
            const handler = () => this._scheduleEmit()
            this._viewportResizeHandler = handler
            getWindow()!.addEventListener('resize', handler)
        } else {
            // Fallback: window resize + rAF numeric evaluation
            const handler = () => this._scheduleEmit()
            this._viewportResizeHandler = handler
            getWindow()!.addEventListener('resize', handler)
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
        if (this._viewportResizeHandler) {
            try {
                getWindow()?.removeEventListener('resize', this._viewportResizeHandler)
            } catch { }
            this._viewportResizeHandler = null
        }
    }

    private _initElementStrategy() {
        this._teardownElementStrategy()
        if (isServer()) return
        const el = this._element
        if (!el) return
        let RO: typeof ResizeObserver | undefined
        if (canUseResizeObserver()) {
            RO = (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ?? (getWindow() as unknown as { ResizeObserver?: typeof ResizeObserver })?.ResizeObserver
        }
        if (!RO) {
            // No ResizeObserver, fallback to resize
            const handler = () => this._scheduleEmit()
            this._elementResizeHandler = handler
            getWindow()?.addEventListener('resize', handler)
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
        if (this._elementResizeHandler) {
            try {
                getWindow()?.removeEventListener('resize', this._elementResizeHandler)
            } catch { }
            this._elementResizeHandler = null
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    get snapshot(): BreakpointState {
        return this._stateSubject.getValue()
    }

    /** @deprecated query param is legacy — returns snapshot (equivalent to BehaviorSubject.getValue()) */
    getState(_query?: BreakpointDefinition): BreakpointState {
        return this.snapshot
    }

    get observedElement(): HTMLElement | null {
        // Logical observed element — reflects config, not just RO binding
        // Keep _element as source of truth; _observedEl may be null on RO fallback but element is still observed
        return this._element
    }

    get current(): string | null {
        return this.snapshot.current
    }

    get currentHeight(): string | null {
        return this.snapshot.currentHeight
    }

    private _isMatchedOnState(state: BreakpointState, query: string | string[] | BreakpointDefinition): boolean {
        const { dimension } = this._config
        const remBase = this._config.remBase ?? REM_BASE
        const emBase = this._config.emBase ?? EM_BASE
        // helper to resolve breakpoint key lookup before condition parsing
        const isKey = (k: string) => k in state.breakpoints || k in state.heightBreakpoints
        const keyMatched = (k: string): boolean | null => {
            const inW = k in state.breakpoints
            const inH = k in state.heightBreakpoints
            if (!inW && !inH) return null
            if (dimension === 'both') {
                // OR across dimensions when both active (compact exists in both tables)
                return !!(state.breakpoints[k] || state.heightBreakpoints[k])
            }
            if (inW && inH) {
                // single dimension: respect dimension
                return dimension === 'height' ? !!state.heightBreakpoints[k] : !!state.breakpoints[k]
            }
            if (inW) return !!state.breakpoints[k]
            return !!state.heightBreakpoints[k]
        }
        if (typeof query === 'string') {
            const km = keyMatched(query)
            if (km !== null) return km
            try {
                if (dimension === 'both') {
                    // For both, match if either dimension matches
                    return matchesCondition(state.width, query, remBase, emBase) || matchesCondition(state.height, query, remBase, emBase)
                }
                const value = dimension === 'height' ? state.height : state.width
                return matchesCondition(value, query, remBase, emBase)
            } catch {
                try {
                    if (dimension === 'both') {
                        return matchesDefinition(state.width, query as BreakpointDefinition, remBase, emBase) || matchesDefinition(state.height, query as BreakpointDefinition, remBase, emBase)
                    }
                    const v = dimension === 'height' ? state.height : state.width
                    return matchesDefinition(v, query as BreakpointDefinition, remBase, emBase)
                } catch {
                    return false
                }
            }
        }
        if (Array.isArray(query)) {
            try {
                if (dimension === 'both') {
                    const wVal = state.width
                    const hVal = state.height
                    const wMatch = (query as BreakpointDefinition[]).every((def) => {
                        if (typeof def === 'string' && isKey(def)) {
                            if (def in state.breakpoints) return !!state.breakpoints[def]
                            return false
                        }
                        if (typeof def === 'string') return matchesCondition(wVal, def, remBase, emBase)
                        return matchesDefinition(wVal, def as BreakpointDefinition, remBase, emBase)
                    })
                    const hMatch = (query as BreakpointDefinition[]).every((def) => {
                        if (typeof def === 'string' && isKey(def)) {
                            if (def in state.heightBreakpoints) return !!state.heightBreakpoints[def]
                            return false
                        }
                        if (typeof def === 'string') return matchesCondition(hVal, def, remBase, emBase)
                        return matchesDefinition(hVal, def as BreakpointDefinition, remBase, emBase)
                    })
                    if (wMatch || hMatch) return true
                    // Pure-key fallback: every key must be matched in either dimension
                    const allKeys = (query as unknown as string[]).every((k) => typeof k === 'string' && isKey(k))
                    if (allKeys) {
                        return (query as unknown as string[]).every((k) => keyMatched(k) === true)
                    }
                    return false
                }
                const value = dimension === 'height' ? state.height : state.width
                return (query as BreakpointDefinition[]).every((def) => {
                    if (typeof def === 'string' && isKey(def)) {
                        const km = keyMatched(def as string)
                        return km === true
                    }
                    if (typeof def === 'string') return matchesCondition(value, def, remBase, emBase)
                    return matchesDefinition(value, def as BreakpointDefinition, remBase, emBase)
                })
            } catch {
                return false
            }
        }
        try {
            if (dimension === 'both') {
                return matchesDefinition(state.width, query as BreakpointDefinition, remBase, emBase) || matchesDefinition(state.height, query as BreakpointDefinition, remBase, emBase)
            }
            const value = dimension === 'height' ? state.height : state.width
            return matchesDefinition(value, query as BreakpointDefinition, remBase, emBase)
        } catch {
            return false
        }
    }

    isMatched(query: string | string[] | BreakpointDefinition): boolean {
        return this._isMatchedOnState(this.snapshot, query)
    }

    /**
     * Subscribe to changes for a given query; returns unbind function (internally a Subscription)
     * Reversal semantics: emits when matched boolean flips (false<->true), distinctUntilChanged
     * Callback receives current BreakpointState snapshot after reversal, so caller can read current value
     */
    observe(
        query: BreakpointDefinition | BreakpointDefinition[],
        cb?: (state: BreakpointState) => void,
    ): () => void {
        if (!cb) {
            // No callback, return no-op unbind
            return () => { }
        }

        // Reversal: distinct on matched boolean, emit state when it flips
        const sub = this.state$.pipe(
            distinctUntilChanged((prev, curr) => this._isMatchedOnState(prev, query as any) === this._isMatchedOnState(curr, query as any)),
        ).subscribe(cb)
        return () => sub.unsubscribe()
    }

    /**
     * More RxJS-idiomatic: returns Observable, reversal semantics
     */
    observe$(query: BreakpointDefinition): Observable<BreakpointState> {
        if (query === undefined || query === null) return this.state$
        // Reversal: emit only when matched boolean flips
        return this.state$.pipe(
            distinctUntilChanged((prev, curr) => this._isMatchedOnState(prev, query as BreakpointDefinition) === this._isMatchedOnState(curr, query as BreakpointDefinition)),
        )
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
        if (!isServer()) {
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
        // Clear DOM refs to avoid leaks; observedElement should be null after dispose
        this._element = null
        this._config.element = null
        try {
            this._stateSubject.complete()
        } catch { }
    }
}

export { BreakpointObserver as BreakingPointObserver }

// Default singleton (viewport) — unified with getDefaultBreakpointObserver (V4)
let _default: BreakpointObserver | null = null
export function getDefaultBreakpointObserver(): BreakpointObserver {
    const isDisposed = (_default as unknown as { _disposed?: boolean })?._disposed
    if (!_default || isDisposed) {
        _default = new BreakpointObserver()
        // Keep live export in sync, but avoid TDZ during module init
        try {
            if (typeof defaultBreakpointObserver !== 'undefined' && defaultBreakpointObserver !== _default) {
                defaultBreakpointObserver = _default
            }
        } catch {
            // TDZ during first initialization — ignore, initializer will assign
        }
    }
    return _default
}
export let defaultBreakpointObserver: BreakpointObserver = getDefaultBreakpointObserver()
