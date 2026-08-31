/**
 * Breakpoint type definitions, constants, and pure functional condition builders.
 * Zero framework dependencies, pure functions and immutable configurations.
 */

/**
 * Breakpoint condition string expressing a comparison operator, numeric target, and optional CSS unit.
 *
 * @example
 * ```ts
 * const condition: BreakpointCondition = '>= 600px';
 * ```
 */
export type BreakpointCondition = string

/**
 * Logical combiner for compound breakpoint definitions.
 *
 * @example
 * ```ts
 * const combiner: BreakpointLogic = 'and';
 * ```
 */
export type BreakpointLogic = 'and' | 'or'

/**
 * Numeric range specification for breakpoint evaluation.
 *
 * @example
 * ```ts
 * const range: BreakpointRange = { min: 600, max: 840, minInclusive: true, maxInclusive: false };
 * ```
 */
export interface BreakpointRange {
    min?: number
    max?: number
    minInclusive?: boolean
    maxInclusive?: boolean
    eq?: number
    ne?: number
}

/**
 * Flexible breakpoint definition supporting condition strings, compound logic arrays, or numeric ranges.
 *
 * @example
 * ```ts
 * const simple: BreakpointDefinition = '>= 600px';
 * const compound: BreakpointDefinition = { and: ['>= 600px', '< 840px'] };
 * const range: BreakpointDefinition = { min: 600, max: 840 };
 * ```
 */
export type BreakpointDefinition =
    | BreakpointCondition
    | { and: BreakpointCondition[] }
    | { or: BreakpointCondition[] }
    | BreakpointRange

/**
 * Mapping of breakpoint names to their width definitions.
 *
 * @example
 * ```ts
 * const widthMap: WidthBreakpointMap = {
 *     compact: '< 600px',
 *     expanded: '>= 600px',
 * };
 * ```
 */
export type WidthBreakpointMap = Record<string, BreakpointDefinition>

/**
 * Mapping of breakpoint names to their height definitions.
 *
 * @example
 * ```ts
 * const heightMap: HeightBreakpointMap = {
 *     short: '< 500px',
 *     tall: '>= 500px',
 * };
 * ```
 */
export type HeightBreakpointMap = Record<string, BreakpointDefinition>

/**
 * Generic breakpoint dictionary mapping string keys to definitions.
 *
 * @example
 * ```ts
 * const customMap: BreakpointMap = {
 *     mobile: '< 768px',
 *     desktop: '>= 768px',
 * };
 * ```
 */
export type BreakpointMap = WidthBreakpointMap | HeightBreakpointMap

/**
 * Target dimension mode for breakpoint evaluation.
 *
 * @example
 * ```ts
 * const mode: BreakpointDimension = 'both';
 * ```
 */
export type BreakpointDimension = 'width' | 'height' | 'both'

/**
 * Supported CSS length and viewport units for breakpoint conditions.
 *
 * @example
 * ```ts
 * const unit: BreakpointUnit = 'rem';
 * ```
 */
export type BreakpointUnit =
    | 'px' | 'rem' | 'em'
    | 'ex' | 'ch' | 'cap' | 'ic' | 'lh' | 'rlh'
    | 'vw' | 'vh' | 'vmin' | 'vmax' | 'vi' | 'vb'
    | 'dvw' | 'dvh' | 'svw' | 'svh' | 'lvw' | 'lvh'
    | 'cm' | 'mm' | 'in' | 'pt' | 'pc'
    | '%'

/**
 * Supported CSS absolute physical units.
 *
 * @example
 * ```ts
 * const physicalUnit: AbsoluteBreakpointUnit = 'cm';
 * ```
 */
export type AbsoluteBreakpointUnit = 'cm' | 'mm' | 'in' | 'pt' | 'pc'

/**
 * Snapshot of responsive breakpoint evaluation state across width and height dimensions.
 *
 * @example
 * ```ts
 * const state: BreakpointState = computeBreakpointState(1024, 768);
 * console.log(state.primaryWidthBreakpoint); // 'expanded'
 * ```
 */
export interface BreakpointState {
    width: number
    height: number
    activeWidthBreakpoints: string[]
    activeHeightBreakpoints: string[]
    widthMatches: Readonly<Record<string, boolean>>
    heightMatches: Readonly<Record<string, boolean>>
    matches: boolean
    primaryWidthBreakpoint: string | null
    primaryHeightBreakpoint: string | null
}

/**
 * Configuration options for evaluation base units.
 *
 * @example
 * ```ts
 * const options: BreakpointEvaluationOptions = { remBase: 16, emBase: 16 };
 * ```
 */
