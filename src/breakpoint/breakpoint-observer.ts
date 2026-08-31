/**
 * Pure functional breakpoint observation, evaluation, and reactive stream architecture.
 * Zero framework dependencies, pure higher-order functions, and deterministic calculations.
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
    type BreakpointConfiguration,
    type BreakpointDefinition,
    type BreakpointDimension,
    type BreakpointEvaluationOptions,
    type BreakpointEvaluationResult,
    type BreakpointRange,
    type BreakpointState,
    type BreakpointUnit,
    DEFAULT_HEIGHT_BREAKPOINTS,
    DEFAULT_WIDTH_BREAKPOINTS,
    EM_BASE,
    type HeightBreakpointMap,
    REM_BASE,
    type WidthBreakpointMap,
} from './breakpoints.js'
import {
    canUseMatchMedia,
    canUseRequestAnimationFrame,
    canUseResizeObserver,
    getWindow,
    isServer,
} from './is-server.js'
import { isShallowEqualArray, isShallowEqualRecord } from './rx.js'

const CSS_UNITS_PATTERN = '(px|rem|em|ex|ch|cap|ic|lh|rlh|vw|vh|vmin|vmax|vi|vb|dvw|dvh|svw|svh|lvw|lvh|cm|mm|in|pt|pc|%)'
const BREAKPOINT_CONDITION_REGEX = new RegExp(
    `^\\s*(>=|<=|>|<|==|=|!=)\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*${CSS_UNITS_PATTERN}?\\s*$`,
    'i',
)

/**
 * Parsed CSS unit type for breakpoint conditions.
 *
 * @example
 * ```ts
 * const unit: ParsedBreakpointUnit = 'px'
 * ```
 */
export type ParsedBreakpointUnit = BreakpointUnit

/**
 * Structured breakdown of a parsed breakpoint condition string.
 *
 * @example
 * ```ts
 * const parsed: ParsedBreakpointCondition = parseBreakpointCondition('>= 600px')
 * console.log(parsed.operator, parsed.targetValue, parsed.unit) // '>=', 600, 'px'
 * ```
 */
export interface ParsedBreakpointCondition {
    readonly operator: '>=' | '<=' | '>' | '<' | '=' | '==' | '!='
    readonly targetValue: number
    readonly unit: ParsedBreakpointUnit
}

/**
 * Parses a breakpoint condition string into a structured operator, numeric target, and unit.
 *
 * @param conditionString - The condition string to parse (e.g. '>= 600px', '< 10rem').
 * @returns Structured ParsedBreakpointCondition object.
 * @throws TypeError if conditionString is malformed or invalid.
 *
 * @example
 * ```ts
 * parseBreakpointCondition('>= 600px') // { operator: '>=', targetValue: 600, unit: 'px' }
 * ```
 */
export function parseBreakpointCondition(conditionString: BreakpointCondition): ParsedBreakpointCondition {
    const matchResult = BREAKPOINT_CONDITION_REGEX.exec(conditionString)
    if (!matchResult) {
        throw new TypeError(`Invalid breakpoint condition: "${conditionString}"`)
    }
    const operator = matchResult[1] as ParsedBreakpointCondition['operator']
    const targetValue = Number(matchResult[2])
    const unit = ((matchResult[3] as string | undefined)?.toLowerCase() as ParsedBreakpointUnit | undefined) ?? 'px'
    return {
        operator,
        targetValue,
        unit,
    }
}

/**
 * Converts a numeric value and CSS unit into pixel equivalent.
 *
 * @param targetValue - The numeric value.
 * @param unit - The unit of measurement.
 * @param remBase - Base pixel size for rem units.
 * @param emBase - Base pixel size for em units.
 * @returns Numeric pixel value, or NaN if unit cannot be resolved without layout context.
 */
