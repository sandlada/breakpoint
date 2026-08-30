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
    ABSOLUTE_PX,
    type BreakpointCondition,
    type BreakpointConfig,
    type BreakpointDefinition,
    type BreakpointDimension,
    type BreakpointState,
    DEFAULT_HEIGHT_BREAKPOINTS,
    DEFAULT_WIDTH_BREAKPOINTS,
    EM_BASE,
    type HeightBreakpointMap,
    REM_BASE,
    type WidthBreakpointMap,
} from './breakpoints.js'
import { isShallowEqualArray } from './rx.js'
import { canUseMatchMedia, canUseResizeObserver, getWindow, isServer } from './is-server.js'

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
        case 'cm':
        case 'mm':
        case 'in':
        case 'pt':
        case 'pc':
            return target * ABSOLUTE_PX[unit]
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

function isBreakpointRange(def: unknown): def is { min?: number; max?: number; minInclusive?: boolean; maxInclusive?: boolean; eq?: number; ne?: number } {
    return typeof def === 'object' && def !== null && !('and' in (def as Record<string, unknown>)) && !('or' in (def as Record<string, unknown>))
}

export function matchesDefinition(value: number, def: BreakpointDefinition, remBase: number = REM_BASE, emBase: number = EM_BASE): boolean {
    if (typeof def === 'string') {
        return matchesCondition(value, def, remBase, emBase)
    }
    if (isBreakpointRange(def)) {
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
    map: WidthBreakpointMap | HeightBreakpointMap,
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
    const s = n.toFixed(4)
    return s.replace(/\.?0+$/, '')
}

// Units that are invalid for width/height media features — fall back to numeric resize
const INVALID_MEDIA_UNITS = new Set(['%', 'ex', 'ch', 'cap', 'ic', 'lh', 'rlh'])

function conditionToMediaQuery(
    cond: string,
    dimension: 'width' | 'height',
    mediaQueryExclusiveStep: number,
): string | null {
    try {
        const { op, value, unit } = parseCondition(cond)
        const u = unit ?? 'px'
        if (INVALID_MEDIA_UNITS.has(u)) return null
        const isPx = u === 'px'
        if (!isPx && (op === '>' || op === '<')) return null
        switch (op) {
            case '>=':
                return `(min-${dimension}: ${toFixedTrim(value)}${u})`
            case '>':
                return `(min-${dimension}: ${toFixedTrim(value + mediaQueryExclusiveStep)}${u})`
            case '<=':
                return `(max-${dimension}: ${toFixedTrim(value)}${u})`
            case '<':
                return `(max-${dimension}: ${toFixedTrim(value - mediaQueryExclusiveStep)}${u})`
            case '=':
            case '==':
                return `(${dimension}: ${toFixedTrim(value)}${u})`
            case '!=':
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
    mediaQueryExclusiveStep: number,
): string | null {
    if (typeof def === 'string') {
        return conditionToMediaQuery(def, dimension, mediaQueryExclusiveStep)
    }
    if (isBreakpointRange(def)) {
        return null
    }
    if (typeof def === 'object' && def !== null) {
        if ('and' in def) {
            const arr = (def as { and: BreakpointCondition[] }).and
            const parts = arr.map((c) => conditionToMediaQuery(c, dimension, mediaQueryExclusiveStep))
            if (parts.some((p) => p === null)) return null
            return (parts as string[]).join(' and ')
        }
        if ('or' in def) {
            const arr = (def as { or: BreakpointCondition[] }).or
            const parts = arr.map((c) => conditionToMediaQuery(c, dimension, mediaQueryExclusiveStep))
            if (parts.some((p) => p === null)) return null
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
    return (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number
}

function getCancelRaf(): (id: number) => void {
    const w = getWindow()
    if (w && typeof w.cancelAnimationFrame === 'function') {
        return w.cancelAnimationFrame.bind(w)
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
        a.primaryWidth === b.primaryWidth &&
        a.primaryHeight === b.primaryHeight &&
        isShallowEqualArray(a.activeWidthKeys, b.activeWidthKeys) &&
        isShallowEqualArray(a.activeHeightKeys, b.activeHeightKeys) &&
        shallowEqualRecord(a.widthMatches, b.widthMatches) &&
        shallowEqualRecord(a.heightMatches, b.heightMatches)
    )
}

// ---------------------------------------------------------------------------
// BreakpointObserver
// ---------------------------------------------------------------------------

export class BreakpointObserver {
    static readonly defaultWidthBreakpoints = DEFAULT_WIDTH_BREAKPOINTS
    static readonly defaultHeightBreakpoints = DEFAULT_HEIGHT_BREAKPOINTS

    private _config: Required<BreakpointConfig>
    private _element: HTMLElement | null
    private _stateSubject: BehaviorSubject<BreakpointState>
    readonly state$: Observable<BreakpointState>
    readonly activeWidthKeys$: Observable<string[]>
    readonly activeHeightKeys$: Observable<string[]>

    // viewport
    private _mqlMap = new Map<string, { mql: MediaQueryList; handler: () => void; query: string }>()
    private _viewportResizeHandler: (() => void) | null = null
    private _elementResizeHandler: (() => void) | null = null
    private _rafId: number | null = null

    // element
    private _ro: ResizeObserver | null = null
    private _observedEl: HTMLElement | null = null
    private _lastContentRect: { width: number; height: number } | null = null

    private _disposed = false

    constructor(config: BreakpointConfig = {}) {
        const {
            widthBreakpoints = DEFAULT_WIDTH_BREAKPOINTS,
            heightBreakpoints = DEFAULT_HEIGHT_BREAKPOINTS,
            dimension = 'width',
            element = null,
            defaultWidthMatches,
            defaultHeightMatches,
            mediaQueryExclusiveStep = 0.05,
            remBase = REM_BASE,
            emBase = EM_BASE,
        } = config

        this._config = {
            widthBreakpoints,
            heightBreakpoints,
            dimension: dimension as BreakpointDimension,
            element: element as HTMLElement | null,
            defaultWidthMatches: defaultWidthMatches as Record<string, boolean>,
            defaultHeightMatches: defaultHeightMatches as Record<string, boolean>,
            mediaQueryExclusiveStep,
            remBase,
            emBase,
        }
        this._element = element ?? null

        const initial = this._computeInitialState()
        this._stateSubject = new BehaviorSubject<BreakpointState>(initial)

        this.state$ = this._stateSubject.asObservable() as Observable<BreakpointState>

        this.activeWidthKeys$ = this.state$.pipe(
            map((s) => s.activeWidthKeys),
            distinctUntilChanged(isShallowEqualArray),
            shareReplay({ bufferSize: 1, refCount: true }),
        )

        this.activeHeightKeys$ = this.state$.pipe(
            map((s) => s.activeHeightKeys),
            distinctUntilChanged(isShallowEqualArray),
            shareReplay({ bufferSize: 1, refCount: true }),
        )

        if (!isServer()) {
            this._initStrategy()
        }
    }

    private _computeInitialState(): BreakpointState {
        const { widthBreakpoints, heightBreakpoints, dimension, element, defaultWidthMatches, defaultHeightMatches, remBase, emBase } = this._config
        const isServer_ = isServer()

        let width = 0
        let height = 0

        if (!isServer_) {
            if (element) {
                try {
                    const rect = element.getBoundingClientRect()
                    width = rect.width
                    height = rect.height
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
                const w = getWindow()
                width = w ? w.innerWidth : 0
                height = w ? w.innerHeight : 0
            }
        }

        let wTable: Record<string, boolean> = {}
        let wActive: string[] = []
        let hTable: Record<string, boolean> = {}
        let hActive: string[] = []

        if (isServer_) {
            if (dimension === 'width' || dimension === 'both') {
                if (defaultWidthMatches) {
                    wTable = { ...defaultWidthMatches }
                    for (const k of Object.keys(widthBreakpoints)) if (!(k in wTable)) wTable[k] = false
                    wActive = Object.entries(wTable).filter(([, v]) => v).map(([k]) => k)
                } else {
                    wTable = Object.fromEntries(Object.keys(widthBreakpoints).map(k => [k, false]))
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
            if (dimension === 'width' || dimension === 'both') {
                const evaled = evaluateAll(width, widthBreakpoints, remBase, emBase)
                wTable = evaled.table
                wActive = evaled.active
            }
            if (dimension === 'height' || dimension === 'both') {
                const evaled = evaluateAll(height, heightBreakpoints, remBase, emBase)
                hTable = evaled.table
                hActive = evaled.active
            }
        }

        if (dimension === 'width') {
            hTable = {}
            hActive = []
        } else if (dimension === 'height') {
            wTable = {}
            wActive = []
        }

        const matches = wActive.length > 0 || hActive.length > 0
        const wActiveFrozen = Object.freeze([...wActive]) as string[]
        const hActiveFrozen = Object.freeze([...hActive]) as string[]
        const wTableFrozen = Object.freeze({ ...wTable })
        const hTableFrozen = Object.freeze({ ...hTable })

        return {
            width,
            height,
            activeWidthKeys: wActiveFrozen,
            activeHeightKeys: hActiveFrozen,
            widthMatches: wTableFrozen,
            heightMatches: hTableFrozen,
            matches,
            primaryWidth: wActive[0] ?? null,
            primaryHeight: hActive[0] ?? null,
        }
    }

    private _recompute(isFromMql = false): BreakpointState {
        const { widthBreakpoints, heightBreakpoints, dimension, remBase, emBase } = this._config
        let width = this._stateSubject.getValue().width
        let height = this._stateSubject.getValue().height

        if (this._element) {
            if (this._lastContentRect) {
                width = this._lastContentRect.width
                height = this._lastContentRect.height
            } else {
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
            }
        } else {
            const w = getWindow()
            width = w ? w.innerWidth : width
            height = w ? w.innerHeight : height
        }

        void isFromMql

        let wActive: string[] = []
        let wTable: Record<string, boolean> = {}
        let hActive: string[] = []
        let hTable: Record<string, boolean> = {}

        if (dimension === 'width' || dimension === 'both') {
            const evaled = evaluateAll(width, widthBreakpoints, remBase, emBase)
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
        const wActiveFrozen = Object.freeze([...wActive]) as string[]
        const hActiveFrozen = Object.freeze([...hActive]) as string[]
        const wTableFrozen = Object.freeze({ ...wTable })
        const hTableFrozen = Object.freeze({ ...hTable })

        return {
            width,
            height,
            activeWidthKeys: wActiveFrozen,
            activeHeightKeys: hActiveFrozen,
            widthMatches: wTableFrozen,
            heightMatches: hTableFrozen,
            matches,
            primaryWidth: wActive[0] ?? null,
            primaryHeight: hActive[0] ?? null,
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
        const { widthBreakpoints, heightBreakpoints, dimension, mediaQueryExclusiveStep } = this._config

        const maps: Array<{ map: WidthBreakpointMap | HeightBreakpointMap; dim: 'width' | 'height' }> = []
        if (dimension === 'width' || dimension === 'both') maps.push({ map: widthBreakpoints, dim: 'width' })
        if (dimension === 'height' || dimension === 'both') maps.push({ map: heightBreakpoints, dim: 'height' })

        const hasMatchMedia = canUseMatchMedia()
        let hasMql = false
        let hasFallback = false

        for (const { map, dim } of maps) {
            for (const [key, def] of Object.entries(map)) {
                const q = definitionToMediaQuery(def, dim, mediaQueryExclusiveStep)
                const cacheKey = `${dim}:${key}`
                if (q !== null && hasMatchMedia) {
                    const mql = getWindow()!.matchMedia(q)
                    const handler = () => this._scheduleEmit()
                    if (typeof mql.addEventListener === 'function') {
                        mql.addEventListener('change', handler)
                    } else {
                        // @ts-ignore legacy
                        mql.addListener(handler)
                    }
                    this._mqlMap.set(cacheKey, { mql, handler, query: q })
                    hasMql = true
                } else {
                    hasFallback = true
                }
            }
        }

        if (hasMql || hasFallback) {
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
            RO = (getWindow() as unknown as { ResizeObserver?: typeof ResizeObserver })?.ResizeObserver
        }
        if (!RO) {
            const handler = () => this._scheduleEmit()
            this._elementResizeHandler = handler
            getWindow()?.addEventListener('resize', handler)
            return
        }
        const ro = new RO((entries) => {
            const entry = entries[0] as unknown as { contentRect?: DOMRectReadOnly } | undefined
            if (entry && entry.contentRect) {
                const cr = entry.contentRect
                this._lastContentRect = { width: cr.width, height: cr.height }
            } else {
                this._lastContentRect = null
            }
            this._scheduleEmit()
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
        this._lastContentRect = null
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

    getState(): BreakpointState {
        return this.snapshot
    }

    get attachedElement(): HTMLElement | null {
        return this._element
    }

    get primaryWidth(): string | null {
        return this.snapshot.primaryWidth
    }

    get primaryHeight(): string | null {
        return this.snapshot.primaryHeight
    }

    // --- key presence (string is always a breakpoint key) ---

    hasWidth(key: string): boolean {
        return !!this.snapshot.widthMatches[key]
    }

    hasHeight(key: string): boolean {
        return !!this.snapshot.heightMatches[key]
    }

    has(key: string, dimension: BreakpointDimension = 'width'): boolean {
        if (dimension === 'both') return !!(this.snapshot.widthMatches[key] || this.snapshot.heightMatches[key])
        if (dimension === 'width') return !!this.snapshot.widthMatches[key]
        return !!this.snapshot.heightMatches[key]
    }

    // --- condition matching (BreakpointDefinition, never key) ---

    matchesWidth(def: BreakpointDefinition): boolean {
        const remBase = this._config.remBase ?? REM_BASE
        const emBase = this._config.emBase ?? EM_BASE
        return matchesDefinition(this.snapshot.width, def, remBase, emBase)
    }

    matchesHeight(def: BreakpointDefinition): boolean {
        const remBase = this._config.remBase ?? REM_BASE
        const emBase = this._config.emBase ?? EM_BASE
        return matchesDefinition(this.snapshot.height, def, remBase, emBase)
    }

    matches(def: BreakpointDefinition, dimension: BreakpointDimension = 'width'): boolean {
        const remBase = this._config.remBase ?? REM_BASE
        const emBase = this._config.emBase ?? EM_BASE
        if (dimension === 'both') return matchesDefinition(this.snapshot.width, def, remBase, emBase) || matchesDefinition(this.snapshot.height, def, remBase, emBase)
        const v = dimension === 'height' ? this.snapshot.height : this.snapshot.width
        return matchesDefinition(v, def, remBase, emBase)
    }

    // --- subscribe (callback, cb required) ---

    subscribeWidth(def: BreakpointDefinition, cb: (state: BreakpointState) => void): () => void {
        const sub = this.state$.pipe(
            distinctUntilChanged((prev, curr) => this.matchesWidthOnState(prev, def) === this.matchesWidthOnState(curr, def)),
        ).subscribe(cb)
        return () => sub.unsubscribe()
    }

    subscribeHeight(def: BreakpointDefinition, cb: (state: BreakpointState) => void): () => void {
        const sub = this.state$.pipe(
            distinctUntilChanged((prev, curr) => this.matchesHeightOnState(prev, def) === this.matchesHeightOnState(curr, def)),
        ).subscribe(cb)
        return () => sub.unsubscribe()
    }

    subscribe(def: BreakpointDefinition, dimension: BreakpointDimension, cb: (state: BreakpointState) => void): () => void {
        const sub = this.state$.pipe(
            distinctUntilChanged((prev, curr) => this.matchesOnState(prev, def, dimension) === this.matchesOnState(curr, def, dimension)),
        ).subscribe(cb)
        return () => sub.unsubscribe()
    }

    // --- watch (Observable<boolean>) ---

    watchWidth(def: BreakpointDefinition): Observable<boolean> {
        return this.state$.pipe(
            map((s) => this.matchesWidthOnState(s, def)),
            distinctUntilChanged(),
        )
    }

    watchHeight(def: BreakpointDefinition): Observable<boolean> {
        return this.state$.pipe(
            map((s) => this.matchesHeightOnState(s, def)),
            distinctUntilChanged(),
        )
    }

    watch(def: BreakpointDefinition, dimension: BreakpointDimension = 'width'): Observable<boolean> {
        return this.state$.pipe(
            map((s) => this.matchesOnState(s, def, dimension)),
            distinctUntilChanged(),
        )
    }

    private matchesWidthOnState(state: BreakpointState, def: BreakpointDefinition): boolean {
        const remBase = this._config.remBase ?? REM_BASE
        const emBase = this._config.emBase ?? EM_BASE
        return matchesDefinition(state.width, def, remBase, emBase)
    }

    private matchesHeightOnState(state: BreakpointState, def: BreakpointDefinition): boolean {
        const remBase = this._config.remBase ?? REM_BASE
        const emBase = this._config.emBase ?? EM_BASE
        return matchesDefinition(state.height, def, remBase, emBase)
    }

    private matchesOnState(state: BreakpointState, def: BreakpointDefinition, dimension: BreakpointDimension): boolean {
        const remBase = this._config.remBase ?? REM_BASE
        const emBase = this._config.emBase ?? EM_BASE
        if (dimension === 'both') return matchesDefinition(state.width, def, remBase, emBase) || matchesDefinition(state.height, def, remBase, emBase)
        const v = dimension === 'height' ? state.height : state.width
        return matchesDefinition(v, def, remBase, emBase)
    }

    attachElement(el: HTMLElement | null): void {
        if (this._disposed) return
        if (el === this._element) return
        this._teardownStrategy()
        this._element = el
        this._config.element = el
        this._scheduleEmitImmediate()
        if (!isServer()) {
            this._initStrategy()
        }
    }

    detachElement(): void {
        this.attachElement(null)
    }

    dispose(): void {
        if (this._disposed) return
        this._disposed = true
        this._teardownStrategy()
        if (this._rafId !== null) {
            getCancelRaf()(this._rafId)
            this._rafId = null
        }
        this._element = null
        this._config.element = null
        try {
            this._stateSubject.complete()
        } catch { }
    }
}

// Singleton — viewport only
let _default: BreakpointObserver | null = null
export function getDefaultViewportObserver(): BreakpointObserver {
    const isDisposed = (_default as unknown as { _disposed?: boolean })?._disposed
    if (!_default || isDisposed) {
        _default = new BreakpointObserver()
    }
    return _default
}