export interface BreakpointEvaluationOptions {
    remBase?: number
    emBase?: number
}

/**
 * Result structure returned from evaluating a breakpoint map against a pixel dimension.
 *
 * @example
 * ```ts
 * const result: BreakpointEvaluationResult = evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS, 700);
 * console.log(result.activeBreakpoints); // ['medium', 'sm']
 * ```
 */
export interface BreakpointEvaluationResult {
    activeBreakpoints: string[]
    matchesTable: Readonly<Record<string, boolean>>
}

/**
 * Default base pixel size for rem unit conversion (16px).
 *
 * @example
 * ```ts
 * console.log(REM_BASE); // 16
 * ```
 */
export const REM_BASE = 16

/**
 * Default base pixel size for em unit conversion (16px).
 *
 * @example
 * ```ts
 * console.log(EM_BASE); // 16
 * ```
 */
export const EM_BASE = 16

/**
 * Pixel conversion factors for CSS absolute physical units (at 96 DPI standard).
 *
 * @example
 * ```ts
 * console.log(ABSOLUTE_PX.in); // 96
 * ```
 */
export const ABSOLUTE_PX: Readonly<Record<AbsoluteBreakpointUnit, number>> = Object.freeze({
    cm: 37.795275591,
    mm: 3.7795275591,
    in: 96,
    pt: 1.3333333333,
    pc: 16,
})

/**
 * Configuration parameters for creating breakpoint observers and streams.
 *
 * @example
 * ```ts
 * const configuration: BreakpointConfiguration = {
 *     dimension: 'both',
 *     remBase: 16,
 * };
 * ```
 */
export interface BreakpointConfiguration {
    widthBreakpoints?: WidthBreakpointMap
    heightBreakpoints?: HeightBreakpointMap
    dimension?: BreakpointDimension
    element?: HTMLElement | null
    defaultWidthMatches?: Record<string, boolean>
    defaultHeightMatches?: Record<string, boolean>
    mediaQueryExclusiveStep?: number
    remBase?: number
    emBase?: number
}

/**
 * Material Design 3 (MD3) standard responsive width breakpoint configuration with common aliases.
 *
 * @example
 * ```ts
 * console.log(DEFAULT_WIDTH_BREAKPOINTS.compact); // '< 600px'
 * ```
 */
export const DEFAULT_WIDTH_BREAKPOINTS: Readonly<WidthBreakpointMap> = Object.freeze({
    compact: '< 600px',
    medium: { and: ['>= 600px', '< 840px'] },
    expanded: { and: ['>= 840px', '< 1200px'] },
    large: { and: ['>= 1200px', '< 1600px'] },
    extraLarge: '>= 1600px',
    xs: '< 600px',
    sm: { and: ['>= 600px', '< 840px'] },
    md: { and: ['>= 840px', '< 1200px'] },
    lg: { and: ['>= 1200px', '< 1600px'] },
    xl: '>= 1600px',
})

/**
 * Material Design 3 (MD3) standard responsive height breakpoint configuration.
 *
 * @example
 * ```ts
 * console.log(DEFAULT_HEIGHT_BREAKPOINTS.compact); // '< 480px'
 * ```
 */
export const DEFAULT_HEIGHT_BREAKPOINTS: Readonly<HeightBreakpointMap> = Object.freeze({
    compact: '< 480px',
    medium: { and: ['>= 480px', '< 900px'] },
    expanded: '>= 900px',
})

/**
 * Options for creating an interval breakpoint definition.
 *
 * @example
 * ```ts
 * const options: BreakpointIntervalOptions = { minInclusive: true, maxInclusive: false, unit: 'px' };
 * ```
 */
export interface BreakpointIntervalOptions {
    minInclusive?: boolean
    maxInclusive?: boolean
    unit?: BreakpointUnit
}

/**
 * Formats a numeric value and unit into a valid condition suffix.
 *
 * @param value - The numeric value.
 * @param unit - The CSS unit string.
 * @returns The formatted string representation.
 */
function formatValueWithUnit(numericValue: number, unit: BreakpointUnit = 'px'): string {
    return `${numericValue}${unit}`
}

/**
 * Creates a strictly greater-than ('>') breakpoint condition.
 *
 * @param targetValue - The numeric threshold value.
 * @param unit - The unit of measurement (defaults to 'px').
 * @returns A formatted condition string.
 *
 * @example
 * ```ts
 * greaterThan(840); // '> 840px'
 * greaterThan(50, 'rem'); // '> 50rem'
 * ```
 */