function convertUnitToPixels(
    targetValue: number,
    unit: ParsedBreakpointUnit,
    remBase: number,
    emBase: number,
): number {
    switch (unit) {
        case 'px':
            return targetValue
        case 'rem':
            return targetValue * remBase
        case 'em':
            return targetValue * emBase
        case 'cm':
        case 'mm':
        case 'in':
        case 'pt':
        case 'pc':
            return targetValue * ABSOLUTE_PX[unit]
        case 'vw':
        case 'dvw':
        case 'svw':
        case 'lvw':
        case 'vi': {
            const currentWindow = getWindow()
            const windowWidth = currentWindow ? currentWindow.innerWidth : NaN
            return Number.isNaN(windowWidth) ? NaN : (targetValue * windowWidth) / 100
        }
        case 'vh':
        case 'dvh':
        case 'svh':
        case 'lvh':
        case 'vb': {
            const currentWindow = getWindow()
            const windowHeight = currentWindow ? currentWindow.innerHeight : NaN
            return Number.isNaN(windowHeight) ? NaN : (targetValue * windowHeight) / 100
        }
        case 'vmin': {
            const currentWindow = getWindow()
            if (!currentWindow) return NaN
            return (targetValue * Math.min(currentWindow.innerWidth, currentWindow.innerHeight)) / 100
        }
        case 'vmax': {
            const currentWindow = getWindow()
            if (!currentWindow) return NaN
            return (targetValue * Math.max(currentWindow.innerWidth, currentWindow.innerHeight)) / 100
        }
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

/**
 * Internal evaluator for a single condition string against a target pixel value.
 */
function evaluateMatchesCondition(
    conditionString: BreakpointCondition,
    targetValuePx: number,
    options?: BreakpointEvaluationOptions,
): boolean {
    const remBase = options?.remBase ?? REM_BASE
    const emBase = options?.emBase ?? EM_BASE
    const parsed = parseBreakpointCondition(conditionString)
    const convertedTargetPx = convertUnitToPixels(parsed.targetValue, parsed.unit, remBase, emBase)
    if (Number.isNaN(convertedTargetPx)) {
        return false
    }
    switch (parsed.operator) {
        case '>':
            return targetValuePx > convertedTargetPx
        case '>=':
            return targetValuePx >= convertedTargetPx
        case '<':
            return targetValuePx < convertedTargetPx
        case '<=':
            return targetValuePx <= convertedTargetPx
        case '=':
        case '==':
            return targetValuePx === convertedTargetPx
        case '!=':
            return targetValuePx !== convertedTargetPx
        default:
            return false
    }
}

/**
 * Pure evaluation function testing if a pixel value satisfies a condition string.
 * Supports data-last currying: `matchesBreakpointCondition(condition)(targetValuePx)`
 * as well as direct invocation `matchesBreakpointCondition(condition, targetValuePx)`.
 *
 * @param conditionString - Condition string to evaluate.
 * @param options - Optional remBase/emBase options.
 * @returns Curried unary function accepting targetValuePx, or boolean if targetValuePx provided.
 *
 * @example
 * ```ts
 * const isMediumWidth = matchesBreakpointCondition('>= 600px')
 * isMediumWidth(700) // true
 * matchesBreakpointCondition('>= 600px', 700) // true
 * ```
 */
export function matchesBreakpointCondition(
    conditionString: BreakpointCondition,
    options?: BreakpointEvaluationOptions,
): (targetValuePx: number) => boolean
export function matchesBreakpointCondition(
    conditionString: BreakpointCondition,
    targetValuePx: number,
    options?: BreakpointEvaluationOptions,
): boolean
export function matchesBreakpointCondition(
    targetValuePx: number,
    conditionString: BreakpointCondition,
    options?: BreakpointEvaluationOptions,
): boolean
export function matchesBreakpointCondition(
    firstArgument: BreakpointCondition | number,
    secondArgument?: number | BreakpointCondition | BreakpointEvaluationOptions,
    thirdArgument?: BreakpointEvaluationOptions,
): boolean | ((targetValuePx: number) => boolean) {
    if (typeof firstArgument === 'number' && typeof secondArgument === 'string') {
        return evaluateMatchesCondition(secondArgument, firstArgument, thirdArgument)
    }
    if (typeof firstArgument === 'string') {
        if (typeof secondArgument === 'number') {
            return evaluateMatchesCondition(firstArgument, secondArgument, thirdArgument)
        }
        const evaluationOptions = secondArgument as BreakpointEvaluationOptions | undefined
        return (targetValuePx: number): boolean => {
            return evaluateMatchesCondition(firstArgument, targetValuePx, evaluationOptions)
        }
    }
    throw new TypeError('Invalid arguments provided to matchesBreakpointCondition')
}

/**
 * Determines whether a definition is a BreakpointRange specification.
 */
function isBreakpointRange(
    definition: unknown,
): definition is BreakpointRange {
    return (
        typeof definition === 'object' &&
        definition !== null &&
        !Array.isArray(definition) &&
        !('and' in (definition as Record<string, unknown>)) &&
        !('or' in (definition as Record<string, unknown>))
    )
}

/**
 * Internal evaluator for a complete BreakpointDefinition against a target pixel value.
 */
function evaluateMatchesDefinition(
    breakpointDefinition: BreakpointDefinition,
    targetValuePx: number,
    options?: BreakpointEvaluationOptions,
): boolean {
    if (typeof breakpointDefinition === 'string') {
        return evaluateMatchesCondition(breakpointDefinition, targetValuePx, options)
    }
    if (isBreakpointRange(breakpointDefinition)) {
        if (
            breakpointDefinition.min === undefined &&
            breakpointDefinition.max === undefined &&
            breakpointDefinition.eq === undefined &&
            breakpointDefinition.ne === undefined
        ) {
            throw new TypeError('Invalid breakpoint definition: empty object')
        }
        let isMatching = true
        if (breakpointDefinition.eq !== undefined) {
            isMatching = isMatching && targetValuePx === breakpointDefinition.eq
        }
        if (breakpointDefinition.ne !== undefined) {
            isMatching = isMatching && targetValuePx !== breakpointDefinition.ne
        }
        if (breakpointDefinition.min !== undefined) {
            isMatching =
                isMatching &&
                (breakpointDefinition.minInclusive === false
                    ? targetValuePx > breakpointDefinition.min
                    : targetValuePx >= breakpointDefinition.min)
        }
        if (breakpointDefinition.max !== undefined) {
            isMatching =
                isMatching &&
                (breakpointDefinition.maxInclusive === true
                    ? targetValuePx <= breakpointDefinition.max
                    : targetValuePx < breakpointDefinition.max)
        }
        return isMatching
    }
    if (typeof breakpointDefinition === 'object' && breakpointDefinition !== null) {
        if ('and' in breakpointDefinition && Array.isArray((breakpointDefinition as { and: unknown }).and)) {
            const conditionArray = (breakpointDefinition as { and: BreakpointCondition[] }).and
            return conditionArray.every((condition) => evaluateMatchesCondition(condition, targetValuePx, options))
        }
        if ('or' in breakpointDefinition && Array.isArray((breakpointDefinition as { or: unknown }).or)) {
            const conditionArray = (breakpointDefinition as { or: BreakpointCondition[] }).or
            return conditionArray.some((condition) => evaluateMatchesCondition(condition, targetValuePx, options))
        }
    }
    throw new TypeError(`Invalid breakpoint definition: ${String(breakpointDefinition)}`)
}

/**
 * Pure evaluation function testing if a pixel value satisfies a breakpoint definition.
 * Supports data-last currying: `matchesBreakpointDefinition(definition)(targetValuePx)`
 * as well as direct invocation `matchesBreakpointDefinition(definition, targetValuePx)`.
 *
 * @param breakpointDefinition - Breakpoint definition to evaluate.
 * @param options - Optional remBase/emBase options.
 * @returns Curried unary function accepting targetValuePx, or boolean if targetValuePx provided.
 *
 * @example
 * ```ts
 * const isExpanded = matchesBreakpointDefinition({ and: ['>= 840px', '< 1200px'] })
 * isExpanded(900) // true
 * matchesBreakpointDefinition({ and: ['>= 840px', '< 1200px'] }, 900) // true
 * ```
 */
export function matchesBreakpointDefinition(
    breakpointDefinition: BreakpointDefinition,
    options?: BreakpointEvaluationOptions,
): (targetValuePx: number) => boolean
export function matchesBreakpointDefinition(
    breakpointDefinition: BreakpointDefinition,
    targetValuePx: number,
    options?: BreakpointEvaluationOptions,
): boolean
export function matchesBreakpointDefinition(
    targetValuePx: number,
    breakpointDefinition: BreakpointDefinition,
    options?: BreakpointEvaluationOptions,
): boolean
export function matchesBreakpointDefinition(
    firstArgument: BreakpointDefinition | number,
    secondArgument?: number | BreakpointDefinition | BreakpointEvaluationOptions,
    thirdArgument?: BreakpointEvaluationOptions,
): boolean | ((targetValuePx: number) => boolean) {
    if (typeof firstArgument === 'number') {
        return evaluateMatchesDefinition(secondArgument as BreakpointDefinition, firstArgument, thirdArgument)
    }
    if (typeof secondArgument === 'number') {
        return evaluateMatchesDefinition(firstArgument as BreakpointDefinition, secondArgument, thirdArgument)
    }
    const evaluationOptions = secondArgument as BreakpointEvaluationOptions | undefined
    return (targetValuePx: number): boolean => {
        return evaluateMatchesDefinition(firstArgument as BreakpointDefinition, targetValuePx, evaluationOptions)
    }
}

/**
 * Internal evaluator for a complete breakpoint map against a target pixel value.
 */
function evaluateBreakpointMapInternal(
    breakpointMap: WidthBreakpointMap | HeightBreakpointMap,
    targetValuePx: number,
    options?: BreakpointEvaluationOptions,
): BreakpointEvaluationResult {
    if (typeof breakpointMap !== 'object' || breakpointMap === null || Array.isArray(breakpointMap)) {
        throw new TypeError('Invalid breakpoint map: expected an object')
    }
    const matchesTable: Record<string, boolean> = {}
    const activeBreakpoints: string[] = []
    for (const [breakpointKey, breakpointDefinition] of Object.entries(breakpointMap)) {
        const isMatched = evaluateMatchesDefinition(breakpointDefinition, targetValuePx, options)
        matchesTable[breakpointKey] = isMatched
        if (isMatched) {
            activeBreakpoints.push(breakpointKey)
        }
    }
    const frozenActiveBreakpoints = Object.freeze([...activeBreakpoints]) as string[]
    const frozenMatchesTable = Object.freeze({ ...matchesTable })
    return {
        activeBreakpoints: frozenActiveBreakpoints,
        matchesTable: frozenMatchesTable,
    }
}

/**
 * Pure evaluation function evaluating all breakpoints in a map against a target pixel dimension.
 * Supports data-last currying: `evaluateBreakpointMap(map)(targetValuePx)`
 * as well as direct invocation `evaluateBreakpointMap(map, targetValuePx)`.
 *
 * @param breakpointMap - Dictionary of breakpoint definitions.
 * @param options - Optional remBase/emBase options.
 * @returns Curried unary function accepting targetValuePx, or BreakpointEvaluationResult.
 *
 * @example
 * ```ts
 * const evaluator = evaluateBreakpointMap(DEFAULT_WIDTH_BREAKPOINTS)
 * const result = evaluator(700)
 * console.log(result.activeBreakpoints) // ['medium', 'sm']
 * ```
 */
export function evaluateBreakpointMap(
    breakpointMap: WidthBreakpointMap | HeightBreakpointMap,
    options?: BreakpointEvaluationOptions,
): (targetValuePx: number) => BreakpointEvaluationResult
export function evaluateBreakpointMap(
    breakpointMap: WidthBreakpointMap | HeightBreakpointMap,
    targetValuePx: number,
    options?: BreakpointEvaluationOptions,
): BreakpointEvaluationResult
export function evaluateBreakpointMap(
    targetValuePx: number,
    breakpointMap: WidthBreakpointMap | HeightBreakpointMap,
    options?: BreakpointEvaluationOptions,
): BreakpointEvaluationResult
export function evaluateBreakpointMap(
    firstArgument: WidthBreakpointMap | HeightBreakpointMap | number,
    secondArgument?: number | WidthBreakpointMap | HeightBreakpointMap | BreakpointEvaluationOptions,
    thirdArgument?: BreakpointEvaluationOptions,
): BreakpointEvaluationResult | ((targetValuePx: number) => BreakpointEvaluationResult) {
    if (typeof firstArgument === 'number') {
        return evaluateBreakpointMapInternal(
            secondArgument as WidthBreakpointMap | HeightBreakpointMap,
            firstArgument,
            thirdArgument,
        )
    }
    if (typeof secondArgument === 'number') {
        return evaluateBreakpointMapInternal(
            firstArgument as WidthBreakpointMap | HeightBreakpointMap,
            secondArgument,
            thirdArgument,
        )
    }
    const evaluationOptions = secondArgument as BreakpointEvaluationOptions | undefined
    return (targetValuePx: number): BreakpointEvaluationResult => {
        return evaluateBreakpointMapInternal(
            firstArgument as WidthBreakpointMap | HeightBreakpointMap,
            targetValuePx,
            evaluationOptions,
        )
    }
}

/**
 * Deterministic pure calculation of the complete BreakpointState structure from width and height.
 *
 * @param targetWidthPx - Width dimension in pixels.
 * @param targetHeightPx - Height dimension in pixels.
 * @param configuration - Observer configuration options.
 * @returns Fully computed BreakpointState snapshot.
 *
 * @example
 * ```ts
 * const state = computeBreakpointState(1024, 768)
 * console.log(state.primaryWidthBreakpoint) // 'expanded'
 * ```
 */
export function computeBreakpointState(
    targetWidthPx: number,
    targetHeightPx: number,
    configuration: BreakpointConfiguration = {},
): BreakpointState {
    const {
        widthBreakpoints = DEFAULT_WIDTH_BREAKPOINTS,
        heightBreakpoints = DEFAULT_HEIGHT_BREAKPOINTS,
        dimension = 'width',
        remBase = REM_BASE,
        emBase = EM_BASE,
    } = configuration

    let activeWidthBreakpoints: string[] = []
    let widthMatchesTable: Record<string, boolean> = {}
    let activeHeightBreakpoints: string[] = []
    let heightMatchesTable: Record<string, boolean> = {}

    if (dimension === 'width' || dimension === 'both') {
        const widthResult = evaluateBreakpointMapInternal(widthBreakpoints, targetWidthPx, { remBase, emBase })
        activeWidthBreakpoints = widthResult.activeBreakpoints
        widthMatchesTable = { ...widthResult.matchesTable }
    }
    if (dimension === 'height' || dimension === 'both') {
        const heightResult = evaluateBreakpointMapInternal(heightBreakpoints, targetHeightPx, { remBase, emBase })
        activeHeightBreakpoints = heightResult.activeBreakpoints
        heightMatchesTable = { ...heightResult.matchesTable }
    }
    if (dimension === 'width') {
        heightMatchesTable = {}
        activeHeightBreakpoints = []
    } else if (dimension === 'height') {
        widthMatchesTable = {}
        activeWidthBreakpoints = []
    }

    const hasMatches = activeWidthBreakpoints.length > 0 || activeHeightBreakpoints.length > 0
    const frozenActiveWidthBreakpoints = Object.freeze([...activeWidthBreakpoints]) as string[]
    const frozenActiveHeightBreakpoints = Object.freeze([...activeHeightBreakpoints]) as string[]
    const frozenWidthMatchesTable = Object.freeze({ ...widthMatchesTable })
    const frozenHeightMatchesTable = Object.freeze({ ...heightMatchesTable })
    const primaryWidth = activeWidthBreakpoints[0] ?? null
    const primaryHeight = activeHeightBreakpoints[0] ?? null

    return {
        width: targetWidthPx,
        height: targetHeightPx,
        activeWidthBreakpoints: frozenActiveWidthBreakpoints,
        activeHeightBreakpoints: frozenActiveHeightBreakpoints,
        widthMatches: frozenWidthMatchesTable,
        heightMatches: frozenHeightMatchesTable,
        matches: hasMatches,
        primaryWidthBreakpoint: primaryWidth,
        primaryHeightBreakpoint: primaryHeight,
    }
}

function formatTrimmedNumber(numericValue: number): string {
    const stringValue = numericValue.toFixed(4)
    return stringValue.replace(/\.?0+$/, '')
}

const INVALID_MEDIA_QUERY_UNITS = new Set(['%', 'ex', 'ch', 'cap', 'ic', 'lh', 'rlh'])

/**
 * Converts a condition string into a CSS media query expression.
 *
 * @param conditionString - The breakpoint condition string.
 * @param dimension - Target media dimension ('width' | 'height').
 * @param mediaQueryExclusiveStep - Step adjustment for exclusive > and < operators.
 * @returns CSS media query string or null if expression cannot be represented in standard media queries.
 *
 * @example
 * ```ts
 * convertConditionToMediaQuery('>= 600px', 'width', 0.05) // '(min-width: 600px)'
 * ```
 */
export function convertConditionToMediaQuery(
    conditionString: string,
    dimension: 'width' | 'height',
    mediaQueryExclusiveStep: number,
): string | null {
    try {
        const { operator, targetValue, unit } = parseBreakpointCondition(conditionString)
        const effectiveUnit = unit ?? 'px'
        if (INVALID_MEDIA_QUERY_UNITS.has(effectiveUnit)) {
            return null
        }
        const isPixelUnit = effectiveUnit === 'px'
        if (!isPixelUnit && (operator === '>' || operator === '<')) {
            return null
        }
        switch (operator) {
            case '>=':
                return `(min-${dimension}: ${formatTrimmedNumber(targetValue)}${effectiveUnit})`
            case '>':
                return `(min-${dimension}: ${formatTrimmedNumber(targetValue + mediaQueryExclusiveStep)}${effectiveUnit})`
            case '<=':
                return `(max-${dimension}: ${formatTrimmedNumber(targetValue)}${effectiveUnit})`
            case '<':
                return `(max-${dimension}: ${formatTrimmedNumber(Math.max(0, targetValue - mediaQueryExclusiveStep))}${effectiveUnit})`
            case '=':
            case '==':
                return `(${dimension}: ${formatTrimmedNumber(targetValue)}${effectiveUnit})`
            case '!=':
                return `not (${dimension}: ${formatTrimmedNumber(targetValue)}${effectiveUnit})`
            default:
                return null
        }
    } catch {
        return null
    }
}

/**
 * Converts a BreakpointDefinition into a CSS media query expression.
 *
 * @param breakpointDefinition - Breakpoint definition to translate.
 * @param dimension - Target media dimension ('width' | 'height').
 * @param mediaQueryExclusiveStep - Step adjustment for exclusive operators.
 * @returns Combined CSS media query string or null if unexpressible.
 *
 * @example
 * ```ts
 * convertDefinitionToMediaQuery({ and: ['>= 600px', '< 840px'] }, 'width', 0.05)
 * // '(min-width: 600px) and (max-width: 839.95px)'
 * ```
 */
export function convertDefinitionToMediaQuery(
    breakpointDefinition: BreakpointDefinition,
    dimension: 'width' | 'height',
    mediaQueryExclusiveStep: number,
): string | null {
    if (typeof breakpointDefinition === 'string') {
        return convertConditionToMediaQuery(breakpointDefinition, dimension, mediaQueryExclusiveStep)
    }
    if (isBreakpointRange(breakpointDefinition)) {
        const { min, max, eq, ne, minInclusive, maxInclusive } = breakpointDefinition
        if (min === undefined && max === undefined && eq === undefined && ne === undefined) {
            return null
        }
        const queryParts: string[] = []
        if (min !== undefined) {
            const minValue = minInclusive === false ? min + mediaQueryExclusiveStep : min
            queryParts.push(`(min-${dimension}: ${formatTrimmedNumber(minValue)}px)`)
        }
        if (max !== undefined) {
            const maxValue = maxInclusive === true ? max : Math.max(0, max - mediaQueryExclusiveStep)
            queryParts.push(`(max-${dimension}: ${formatTrimmedNumber(maxValue)}px)`)
        }
        if (eq !== undefined) {
            queryParts.push(`(${dimension}: ${formatTrimmedNumber(eq)}px)`)
        }
        if (ne !== undefined) {
            queryParts.push(`not (${dimension}: ${formatTrimmedNumber(ne)}px)`)
        }
        return queryParts.length > 0 ? queryParts.join(' and ') : null
    }
    if (typeof breakpointDefinition === 'object' && breakpointDefinition !== null) {
        if ('and' in breakpointDefinition) {
            const conditionArray = (breakpointDefinition as { and: BreakpointCondition[] }).and
            if (!Array.isArray(conditionArray) || conditionArray.length === 0) {
                return null
            }
            const queryParts = conditionArray.map((condition) =>
                convertConditionToMediaQuery(condition, dimension, mediaQueryExclusiveStep),
            )
            if (queryParts.some((part) => part === null)) {
                return null
            }
            return (queryParts as string[]).join(' and ')
        }
        if ('or' in breakpointDefinition) {
            const conditionArray = (breakpointDefinition as { or: BreakpointCondition[] }).or
            if (!Array.isArray(conditionArray) || conditionArray.length === 0) {
                return null
            }
            const queryParts = conditionArray.map((condition) =>
                convertConditionToMediaQuery(condition, dimension, mediaQueryExclusiveStep),
            )
            if (queryParts.some((part) => part === null)) {
                return null
            }
            return (queryParts as string[]).join(', ')
        }
    }
    return null
}

function statesEqual(firstState: BreakpointState, secondState: BreakpointState): boolean {
    return (
        firstState.width === secondState.width &&
        firstState.height === secondState.height &&
        firstState.matches === secondState.matches &&
        firstState.primaryWidthBreakpoint === secondState.primaryWidthBreakpoint &&
        firstState.primaryHeightBreakpoint === secondState.primaryHeightBreakpoint &&
        isShallowEqualArray(firstState.activeWidthBreakpoints, secondState.activeWidthBreakpoints) &&
        isShallowEqualArray(firstState.activeHeightBreakpoints, secondState.activeHeightBreakpoints) &&
        isShallowEqualRecord(firstState.widthMatches, secondState.widthMatches) &&
        isShallowEqualRecord(firstState.heightMatches, secondState.heightMatches)
    )
}

/**
 * Functional interface for interacting with an active breakpoint observer session.
 *
 * @example
 * ```ts
 * const observer: BreakpointObserverInstance = createBreakpointObserver()
 * observer.state$.subscribe(state => console.log(state.primaryWidthBreakpoint))
 * observer.dispose()
 * ```
 */
export interface BreakpointObserverInstance {
    readonly state$: Observable<BreakpointState>
    readonly activeWidthBreakpoints$: Observable<string[]>
    readonly activeHeightBreakpoints$: Observable<string[]>
    readonly snapshot: BreakpointState
    readonly isDisposed: boolean
    getState(): BreakpointState
    getAttachedElement(): HTMLElement | null
    readonly attachedElement: HTMLElement | null
    getPrimaryWidthBreakpoint(): string | null
    getPrimaryHeightBreakpoint(): string | null
    hasWidthBreakpoint(breakpointKey: string): boolean
    hasHeightBreakpoint(breakpointKey: string): boolean
    hasBreakpoint(breakpointKey: string, dimension?: BreakpointDimension): boolean
    matchesWidthBreakpoint(breakpointDefinition: BreakpointDefinition): boolean
    matchesHeightBreakpoint(breakpointDefinition: BreakpointDefinition): boolean
    matchesBreakpoint(breakpointDefinition: BreakpointDefinition, dimension?: BreakpointDimension): boolean
    subscribeWidthBreakpoint(
        breakpointDefinition: BreakpointDefinition,
        listenerCallback: (breakpointState: BreakpointState) => void,
    ): () => void
    subscribeHeightBreakpoint(
        breakpointDefinition: BreakpointDefinition,
        listenerCallback: (breakpointState: BreakpointState) => void,
    ): () => void
    subscribeBreakpoint(
        breakpointDefinition: BreakpointDefinition,
        listenerCallback: (breakpointState: BreakpointState) => void,
    ): () => void
    subscribeBreakpoint(
        breakpointDefinition: BreakpointDefinition,
        dimension: BreakpointDimension,
        listenerCallback: (breakpointState: BreakpointState) => void,
    ): () => void
    watchWidthBreakpoint(breakpointDefinition: BreakpointDefinition): Observable<boolean>
    watchHeightBreakpoint(breakpointDefinition: BreakpointDefinition): Observable<boolean>
    watchBreakpoint(breakpointDefinition: BreakpointDefinition, dimension?: BreakpointDimension): Observable<boolean>
    attachElement(targetElement: HTMLElement | null): void
    detachElement(): void
    dispose(): void
}

/**
 * Creates a pure functional breakpoint observer instance managing viewport or element reactive state.
 *
 * @param configuration - Breakpoint configuration options.
 * @returns BreakpointObserverInstance object with streams, snapshot getters, and subscription helpers.
 *
 * @example
 * ```ts
 * const observer = createBreakpointObserver({
 *     widthBreakpoints: { compact: '< 600px', expanded: '>= 600px' }
 * })
 * observer.state$.subscribe(state => console.log(state.primaryWidth))
 * observer.dispose()
 * ```
 */
export function createBreakpointObserver(
    configuration: BreakpointConfiguration = {},
): BreakpointObserverInstance {
    const currentConfiguration: Required<BreakpointConfiguration> = {
        widthBreakpoints: configuration.widthBreakpoints ?? DEFAULT_WIDTH_BREAKPOINTS,
        heightBreakpoints: configuration.heightBreakpoints ?? DEFAULT_HEIGHT_BREAKPOINTS,
        dimension: configuration.dimension ?? 'width',
        element: configuration.element ?? null,
        defaultWidthMatches: configuration.defaultWidthMatches ?? {},
        defaultHeightMatches: configuration.defaultHeightMatches ?? {},
        mediaQueryExclusiveStep: configuration.mediaQueryExclusiveStep ?? 0.05,
        remBase: configuration.remBase ?? REM_BASE,
        emBase: configuration.emBase ?? EM_BASE,
    }

    let attachedElement: HTMLElement | null = configuration.element ?? null
    let isDisposed = false
    let animationFrameId: number | null = null

    const mediaQueryMap = new Map<
        string,
        { mediaQueryList: MediaQueryList, changeListener: () => void, mediaQueryString: string }
    >()
    let viewportResizeListener: (() => void) | null = null
    let elementResizeListener: (() => void) | null = null
    let resizeObserver: ResizeObserver | null = null
    let observedElement: HTMLElement | null = null
    let lastContentRectangle: { width: number, height: number } | null = null

    function computeInitialState(): BreakpointState {
        const {
            widthBreakpoints,
            heightBreakpoints,
            dimension,
            defaultWidthMatches,
            defaultHeightMatches,
            remBase,
            emBase,
        } = currentConfiguration

        if (isServer()) {
            let widthMatchesTable: Record<string, boolean> = {}
            let activeWidthBreakpoints: string[] = []
            let heightMatchesTable: Record<string, boolean> = {}
            let activeHeightBreakpoints: string[] = []

            if (dimension === 'width' || dimension === 'both') {
                if (configuration.defaultWidthMatches) {
                    widthMatchesTable = { ...defaultWidthMatches }
                    for (const key of Object.keys(widthBreakpoints)) {
                        if (!(key in widthMatchesTable)) {
                            widthMatchesTable[key] = false
                        }
                    }
                    activeWidthBreakpoints = Object.entries(widthMatchesTable)
                        .filter(([, isMatched]) => isMatched)
                        .map(([key]) => key)
                } else {
                    widthMatchesTable = Object.fromEntries(Object.keys(widthBreakpoints).map((key) => [key, false]))
                    activeWidthBreakpoints = []
                }
            }
            if (dimension === 'height' || dimension === 'both') {
                if (configuration.defaultHeightMatches) {
                    heightMatchesTable = { ...defaultHeightMatches }
                    for (const key of Object.keys(heightBreakpoints)) {
                        if (!(key in heightMatchesTable)) {
                            heightMatchesTable[key] = false
                        }
                    }
                    activeHeightBreakpoints = Object.entries(heightMatchesTable)
                        .filter(([, isMatched]) => isMatched)
                        .map(([key]) => key)
                } else {
                    heightMatchesTable = Object.fromEntries(Object.keys(heightBreakpoints).map((key) => [key, false]))
                    activeHeightBreakpoints = []
                }
            }
            if (dimension === 'width') {
                heightMatchesTable = {}
                activeHeightBreakpoints = []
            } else if (dimension === 'height') {
                widthMatchesTable = {}
                activeWidthBreakpoints = []
            }

            const hasMatches = activeWidthBreakpoints.length > 0 || activeHeightBreakpoints.length > 0
            const frozenActiveWidth = Object.freeze([...activeWidthBreakpoints]) as string[]
            const frozenActiveHeight = Object.freeze([...activeHeightBreakpoints]) as string[]
            const frozenWidthTable = Object.freeze({ ...widthMatchesTable })
            const frozenHeightTable = Object.freeze({ ...heightMatchesTable })

            return {
                width: 0,
                height: 0,
                activeWidthBreakpoints: frozenActiveWidth,
                activeHeightBreakpoints: frozenActiveHeight,
                widthMatches: frozenWidthTable,
                heightMatches: frozenHeightTable,
                matches: hasMatches,
                primaryWidthBreakpoint: activeWidthBreakpoints[0] ?? null,
                primaryHeightBreakpoint: activeHeightBreakpoints[0] ?? null,
            }
        }

        let targetWidth = 0
        let targetHeight = 0

        if (attachedElement) {
            try {
                const boundingClientRect = attachedElement.getBoundingClientRect()
                targetWidth = boundingClientRect.width
                targetHeight = boundingClientRect.height
                if (targetWidth === 0 && (attachedElement as HTMLElement & { offsetWidth?: number }).offsetWidth) {
                    targetWidth = (attachedElement as HTMLElement & { offsetWidth?: number }).offsetWidth ?? 0
                }
                if (targetHeight === 0 && (attachedElement as HTMLElement & { offsetHeight?: number }).offsetHeight) {
                    targetHeight = (attachedElement as HTMLElement & { offsetHeight?: number }).offsetHeight ?? 0
                }
            } catch {
                targetWidth = 0
                targetHeight = 0
            }
        } else {
            const currentWindow = getWindow()
            targetWidth = currentWindow ? currentWindow.innerWidth : 0
            targetHeight = currentWindow ? currentWindow.innerHeight : 0
        }

        return computeBreakpointState(targetWidth, targetHeight, {
            widthBreakpoints,
            heightBreakpoints,
            dimension,
            remBase,
            emBase,
        })
    }

    const stateSubject = new BehaviorSubject<BreakpointState>(computeInitialState())

    const state$: Observable<BreakpointState> = stateSubject.asObservable()

    const activeWidthBreakpoints$: Observable<string[]> = state$.pipe(
        map((currentState) => currentState.activeWidthBreakpoints),
        distinctUntilChanged(isShallowEqualArray),
        shareReplay({ bufferSize: 1, refCount: true }),
    )

    const activeHeightBreakpoints$: Observable<string[]> = state$.pipe(
        map((currentState) => currentState.activeHeightBreakpoints),
        distinctUntilChanged(isShallowEqualArray),
        shareReplay({ bufferSize: 1, refCount: true }),
    )

    function recomputeState(): BreakpointState {
        const { widthBreakpoints, heightBreakpoints, dimension, remBase, emBase } = currentConfiguration
        let targetWidth = stateSubject.getValue().width
        let targetHeight = stateSubject.getValue().height

        if (attachedElement) {
            if (lastContentRectangle) {
                targetWidth = lastContentRectangle.width
                targetHeight = lastContentRectangle.height
            } else {
                const elementToMeasure = observedElement ?? attachedElement
                if (elementToMeasure) {
                    try {
                        const boundingClientRect = elementToMeasure.getBoundingClientRect()
                        targetWidth = boundingClientRect.width
                        targetHeight = boundingClientRect.height
                        if (targetWidth === 0 && (elementToMeasure as HTMLElement & { offsetWidth?: number }).offsetWidth) {
                            targetWidth = (elementToMeasure as HTMLElement & { offsetWidth?: number }).offsetWidth ?? targetWidth
                        }
                        if (targetHeight === 0 && (elementToMeasure as HTMLElement & { offsetHeight?: number }).offsetHeight) {
                            targetHeight = (elementToMeasure as HTMLElement & { offsetHeight?: number }).offsetHeight ?? targetHeight
                        }
                    } catch {
                        // ignore error from detached or inaccessible DOM node
                    }
                }
            }
        } else {
            const currentWindow = getWindow()
            targetWidth = currentWindow ? currentWindow.innerWidth : targetWidth
            targetHeight = currentWindow ? currentWindow.innerHeight : targetHeight
        }

        return computeBreakpointState(targetWidth, targetHeight, {
            widthBreakpoints,
            heightBreakpoints,
            dimension,
            remBase,
            emBase,
        })
    }

    function requestFrame(callback: () => void): number {
        const currentWindow = getWindow()
        if (currentWindow && canUseRequestAnimationFrame()) {
            return currentWindow.requestAnimationFrame(callback)
        }
        return setTimeout(callback, 16) as unknown as number
    }

    function cancelFrame(frameId: number): void {
        const currentWindow = getWindow()
        if (currentWindow && typeof currentWindow.cancelAnimationFrame === 'function') {
            currentWindow.cancelAnimationFrame(frameId)
            return
        }
        clearTimeout(frameId)
    }

    function scheduleEmission(): void {
        if (isDisposed || animationFrameId !== null) {
            return
        }
        animationFrameId = requestFrame(() => {
            animationFrameId = null
            if (isDisposed) {
                return
            }
            const nextComputedState = recomputeState()
            const previousState = stateSubject.getValue()
            if (!statesEqual(previousState, nextComputedState)) {
                stateSubject.next(nextComputedState)
            }
        })
    }

    function scheduleEmissionImmediate(): void {
        if (isDisposed) {
            return
        }
        if (animationFrameId !== null) {
            cancelFrame(animationFrameId)
            animationFrameId = null
        }
        const nextComputedState = recomputeState()
        const previousState = stateSubject.getValue()
        if (!statesEqual(previousState, nextComputedState)) {
            stateSubject.next(nextComputedState)
        }
    }

    function initViewportStrategy(): void {
        teardownViewportStrategy()
        if (isServer()) {
            return
        }
        const { widthBreakpoints, heightBreakpoints, dimension, mediaQueryExclusiveStep } = currentConfiguration
        const dimensionMapList: Array<{
            breakpointMap: WidthBreakpointMap | HeightBreakpointMap
            dimension: 'width' | 'height'
        }> = []

        if (dimension === 'width' || dimension === 'both') {
            dimensionMapList.push({ breakpointMap: widthBreakpoints, dimension: 'width' })
        }
        if (dimension === 'height' || dimension === 'both') {
            dimensionMapList.push({ breakpointMap: heightBreakpoints, dimension: 'height' })
        }

        const hasMatchMediaSupport = canUseMatchMedia()
        let hasMediaQueryListeners = false
        let hasResizeFallback = false

        for (const { breakpointMap: currentMap, dimension: currentDimension } of dimensionMapList) {
            for (const [breakpointKey, breakpointDefinition] of Object.entries(currentMap)) {
                const mediaQueryString = convertDefinitionToMediaQuery(
                    breakpointDefinition,
                    currentDimension,
                    mediaQueryExclusiveStep,
                )
                const cacheKey = `${currentDimension}:${breakpointKey}`
                if (mediaQueryString !== null && hasMatchMediaSupport) {
                    const currentWindow = getWindow()!
                    const mediaQueryList = currentWindow.matchMedia(mediaQueryString)
                    const changeListener = (): void => scheduleEmission()
                    if (typeof mediaQueryList.addEventListener === 'function') {
                        mediaQueryList.addEventListener('change', changeListener)
                    } else {
                        // @ts-ignore legacy API fallback
                        mediaQueryList.addListener(changeListener)
                    }
                    mediaQueryMap.set(cacheKey, { mediaQueryList, changeListener, mediaQueryString })
                    hasMediaQueryListeners = true
                } else {
                    hasResizeFallback = true
                }
            }
        }

        if (hasMediaQueryListeners || hasResizeFallback) {
            const resizeListener = (): void => scheduleEmission()
            viewportResizeListener = resizeListener
            getWindow()?.addEventListener('resize', resizeListener)
        }
    }

    function teardownViewportStrategy(): void {
        for (const [, entry] of mediaQueryMap) {
            const { mediaQueryList, changeListener } = entry
            try {
                if (typeof mediaQueryList.removeEventListener === 'function') {
                    mediaQueryList.removeEventListener('change', changeListener)
                } else {
                    // @ts-ignore legacy API fallback
                    mediaQueryList.removeListener(changeListener)
                }
            } catch {
                // ignore teardown error
            }
        }
        mediaQueryMap.clear()
        if (viewportResizeListener) {
            try {
                getWindow()?.removeEventListener('resize', viewportResizeListener)
            } catch {
                // ignore
            }
            viewportResizeListener = null
        }
    }

    function initElementStrategy(): void {
        teardownElementStrategy()
        if (isServer() || !attachedElement) {
            return
        }
        let ResizeObserverConstructor: typeof ResizeObserver | undefined
        if (canUseResizeObserver()) {
            ResizeObserverConstructor = (
                getWindow() as unknown as { ResizeObserver?: typeof ResizeObserver }
            )?.ResizeObserver
        }
        if (!ResizeObserverConstructor) {
            const fallbackListener = (): void => scheduleEmission()
            elementResizeListener = fallbackListener
            getWindow()?.addEventListener('resize', fallbackListener)
            return
        }
        const createdResizeObserver = new ResizeObserverConstructor((entries) => {
            const firstEntry = entries[0] as unknown as { contentRect?: DOMRectReadOnly } | undefined
            if (firstEntry && firstEntry.contentRect) {
                const contentRect = firstEntry.contentRect
                lastContentRectangle = { width: contentRect.width, height: contentRect.height }
            } else {
                lastContentRectangle = null
            }
            scheduleEmission()
        })
        try {
            createdResizeObserver.observe(attachedElement)
        } catch {
            // ignore observation error
        }
        resizeObserver = createdResizeObserver
        observedElement = attachedElement
    }

    function teardownElementStrategy(): void {
        if (resizeObserver) {
            try {
                if (observedElement) {
                    resizeObserver.unobserve(observedElement)
                }
            } catch {
                // ignore
            }
            try {
                resizeObserver.disconnect()
            } catch {
                // ignore
            }
            resizeObserver = null
            observedElement = null
        }
        lastContentRectangle = null
        if (elementResizeListener) {
            try {
                getWindow()?.removeEventListener('resize', elementResizeListener)
            } catch {
                // ignore
            }
            elementResizeListener = null
        }
    }

    function initActiveStrategy(): void {
        if (attachedElement) {
            initElementStrategy()
        } else {
            initViewportStrategy()
        }
    }

    function teardownActiveStrategy(): void {
        teardownViewportStrategy()
        teardownElementStrategy()
        if (animationFrameId !== null) {
            cancelFrame(animationFrameId)
            animationFrameId = null
        }
    }

    if (!isServer()) {
        initActiveStrategy()
    }

    function hasWidthBreakpoint(breakpointKey: string): boolean {
        return !!stateSubject.getValue().widthMatches[breakpointKey]
    }

    function hasHeightBreakpoint(breakpointKey: string): boolean {
        return !!stateSubject.getValue().heightMatches[breakpointKey]
    }

    function hasBreakpoint(breakpointKey: string, dimension: BreakpointDimension = 'width'): boolean {
        const snapshot = stateSubject.getValue()
        if (dimension === 'both') {
            return !!(snapshot.widthMatches[breakpointKey] || snapshot.heightMatches[breakpointKey])
        }
        if (dimension === 'width') {
            return !!snapshot.widthMatches[breakpointKey]
        }
        return !!snapshot.heightMatches[breakpointKey]
    }

    function matchesWidthBreakpoint(breakpointDefinition: BreakpointDefinition): boolean {
        const remBase = currentConfiguration.remBase ?? REM_BASE
        const emBase = currentConfiguration.emBase ?? EM_BASE
        return evaluateMatchesDefinition(breakpointDefinition, stateSubject.getValue().width, { remBase, emBase })
    }

    function matchesHeightBreakpoint(breakpointDefinition: BreakpointDefinition): boolean {
        const remBase = currentConfiguration.remBase ?? REM_BASE
        const emBase = currentConfiguration.emBase ?? EM_BASE
        return evaluateMatchesDefinition(breakpointDefinition, stateSubject.getValue().height, { remBase, emBase })
    }

    function matchesBreakpoint(
        breakpointDefinition: BreakpointDefinition,
        dimension: BreakpointDimension = 'width',
    ): boolean {
        const remBase = currentConfiguration.remBase ?? REM_BASE
        const emBase = currentConfiguration.emBase ?? EM_BASE
        const snapshot = stateSubject.getValue()
        if (dimension === 'both') {
            return (
                evaluateMatchesDefinition(breakpointDefinition, snapshot.width, { remBase, emBase }) ||
                evaluateMatchesDefinition(breakpointDefinition, snapshot.height, { remBase, emBase })
            )
        }
        const targetPixel = dimension === 'height' ? snapshot.height : snapshot.width
        return evaluateMatchesDefinition(breakpointDefinition, targetPixel, { remBase, emBase })
    }

    function subscribeBreakpoint(
        breakpointDefinition: BreakpointDefinition,
        dimensionOrCallback: BreakpointDimension | ((breakpointState: BreakpointState) => void),
        listenerCallback?: (breakpointState: BreakpointState) => void,
    ): () => void {
        let targetDimension: BreakpointDimension = 'width'
        let actualCallback: (breakpointState: BreakpointState) => void

        if (typeof dimensionOrCallback === 'function') {
            actualCallback = dimensionOrCallback
            targetDimension = 'width'
        } else {
            targetDimension = dimensionOrCallback ?? 'width'
            actualCallback = listenerCallback!
        }

        const remBase = currentConfiguration.remBase ?? REM_BASE
        const emBase = currentConfiguration.emBase ?? EM_BASE
        const testMatches = (targetState: BreakpointState): boolean => {
            if (targetDimension === 'both') {
                return (
                    evaluateMatchesDefinition(breakpointDefinition, targetState.width, { remBase, emBase }) ||
                    evaluateMatchesDefinition(breakpointDefinition, targetState.height, { remBase, emBase })
                )
            }
            const targetPixel = targetDimension === 'height' ? targetState.height : targetState.width
            return evaluateMatchesDefinition(breakpointDefinition, targetPixel, { remBase, emBase })
        }
        const subscription = state$.pipe(
            distinctUntilChanged(
                (previousState, currentState) => testMatches(previousState) === testMatches(currentState),
            ),
        ).subscribe(actualCallback)
        return () => subscription.unsubscribe()
    }

    function watchBreakpoint(
        breakpointDefinition: BreakpointDefinition,
        dimension: BreakpointDimension = 'width',
    ): Observable<boolean> {
        const remBase = currentConfiguration.remBase ?? REM_BASE
        const emBase = currentConfiguration.emBase ?? EM_BASE
        return state$.pipe(
            map((currentState) => {
                if (dimension === 'both') {
                    return (
                        evaluateMatchesDefinition(breakpointDefinition, currentState.width, { remBase, emBase }) ||
                        evaluateMatchesDefinition(breakpointDefinition, currentState.height, { remBase, emBase })
                    )
                }
                const targetPixel = dimension === 'height' ? currentState.height : currentState.width
                return evaluateMatchesDefinition(breakpointDefinition, targetPixel, { remBase, emBase })
            }),
            distinctUntilChanged(),
        )
    }

    function attachElement(targetElement: HTMLElement | null): void {
        if (isDisposed || targetElement === attachedElement) {
            return
        }
        teardownActiveStrategy()
        attachedElement = targetElement
        currentConfiguration.element = targetElement
        scheduleEmissionImmediate()
        if (!isServer()) {
            initActiveStrategy()
        }
    }

    function detachElement(): void {
        attachElement(null)
    }

    function dispose(): void {
        if (isDisposed) {
            return
        }
        isDisposed = true
        teardownActiveStrategy()
        attachedElement = null
        currentConfiguration.element = null
        try {
            stateSubject.complete()
        } catch {
            // ignore
        }
    }

    const observerInstance: BreakpointObserverInstance = {
        state$,
        activeWidthBreakpoints$,
        activeHeightBreakpoints$,
        get snapshot(): BreakpointState {
            return stateSubject.getValue()
        },
        get isDisposed(): boolean {
            return isDisposed
        },
        getState(): BreakpointState {
            return stateSubject.getValue()
        },
        getAttachedElement(): HTMLElement | null {
            return attachedElement
        },
        get attachedElement(): HTMLElement | null {
            return attachedElement
        },
        getPrimaryWidthBreakpoint(): string | null {
            return stateSubject.getValue().primaryWidthBreakpoint
        },
        getPrimaryHeightBreakpoint(): string | null {
            return stateSubject.getValue().primaryHeightBreakpoint
        },
        hasWidthBreakpoint,
        hasHeightBreakpoint,
        hasBreakpoint,
        matchesWidthBreakpoint,
        matchesHeightBreakpoint,
        matchesBreakpoint,
        subscribeWidthBreakpoint: (
            breakpointDefinition: BreakpointDefinition,
            listenerCallback: (breakpointState: BreakpointState) => void,
        ) => subscribeBreakpoint(breakpointDefinition, 'width', listenerCallback),
        subscribeHeightBreakpoint: (
            breakpointDefinition: BreakpointDefinition,
            listenerCallback: (breakpointState: BreakpointState) => void,
        ) => subscribeBreakpoint(breakpointDefinition, 'height', listenerCallback),
        subscribeBreakpoint,
        watchWidthBreakpoint: (breakpointDefinition: BreakpointDefinition) =>
            watchBreakpoint(breakpointDefinition, 'width'),
        watchHeightBreakpoint: (breakpointDefinition: BreakpointDefinition) =>
            watchBreakpoint(breakpointDefinition, 'height'),
        watchBreakpoint,
        attachElement,
        detachElement,
        dispose,
        // @ts-ignore internal test emission triggers
        _scheduleEmit: scheduleEmission,
        // @ts-ignore internal test emission triggers
        _scheduleEmitImmediate: scheduleEmissionImmediate,
        // @ts-ignore internal test getters
        get _rafId() {
            return animationFrameId
        },
        // @ts-ignore internal test getters
        get _viewportResizeHandler() {
            return viewportResizeListener
        },
        // @ts-ignore internal test getters
        get _elementResizeHandler() {
            return elementResizeListener
        },
        // @ts-ignore internal test getters
        get _disposed() {
            return isDisposed
        },
        // @ts-ignore internal test method
        _teardownStrategy: teardownActiveStrategy,
    }

    return observerInstance
}

let defaultViewportObserverInstance: BreakpointObserverInstance | null = null

/**
 * Accesses or lazily creates a shared singleton viewport breakpoint observer instance.
 *
 * @returns The singleton BreakpointObserverInstance configured for viewport observation.
 *
 * @example
 * ```ts
 * const observer = getDefaultViewportObserver()
 * console.log(observer.snapshot.primaryWidthBreakpoint)
 * ```
 */
export function getDefaultViewportObserver(): BreakpointObserverInstance {
    if (isServer()) {
        return createBreakpointObserver()
    }
    if (!defaultViewportObserverInstance || defaultViewportObserverInstance.isDisposed) {
        defaultViewportObserverInstance = createBreakpointObserver()
    }
    return defaultViewportObserverInstance
}

/**
 * Creates a cold reactive stream of BreakpointState snapshots, encapsulating observer lifecycle per subscription.
 * Zero side-effects occur until subscribed; tears down listeners upon unsubscription.
 *
 * @param configuration - Breakpoint configuration options.
 * @returns Observable stream emitting BreakpointState on changes.
 *
 * @example
 * ```ts
 * const state$ = observeBreakpointState()
 * const sub = state$.subscribe(state => console.log(state.width))
 * sub.unsubscribe() // automatically cleans up DOM / matchMedia listeners
 * ```
 */
export function observeBreakpointState(
    configuration: BreakpointConfiguration = {},
): Observable<BreakpointState> {
    return new Observable<BreakpointState>((subscriber) => {
        const observerInstance = createBreakpointObserver(configuration)
        const subscription = observerInstance.state$.subscribe(subscriber)
        return () => {
            subscription.unsubscribe()
            observerInstance.dispose()
        }
    })
}

/**
 * Standalone stream factory returning an Observable<boolean> testing if a definition matches.
 *
 * @param breakpointDefinition - Breakpoint definition to match.
 * @param configuration - Configuration options.
 * @returns Observable stream of boolean match values.
 *
 * @example
 * ```ts
 * const isExpanded$ = observeBreakpoint({ and: ['>= 840px', '< 1200px'] })
 * isExpanded$.subscribe(matches => console.log('Expanded:', matches))
 * ```
 */
export function observeBreakpoint(
    breakpointDefinition: BreakpointDefinition,
    configuration?: BreakpointConfiguration,
): Observable<boolean>
export function observeBreakpoint(
    breakpointDefinition: BreakpointDefinition,
    dimension: BreakpointDimension,
    configuration?: BreakpointConfiguration,
): Observable<boolean>
export function observeBreakpoint(
    breakpointDefinition: BreakpointDefinition,
    dimensionOrConfiguration?: BreakpointDimension | BreakpointConfiguration,
    configuration?: BreakpointConfiguration,
): Observable<boolean> {
    let targetDimension: BreakpointDimension = 'width'
    let effectiveConfiguration: BreakpointConfiguration = {}

    if (typeof dimensionOrConfiguration === 'string') {
        targetDimension = dimensionOrConfiguration
        effectiveConfiguration = {
            ...(configuration ?? {}),
            dimension: configuration?.dimension ?? targetDimension,
        }
    } else if (typeof dimensionOrConfiguration === 'object' && dimensionOrConfiguration !== null) {
        effectiveConfiguration = dimensionOrConfiguration
        targetDimension = effectiveConfiguration.dimension ?? 'width'
    } else if (configuration) {
        effectiveConfiguration = configuration
        targetDimension = effectiveConfiguration.dimension ?? 'width'
    } else {
        effectiveConfiguration = { dimension: 'width' }
        targetDimension = 'width'
    }

    const remBase = effectiveConfiguration.remBase ?? REM_BASE
    const emBase = effectiveConfiguration.emBase ?? EM_BASE

    return observeBreakpointState(effectiveConfiguration).pipe(
        map((state) => {
            if (targetDimension === 'both') {
                return (
                    evaluateMatchesDefinition(breakpointDefinition, state.width, { remBase, emBase }) ||
                    evaluateMatchesDefinition(breakpointDefinition, state.height, { remBase, emBase })
                )
            }
            const targetPixel = targetDimension === 'height' ? state.height : state.width
            return evaluateMatchesDefinition(breakpointDefinition, targetPixel, { remBase, emBase })
        }),
        distinctUntilChanged(),
    )
}

/**
 * Creates an Observable<boolean> observing a width breakpoint definition.
 *
 * @param breakpointDefinition - Breakpoint definition to match against width.
 * @param configuration - Optional configuration options.
 * @returns Observable stream of boolean match values.
 *
 * @example
 * ```ts
 * const isMedium$ = observeWidthBreakpoint('>= 600px')
 * isMedium$.subscribe(matches => console.log('Medium width:', matches))
 * ```
 */
export function observeWidthBreakpoint(
    breakpointDefinition: BreakpointDefinition,
    configuration?: BreakpointConfiguration,
): Observable<boolean> {
    const providedConfiguration = configuration ?? {}
    const effectiveConfiguration: BreakpointConfiguration = {
        ...providedConfiguration,
        dimension: providedConfiguration.dimension ?? 'width',
    }
    const remBase = effectiveConfiguration.remBase ?? REM_BASE
    const emBase = effectiveConfiguration.emBase ?? EM_BASE
    return observeBreakpointState(effectiveConfiguration).pipe(
        map((state) => evaluateMatchesDefinition(breakpointDefinition, state.width, { remBase, emBase })),
        distinctUntilChanged(),
    )
}

/**
 * Creates an Observable<boolean> observing a height breakpoint definition.
 *
 * @param breakpointDefinition - Breakpoint definition to match against height.
 * @param configuration - Optional configuration options.
 * @returns Observable stream of boolean match values.
 *
 * @example
 * ```ts
 * const isTall$ = observeHeightBreakpoint('>= 900px')
 * isTall$.subscribe(matches => console.log('Tall height:', matches))
 * ```
 */
export function observeHeightBreakpoint(
    breakpointDefinition: BreakpointDefinition,
    configuration?: BreakpointConfiguration,
): Observable<boolean> {
    const providedConfiguration = configuration ?? {}
    const effectiveConfiguration: BreakpointConfiguration = {
        ...providedConfiguration,
        dimension: providedConfiguration.dimension ?? 'height',
    }
    const remBase = effectiveConfiguration.remBase ?? REM_BASE
    const emBase = effectiveConfiguration.emBase ?? EM_BASE
    return observeBreakpointState(effectiveConfiguration).pipe(
        map((state) => evaluateMatchesDefinition(breakpointDefinition, state.height, { remBase, emBase })),
        distinctUntilChanged(),
    )
}

/**
 * Creates an Observable stream of active width breakpoint keys.
 *
 * @param configuration - Optional configuration options.
 * @returns Observable stream emitting arrays of active width breakpoint names.
 *
 * @example
 * ```ts
 * const activeWidth$ = observeActiveWidthBreakpoints()
 * activeWidth$.subscribe(activeKeys => console.log('Active width keys:', activeKeys))
 * ```
 */
export function observeActiveWidthBreakpoints(
    configuration: BreakpointConfiguration = {},
): Observable<string[]> {
    const effectiveConfiguration: BreakpointConfiguration = {
        ...configuration,
        dimension: configuration.dimension ?? 'width',
    }
    return observeBreakpointState(effectiveConfiguration).pipe(
        map((state) => state.activeWidthBreakpoints),
        distinctUntilChanged(isShallowEqualArray),
    )
}

/**
 * Creates an Observable stream of active height breakpoint keys.
 *
 * @param configuration - Optional configuration options.
 * @returns Observable stream emitting arrays of active height breakpoint names.
 *
 * @example
 * ```ts
 * const activeHeight$ = observeActiveHeightBreakpoints()
 * activeHeight$.subscribe(activeKeys => console.log('Active height keys:', activeKeys))
 * ```
 */
export function observeActiveHeightBreakpoints(
    configuration: BreakpointConfiguration = {},
): Observable<string[]> {
    const effectiveConfiguration: BreakpointConfiguration = {
        ...configuration,
        dimension: configuration.dimension ?? 'height',
    }
    return observeBreakpointState(effectiveConfiguration).pipe(
        map((state) => state.activeHeightBreakpoints),
        distinctUntilChanged(isShallowEqualArray),
    )
}

/**
 * Creates an Observable stream of active breakpoint keys for the specified dimension.
 *
 * @param configuration - Optional configuration options.
 * @returns Observable stream emitting active breakpoint key names.
 *
 * @example
 * ```ts
 * const active$ = observeActiveBreakpoints('both')
 * active$.subscribe(keys => console.log('Active keys:', keys))
 * ```
 */
export function observeActiveBreakpoints(
    configuration?: BreakpointConfiguration,
): Observable<string[]>
export function observeActiveBreakpoints(
    dimension: BreakpointDimension,
    configuration?: BreakpointConfiguration,
): Observable<string[]>
export function observeActiveBreakpoints(
    dimensionOrConfiguration?: BreakpointDimension | BreakpointConfiguration,
    configuration?: BreakpointConfiguration,
): Observable<string[]> {
    let targetDimension: BreakpointDimension = 'width'
    let effectiveConfiguration: BreakpointConfiguration = {}

    if (typeof dimensionOrConfiguration === 'string') {
        targetDimension = dimensionOrConfiguration
        effectiveConfiguration = {
            ...(configuration ?? {}),
            dimension: configuration?.dimension ?? targetDimension,
        }
    } else if (typeof dimensionOrConfiguration === 'object' && dimensionOrConfiguration !== null) {
        effectiveConfiguration = dimensionOrConfiguration
        targetDimension = effectiveConfiguration.dimension ?? 'width'
    } else if (configuration) {
        effectiveConfiguration = configuration
        targetDimension = effectiveConfiguration.dimension ?? 'width'
    } else {
        effectiveConfiguration = { dimension: 'width' }
        targetDimension = 'width'
    }

    return observeBreakpointState(effectiveConfiguration).pipe(
        map((state) => {
            if (targetDimension === 'both') {
                return [...state.activeWidthBreakpoints, ...state.activeHeightBreakpoints]
            }
            if (targetDimension === 'height') {
                return state.activeHeightBreakpoints
            }
            return state.activeWidthBreakpoints
        }),
        distinctUntilChanged(isShallowEqualArray),
    )
}
