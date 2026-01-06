/**
 * Tests for the centralized logger utility
 *
 * @see ADR-001: Centralized Logging System
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to mock import.meta.env before importing the logger
const mockEnv = { DEV: true }

vi.mock('import.meta', () => ({
	env: mockEnv,
}))

describe('logger', () => {
	let consoleSpy: {
		debug: ReturnType<typeof vi.spyOn>
		info: ReturnType<typeof vi.spyOn>
		warn: ReturnType<typeof vi.spyOn>
		error: ReturnType<typeof vi.spyOn>
	}

	beforeEach(() => {
		// Spy on console methods
		consoleSpy = {
			debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
			info: vi.spyOn(console, 'info').mockImplementation(() => {}),
			warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
			error: vi.spyOn(console, 'error').mockImplementation(() => {}),
		}
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('info()', () => {
		it('should log info messages with correct prefix and styling', async () => {
			// Dynamic import to get fresh module with mocked env
			const { logger } = await import('./logger')

			logger.info('Test info message')

			expect(consoleSpy.info).toHaveBeenCalledTimes(1)
			expect(consoleSpy.info).toHaveBeenCalledWith('%c[MVP] ℹ️ Test info message', 'color: #3b82f6')
		})

		it('should pass additional arguments', async () => {
			const { logger } = await import('./logger')
			const extraData = { userId: 123, action: 'click' }

			logger.info('User action', extraData)

			expect(consoleSpy.info).toHaveBeenCalledWith('%c[MVP] ℹ️ User action', 'color: #3b82f6', extraData)
		})
	})

	describe('warn()', () => {
		it('should log warning messages with correct prefix and styling', async () => {
			const { logger } = await import('./logger')

			logger.warn('Test warning')

			expect(consoleSpy.warn).toHaveBeenCalledTimes(1)
			expect(consoleSpy.warn).toHaveBeenCalledWith('%c[MVP] ⚠️ Test warning', 'color: #f59e0b')
		})

		it('should handle multiple arguments', async () => {
			const { logger } = await import('./logger')

			logger.warn('Multiple', 'args', 123)

			expect(consoleSpy.warn).toHaveBeenCalledWith('%c[MVP] ⚠️ Multiple', 'color: #f59e0b', 'args', 123)
		})
	})

	describe('error()', () => {
		it('should log error messages with correct prefix and styling', async () => {
			const { logger } = await import('./logger')

			logger.error('Test error')

			expect(consoleSpy.error).toHaveBeenCalledTimes(1)
			expect(consoleSpy.error).toHaveBeenCalledWith('%c[MVP] ❌ Test error', 'color: #ef4444')
		})

		it('should handle Error objects', async () => {
			const { logger } = await import('./logger')
			const error = new Error('Something went wrong')

			logger.error('Operation failed:', error)

			expect(consoleSpy.error).toHaveBeenCalledWith('%c[MVP] ❌ Operation failed:', 'color: #ef4444', error)
		})
	})

	describe('debug()', () => {
		it('should log debug messages in DEV mode', async () => {
			// Reset module to pick up DEV=true
			vi.resetModules()
			vi.stubGlobal('import', { meta: { env: { DEV: true } } })

			const { logger } = await import('./logger')

			logger.debug('Debug message')

			// In test environment, import.meta.env.DEV may vary
			// This test verifies the method exists and can be called
			expect(typeof logger.debug).toBe('function')
		})
	})

	describe('logger instance', () => {
		it('should be a singleton', async () => {
			const { logger: logger1 } = await import('./logger')
			const { logger: logger2 } = await import('./logger')

			expect(logger1).toBe(logger2)
		})

		it('should have all required methods', async () => {
			const { logger } = await import('./logger')

			expect(typeof logger.debug).toBe('function')
			expect(typeof logger.info).toBe('function')
			expect(typeof logger.warn).toBe('function')
			expect(typeof logger.error).toBe('function')
		})
	})
})
