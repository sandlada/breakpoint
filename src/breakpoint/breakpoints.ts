/**
 * breakpoints — Default breakpoints, type definitions and factory helpers
 * Zero framework dependencies, pure functions/constants
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type BreakpointCondition = string
export type BreakpointLogic = 'and' | 'or'

export interface BreakpointObject {
    min?: number
    max?: number
    minInclusive?: boolean
    maxInclusive?: boolean
    eq?: number
    ne?: number
}

export type BreakpointDefinition =
    | BreakpointCondition
    | BreakpointCondition[]
    | { and: BreakpointCondition[] }
    | { or: BreakpointCondition[] }
    | BreakpointObject
    | number

export type BreakpointMap = Record<string, BreakpointDefinition>
export type HeightBreakpointMap = Record<string, BreakpointDefinition>

export type BreakpointDimension = 'width' | 'height' | 'both'

export type BreakpointUnit =
    | 'px' | 'rem' | 'em'
    | 'ex' | 'ch' | 'cap' | 'ic' | 'lh' | 'rlh'
    | 'vw' | 'vh' | 'vmin' | 'vmax' | 'vi' | 'vb'
    | 'dvw' | 'dvh' | 'svw' | 'svh' | 'lvw' | 'lvh'
    | 'cm' | 'mm' | 'in' | 'pt' | 'pc'
    | '%'

export interface BreakpointState {
    width: number
    height: number
    active: string[]
    activeHeight: string[]
    breakpoints: Readonly<Record<string, boolean>>
    heightBreakpoints: Readonly<Record<string, boolean>>
    matches: boolean
    /** Compat: first matched breakpoint */
    current: string | null
    currentHeight: string | null
}

export const REM_BASE = 16
export const EM_BASE = 16

/** Absolute units → px (96dpi) */
export const ABSOLUTE_PX: Readonly<Record<string, number>> = {
    cm: 37.795275591,
    mm: 3.7795275591,
    in: 96,
    pt: 1.3333333333,
    pc: 16,
} as const

export interface BreakpointConfig {
    breakpoints?: BreakpointMap
    heightBreakpoints?: HeightBreakpointMap
    dimension?: BreakpointDimension
    element?: HTMLElement | null
    defaultMatches?: Record<string, boolean>
    defaultHeightMatches?: Record<string, boolean>
    /**
     * @deprecated — retained for compat; string conditions already carry unit (e.g. ">= 600px").
     * Number shorthand always uses px; use remBase/emBase for rem/em conversion.
     */
    unit?: BreakpointUnit
    /** Exclusive endpoint step (px), handles deduplication of < / > in matchMedia, defaults to 0.05 */
    step?: number
    /** rem -> px conversion base, defaults to 16 */
    remBase?: number
    /** em -> px conversion base, defaults to 16 (independent from remBase) */
    emBase?: number
}

// ---------------------------------------------------------------------------
// Default breakpoints (MD3), human-readable string form
// ---------------------------------------------------------------------------

export const DEFAULT_BREAKPOINTS: BreakpointMap = {
    compact: '< 600px',
    medium: { and: ['>= 600px', '< 840px'] },
    expanded: { and: ['>= 840px', '< 1200px'] },
    large: { and: ['>= 1200px', '< 1600px'] },
    extraLarge: '>= 1600px',
    // Aliases
    xs: '< 600px',
    sm: { and: ['>= 600px', '< 840px'] },
    md: { and: ['>= 840px', '< 1200px'] },
    lg: { and: ['>= 1200px', '< 1600px'] },
    xl: '>= 1600px',
}

export const DEFAULT_HEIGHT_BREAKPOINTS: HeightBreakpointMap = {
    compact: '< 480px',
    medium: { and: ['>= 480px', '< 900px'] },
    expanded: '>= 900px',
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function fmt(value: number, unit: string = 'px'): string {
    return `${value}${unit}`
}

export const Breakpoint = {
    gt: (value: number, unit: BreakpointUnit = 'px'): BreakpointCondition =>
        `> ${fmt(value, unit)}`,
    gte: (value: number, unit: BreakpointUnit = 'px'): BreakpointCondition =>
        `>= ${fmt(value, unit)}`,
    lt: (value: number, unit: BreakpointUnit = 'px'): BreakpointCondition =>
        `< ${fmt(value, unit)}`,
    lte: (value: number, unit: BreakpointUnit = 'px'): BreakpointCondition =>
        `<= ${fmt(value, unit)}`,
    eq: (value: number, unit: BreakpointUnit = 'px'): BreakpointCondition =>
        `= ${fmt(value, unit)}`,
    ne: (value: number, unit: BreakpointUnit = 'px'): BreakpointCondition =>
        `!= ${fmt(value, unit)}`,

    /**
     * between — Left-closed, right-open interval, MD3 semantics
     * @example between(600, 840) => { and: ['>= 600px','< 840px'] }
     */
    between: (
        min: number,
        max: number,
        opts: { minInclusive?: boolean; maxInclusive?: boolean; unit?: BreakpointUnit } = {},
    ): BreakpointDefinition => {
        const { minInclusive = true, maxInclusive = false, unit = 'px' } = opts
        const left = minInclusive ? `>= ${fmt(min, unit)}` : `> ${fmt(min, unit)}`
        const right = maxInclusive ? `<= ${fmt(max, unit)}` : `< ${fmt(max, unit)}`
        return { and: [left, right] }
    },

    /**
     * range — Closed-interval helper, similar to between but defaults to inclusive on both ends
     * @example range(840, 1199) => { and: ['>= 840px','<= 1199px'] }
     */
    range: (
        min: number,
        max: number,
        opts: { minInclusive?: boolean; maxInclusive?: boolean; unit?: BreakpointUnit } = {},
    ): BreakpointDefinition => {
        const { minInclusive = true, maxInclusive = true, unit = 'px' } = opts
        const left = minInclusive ? `>= ${fmt(min, unit)}` : `> ${fmt(min, unit)}`
        const right = maxInclusive ? `<= ${fmt(max, unit)}` : `< ${fmt(max, unit)}`
        return { and: [left, right] }
    },
} as const