export function greaterThan(targetValue: number, unit: BreakpointUnit = 'px'): BreakpointCondition {
    return `> ${formatValueWithUnit(targetValue, unit)}`
}

/**
 * Creates a greater-than-or-equal-to ('>=') breakpoint condition.
 *
 * @param targetValue - The numeric threshold value.
 * @param unit - The unit of measurement (defaults to 'px').
 * @returns A formatted condition string.
 *
 * @example
 * ```ts
 * greaterThanOrEqual(600); // '>= 600px'
 * ```
 */
export function greaterThanOrEqual(targetValue: number, unit: BreakpointUnit = 'px'): BreakpointCondition {
    return `>= ${formatValueWithUnit(targetValue, unit)}`
}

/**
 * Creates a strictly less-than ('<') breakpoint condition.
 *
 * @param targetValue - The numeric threshold value.
 * @param unit - The unit of measurement (defaults to 'px').
 * @returns A formatted condition string.
 *
 * @example
 * ```ts
 * lessThan(1200); // '< 1200px'
 * ```
 */
export function lessThan(targetValue: number, unit: BreakpointUnit = 'px'): BreakpointCondition {
    return `< ${formatValueWithUnit(targetValue, unit)}`
}

/**
 * Creates a less-than-or-equal-to ('<=') breakpoint condition.
 *
 * @param targetValue - The numeric threshold value.
 * @param unit - The unit of measurement (defaults to 'px').
 * @returns A formatted condition string.
 *
 * @example
 * ```ts
 * lessThanOrEqual(960); // '<= 960px'
 * ```
 */
export function lessThanOrEqual(targetValue: number, unit: BreakpointUnit = 'px'): BreakpointCondition {
    return `<= ${formatValueWithUnit(targetValue, unit)}`
}

/**
 * Creates an exact equality ('=') breakpoint condition.
 *
 * @param targetValue - The numeric threshold value.
 * @param unit - The unit of measurement (defaults to 'px').
 * @returns A formatted condition string.
 *
 * @example
 * ```ts
 * equals(1600); // '= 1600px'
 * ```
 */
export function equals(targetValue: number, unit: BreakpointUnit = 'px'): BreakpointCondition {
    return `= ${formatValueWithUnit(targetValue, unit)}`
}

/**
 * Creates an inequality ('!=') breakpoint condition.
 *
 * @param targetValue - The numeric threshold value.
 * @param unit - The unit of measurement (defaults to 'px').
 * @returns A formatted condition string.
 *
 * @example
 * ```ts
 * notEquals(960); // '!= 960px'
 * ```
 */
export function notEquals(targetValue: number, unit: BreakpointUnit = 'px'): BreakpointCondition {
    return `!= ${formatValueWithUnit(targetValue, unit)}`
}

/**
 * Constructs an interval breakpoint definition between minimum and maximum bounds.
 * Defaults to left-closed, right-open interval [min, max).
 *
 * @param minimumValue - The lower bound value.
 * @param maximumValue - The upper bound value.
 * @param options - Inclusivity options and unit.
 * @returns A compound breakpoint definition with 'and' logic.
 *
 * @example
 * ```ts
 * createBreakpointInterval(600, 840); // { and: ['>= 600px', '< 840px'] }
 * createBreakpointInterval(840, 1199, { maxInclusive: true }); // { and: ['>= 840px', '<= 1199px'] }
 * ```
 */
export function createBreakpointInterval(
    minimumValue: number,
    maximumValue: number,
    options: BreakpointIntervalOptions = {},
): BreakpointDefinition {
    const { minInclusive = true, maxInclusive = false, unit = 'px' } = options
    const leftCondition = minInclusive
        ? `>= ${formatValueWithUnit(minimumValue, unit)}`
        : `> ${formatValueWithUnit(minimumValue, unit)}`
    const rightCondition = maxInclusive
        ? `<= ${formatValueWithUnit(maximumValue, unit)}`
        : `< ${formatValueWithUnit(maximumValue, unit)}`
    return { and: [leftCondition, rightCondition] }
}

/**
 * Namespace object bundling functional breakpoint condition factories.
 *
 * @example
 * ```ts
 * Breakpoint.gt(840); // '> 840px'
 * Breakpoint.interval(600, 840); // { and: ['>= 600px', '< 840px'] }
 * ```
 */
export const Breakpoint = Object.freeze({
    gt: greaterThan,
    gte: greaterThanOrEqual,
    lt: lessThan,
    lte: lessThanOrEqual,
    eq: equals,
    ne: notEquals,
    interval: createBreakpointInterval,
    between: createBreakpointInterval,
})

