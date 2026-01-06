/**
 * Tests for Result Pattern utilities
 */
import { describe, it, expect } from 'vitest'
import {
	ok,
	err,
	isOk,
	isErr,
	map,
	mapErr,
	andThen,
	unwrapOr,
	unwrapOrElse,
	unwrap,
	unwrapErr,
	fromPromise,
	fromThrowable,
	all,
	any,
	apiError,
	ErrorCodes,
	type Result,
} from './result'

describe('result', () => {
	describe('constructors', () => {
		it('ok() creates a successful result', () => {
			const result = ok(42)
			expect(result.ok).toBe(true)
			expect(result.value).toBe(42)
		})

		it('err() creates a failed result', () => {
			const result = err('Something went wrong')
			expect(result.ok).toBe(false)
			expect(result.error).toBe('Something went wrong')
		})

		it('ok() can hold any value type', () => {
			expect(ok(null).value).toBe(null)
			expect(ok(undefined).value).toBe(undefined)
			expect(ok({ name: 'test' }).value).toEqual({ name: 'test' })
			expect(ok([1, 2, 3]).value).toEqual([1, 2, 3])
		})
	})

	describe('type guards', () => {
		it('isOk() returns true for Ok results', () => {
			expect(isOk(ok(1))).toBe(true)
			expect(isOk(err('error'))).toBe(false)
		})

		it('isErr() returns true for Err results', () => {
			expect(isErr(err('error'))).toBe(true)
			expect(isErr(ok(1))).toBe(false)
		})
	})

	describe('map()', () => {
		it('transforms value in Ok result', () => {
			const result = map(ok(5), x => x * 2)
			expect(result).toEqual(ok(10))
		})

		it('passes through Err result unchanged', () => {
			const result = map(err('error'), (x: number) => x * 2)
			expect(result).toEqual(err('error'))
		})

		it('can change value type', () => {
			const result = map(ok(42), x => `Value is ${x}`)
			expect(result).toEqual(ok('Value is 42'))
		})
	})

	describe('mapErr()', () => {
		it('transforms error in Err result', () => {
			const result = mapErr(err('original'), e => `Wrapped: ${e}`)
			expect(result).toEqual(err('Wrapped: original'))
		})

		it('passes through Ok result unchanged', () => {
			const result = mapErr(ok(5), (e: string) => `Wrapped: ${e}`)
			expect(result).toEqual(ok(5))
		})
	})

	describe('andThen()', () => {
		const divide = (a: number, b: number): Result<number, string> => {
			if (b === 0) return err('Division by zero')
			return ok(a / b)
		}

		it('chains successful operations', () => {
			const result = andThen(ok(10), x => divide(x, 2))
			expect(result).toEqual(ok(5))
		})

		it('short-circuits on first error', () => {
			const result = andThen(ok(10), x => divide(x, 0))
			expect(result).toEqual(err('Division by zero'))
		})

		it('propagates initial error', () => {
			const result = andThen(err('initial error') as Result<number, string>, x => divide(x, 2))
			expect(result).toEqual(err('initial error'))
		})
	})

	describe('unwrapOr()', () => {
		it('returns value for Ok', () => {
			expect(unwrapOr(ok(42), 0)).toBe(42)
		})

		it('returns default for Err', () => {
			expect(unwrapOr(err('error'), 0)).toBe(0)
		})
	})

	describe('unwrapOrElse()', () => {
		it('returns value for Ok without calling function', () => {
			const fn = () => {
				throw new Error('Should not be called')
			}
			expect(unwrapOrElse(ok(42), fn)).toBe(42)
		})

		it('calls function with error for Err', () => {
			const result = unwrapOrElse(err('error'), e => `fallback: ${e}`)
			expect(result).toBe('fallback: error')
		})
	})

	describe('unwrap()', () => {
		it('returns value for Ok', () => {
			expect(unwrap(ok(42))).toBe(42)
		})

		it('throws for Err', () => {
			const error = new Error('test error')
			expect(() => unwrap(err(error))).toThrow(error)
		})
	})

	describe('unwrapErr()', () => {
		it('returns error for Err', () => {
			expect(unwrapErr(err('test error'))).toBe('test error')
		})

		it('throws for Ok', () => {
			expect(() => unwrapErr(ok(42))).toThrow('Called unwrapErr on an Ok value')
		})
	})

	describe('fromPromise()', () => {
		it('wraps successful promise in Ok', async () => {
			const result = await fromPromise(Promise.resolve(42))
			expect(result).toEqual(ok(42))
		})

		it('wraps rejected promise in Err', async () => {
			const error = new Error('async error')
			const result = await fromPromise(Promise.reject(error))
			expect(result).toEqual(err(error))
		})

		it('uses error mapper when provided', async () => {
			const result = await fromPromise(Promise.reject(new Error('original')), e => `mapped: ${(e as Error).message}`)
			expect(result).toEqual(err('mapped: original'))
		})
	})

	describe('fromThrowable()', () => {
		it('wraps successful function in Ok', () => {
			const result = fromThrowable(() => 42)
			expect(result).toEqual(ok(42))
		})

		it('wraps throwing function in Err', () => {
			const error = new Error('sync error')
			const result = fromThrowable(() => {
				throw error
			})
			expect(result).toEqual(err(error))
		})

		it('uses error mapper when provided', () => {
			const result = fromThrowable(
				() => {
					throw new Error('original')
				},
				e => `mapped: ${(e as Error).message}`
			)
			expect(result).toEqual(err('mapped: original'))
		})
	})

	describe('all()', () => {
		it('combines all Ok results into array', () => {
			const results = [ok(1), ok(2), ok(3)]
			expect(all(results)).toEqual(ok([1, 2, 3]))
		})

		it('returns first Err encountered', () => {
			const results = [ok(1), err('error'), ok(3)]
			expect(all(results)).toEqual(err('error'))
		})

		it('returns Ok for empty array', () => {
			expect(all([])).toEqual(ok([]))
		})
	})

	describe('any()', () => {
		it('returns first Ok result', () => {
			const results = [err('e1'), ok(2), ok(3)]
			expect(any(results)).toEqual(ok(2))
		})

		it('returns last Err if all fail', () => {
			const results = [err('e1'), err('e2'), err('e3')]
			expect(any(results)).toEqual(err('e3'))
		})
	})

	describe('apiError()', () => {
		it('creates structured API error', () => {
			const error = apiError('NOT_FOUND', 'User not found', 404, { userId: 123 })
			expect(error).toEqual({
				code: 'NOT_FOUND',
				message: 'User not found',
				status: 404,
				details: { userId: 123 },
			})
		})

		it('works with minimal parameters', () => {
			const error = apiError('UNKNOWN', 'Something went wrong')
			expect(error).toEqual({
				code: 'UNKNOWN',
				message: 'Something went wrong',
				status: undefined,
				details: undefined,
			})
		})
	})

	describe('ErrorCodes', () => {
		it('contains standard error codes', () => {
			expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR')
			expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND')
			expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
		})
	})
})
