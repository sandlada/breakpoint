/**
 * breakpoints — Default breakpoints, type definitions and factory helpers
 * Zero framework dependencies, pure functions/constants
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type BreakpointCondition = string
export type BreakpointLogic = 'and' | 'or'

export interface BreakpointRange {
    min?: number
    max?: number
    minInclusive?: boolean
    maxInclusive?: boolean
    eq?: number
    ne?: number
}

/** @deprecated use BreakpointRange */
export type BreakpointObject = BreakpointRange

export type BreakpointDefinition =
    | BreakpointCondition
    | { and: BreakpointCondition[] }
    | { or: BreakpointCondition[] }
    | BreakpointRange

export type WidthBreakpointMap = Record<string, BreakpointDefinition>
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
    activeWidthKeys: string[]
    activeHeightKeys: string[]
    widthMatches: Readonly<Record<string, boolean>>
    heightMatches: Readonly<Record<string, boolean>>
    matches: boolean
    primaryWidth: string | null
    primaryHeight: string | null
}

export const REM_BASE = 16
export const EM_BASE = 16

export type AbsoluteUnit = 'cm' | 'mm' | 'in' | 'pt' | 'pc'

/** Absolute units → px (96dpi) */
export const ABSOLUTE_PX: Readonly<Record<AbsoluteUnit, number>> = {
    cm: 37.795275591,
    mm: 3.7795275591,
    in: 96,
    pt: 1.3333333333,
    pc: 16,
} as const

export interface BreakpointConfig {
    widthBreakpoints?: WidthBreakpointMap
    heightBreakpoints?: HeightBreakpointMap
    dimension?: BreakpointDimension
    element?: HTMLElement | null
    defaultWidthMatches?: Record<string, boolean>
    defaultHeightMatches?: Record<string, boolean>
    /** Media-query exclusive endpoint step (px), converts > / < to min-/max- with step. Defaults to 0.05 */
    mediaQueryExclusiveStep?: number
    /** rem -> px conversion base, defaults to 16 */
    remBase?: number
    /** em -> px conversion base, defaults to 16 (independent from remBase) */
    emBase?: number
}

// ---------------------------------------------------------------------------
// Default breakpoints (MD3), human-readable string form
// ---------------------------------------------------------------------------

export const DEFAULT_WIDTH_BREAKPOINTS: WidthBreakpointMap = {
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
     * interval — Unified interval helper, replaces between/range
     * @example interval(600, 840) => { and: ['>= 600px','< 840px'] } (MD3 left-closed right-open)
     * @example interval(840, 1199, { minInclusive:true, maxInclusive:true }) => { and: ['>= 840px','<= 1199px'] }
     */
    interval: (
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
     * between — Alias to interval for migration, prefer interval
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
} as const
