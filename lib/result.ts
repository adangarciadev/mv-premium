/**
 * Result Pattern for Error Handling
 *
 * Provides a type-safe way to handle operations that can fail,
 * without relying on try/catch or inconsistent { success, error } patterns.
 *
 * @example
 * ```typescript
 * // Returning results
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return err('Division by zero')
 *   return ok(a / b)
 * }
 *
 * // Using results
 * const result = divide(10, 2)
 * if (result.ok) {
 *   console.log(result.value) // 5
 * } else {
 *   console.error(result.error) // Error message
 * }
 *
 * // Chaining with map
 * const doubled = divide(10, 2).map(x => x * 2) // ok(10)
 *
 * // Unwrapping with default
 * const value = divide(10, 0).unwrapOr(0) // 0
 * ```
 *
 * @see ADR-004 (pending) for architectural decision on error handling
 */

// =============================================================================
// TYPES
// =============================================================================

/** Successful result containing a value */
export interface Ok<T> {
	readonly ok: true
	readonly value: T
	readonly error?: never
}

/** Failed result containing an error */
export interface Err<E> {
	readonly ok: false
	readonly value?: never
	readonly error: E
}

/** Result type that can be either Ok or Err */
export type Result<T, E = Error> = Ok<T> | Err<E>

// =============================================================================
// CONSTRUCTORS
// =============================================================================

/**
 * Creates a successful Result with the given value
 */
export function ok<T>(value: T): Ok<T> {
	return { ok: true, value }
}

/**
 * Creates a failed Result with the given error
 */
export function err<E>(error: E): Err<E> {
	return { ok: false, error }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a Result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
	return result.ok === true
}

/**
 * Type guard to check if a Result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
	return result.ok === false
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Maps a Result's value if it's Ok, otherwise returns the Err unchanged
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
	if (result.ok) {
		return ok(fn(result.value))
	}
	return result
}

/**
 * Maps a Result's error if it's Err, otherwise returns the Ok unchanged
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
	if (!result.ok) {
		return err(fn(result.error))
	}
	return result
}

/**
 * Chains Result operations (flatMap/bind)
 */
export function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
	if (result.ok) {
		return fn(result.value)
	}
	return result
}

/**
 * Returns the value if Ok, otherwise returns the provided default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
	return result.ok ? result.value : defaultValue
}

/**
 * Returns the value if Ok, otherwise calls the provided function
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
	return result.ok ? result.value : fn(result.error)
}

/**
 * Returns the value if Ok, otherwise throws the error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
	if (result.ok) {
		return result.value
	}
	throw result.error
}

/**
 * Returns the error if Err, otherwise throws
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
	if (!result.ok) {
		return result.error
	}
	throw new Error('Called unwrapErr on an Ok value')
}

// =============================================================================
// ASYNC UTILITIES
// =============================================================================

/**
 * Wraps a Promise in a Result, catching any errors
 */
export async function fromPromise<T, E = Error>(
	promise: Promise<T>,
	errorMapper?: (error: unknown) => E
): Promise<Result<T, E>> {
	try {
		const value = await promise
		return ok(value)
	} catch (error) {
		if (errorMapper) {
			return err(errorMapper(error))
		}
		return err(error as E)
	}
}

/**
 * Wraps a function that might throw in a Result
 */
export function fromThrowable<T, E = Error>(fn: () => T, errorMapper?: (error: unknown) => E): Result<T, E> {
	try {
		return ok(fn())
	} catch (error) {
		if (errorMapper) {
			return err(errorMapper(error))
		}
		return err(error as E)
	}
}

// =============================================================================
// COLLECTION UTILITIES
// =============================================================================

/**
 * Combines an array of Results into a Result of array.
 * Returns the first error if any Result is Err.
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
	const values: T[] = []
	for (const result of results) {
		if (!result.ok) {
			return result
		}
		values.push(result.value)
	}
	return ok(values)
}

/**
 * Returns the first Ok result, or the last Err if all fail
 */
export function any<T, E>(results: Result<T, E>[]): Result<T, E> {
	let lastErr: Err<E> | null = null
	for (const result of results) {
		if (result.ok) {
			return result
		}
		lastErr = result
	}
	return lastErr ?? err(undefined as E)
}

// =============================================================================
// COMMON ERROR TYPES
// =============================================================================

/** Standard error type for API/network operations */
export interface ApiError {
	code: string
	message: string
	status?: number
	details?: unknown
}

/** Creates a standard API error */
export function apiError(code: string, message: string, status?: number, details?: unknown): ApiError {
	return { code, message, status, details }
}

/** Common error codes */
export const ErrorCodes = {
	NETWORK_ERROR: 'NETWORK_ERROR',
	TIMEOUT: 'TIMEOUT',
	NOT_FOUND: 'NOT_FOUND',
	UNAUTHORIZED: 'UNAUTHORIZED',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	PARSE_ERROR: 'PARSE_ERROR',
	UNKNOWN: 'UNKNOWN',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]
