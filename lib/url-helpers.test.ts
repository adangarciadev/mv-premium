/**
 * Tests for url-helpers.ts
 *
 * Note: These tests mock window.location since the utilities depend on it
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getThreadId, getCurrentPage, isThreadUrl, getSubforumInfo } from './url-helpers'

describe('url-helpers', () => {
	describe('getThreadId()', () => {
		beforeEach(() => {
			// Reset window.location mock
			vi.stubGlobal('location', { pathname: '' })
		})

		it('extracts thread ID from simple thread URL', () => {
			window.location.pathname = '/foro/cine/titulo-del-hilo-123456'
			expect(getThreadId()).toBe('/foro/cine/titulo-del-hilo-123456')
		})

		it('removes page number from URL', () => {
			window.location.pathname = '/foro/cine/titulo-del-hilo-123456/15'
			expect(getThreadId()).toBe('/foro/cine/titulo-del-hilo-123456')
		})

		it('removes /live suffix from URL', () => {
			window.location.pathname = '/foro/cine/titulo-del-hilo-123456/live'
			expect(getThreadId()).toBe('/foro/cine/titulo-del-hilo-123456')
		})

		it('removes both page and /live suffix', () => {
			window.location.pathname = '/foro/cine/titulo-del-hilo-123456/live/'
			expect(getThreadId()).toBe('/foro/cine/titulo-del-hilo-123456')
		})

		it('removes trailing slash', () => {
			window.location.pathname = '/foro/cine/titulo-del-hilo-123456/'
			expect(getThreadId()).toBe('/foro/cine/titulo-del-hilo-123456')
		})
	})

	describe('getCurrentPage()', () => {
		beforeEach(() => {
			vi.stubGlobal('location', { pathname: '' })
		})

		it('returns 1 for first page (no page number)', () => {
			window.location.pathname = '/foro/cine/titulo-123456'
			expect(getCurrentPage()).toBe(1)
		})

		it('extracts page number from URL', () => {
			window.location.pathname = '/foro/cine/titulo-123456/5'
			expect(getCurrentPage()).toBe(5)
		})

		it('handles large page numbers', () => {
			window.location.pathname = '/foro/cine/titulo-123456/1331'
			expect(getCurrentPage()).toBe(1331)
		})

		it('handles trailing slash', () => {
			window.location.pathname = '/foro/cine/titulo-123456/10/'
			expect(getCurrentPage()).toBe(10)
		})
	})

	describe('isThreadUrl()', () => {
		beforeEach(() => {
			vi.stubGlobal('location', { pathname: '' })
		})

		it('returns true for valid thread URLs', () => {
			expect(isThreadUrl('/foro/cine/titulo-123456')).toBe(true)
			expect(isThreadUrl('/foro/off-topic/otro-hilo-789')).toBe(true)
			expect(isThreadUrl('/foro/videojuegos/juego-nuevo-1')).toBe(true)
		})

		it('returns true for thread URLs with page', () => {
			expect(isThreadUrl('/foro/cine/titulo-123456/15')).toBe(true)
		})

		it('returns false for non-thread URLs', () => {
			expect(isThreadUrl('/foro/cine')).toBe(false)
			expect(isThreadUrl('/foro/')).toBe(false)
			expect(isThreadUrl('/')).toBe(false)
			expect(isThreadUrl('/id/usuario')).toBe(false)
		})

		it('uses window.location when no path provided', () => {
			window.location.pathname = '/foro/cine/titulo-123456'
			expect(isThreadUrl()).toBe(true)

			window.location.pathname = '/foro/cine'
			expect(isThreadUrl()).toBe(false)
		})
	})

	describe('getSubforumInfo()', () => {
		it('extracts subforum info from thread path', () => {
			const info = getSubforumInfo('/foro/cine/titulo-123456')
			expect(info.slug).toBe('cine')
			expect(info.path).toBe('/foro/cine')
		})

		it('returns Unknown for invalid paths', () => {
			const info = getSubforumInfo('/invalid/path')
			expect(info.name).toBe('Unknown')
			expect(info.path).toBe('')
			expect(info.slug).toBe('')
		})

		it('returns Unknown for /foro/ root', () => {
			const info = getSubforumInfo('/foro/')
			expect(info.name).toBe('Unknown')
		})

		it('handles different subforums', () => {
			expect(getSubforumInfo('/foro/off-topic/hilo-123').slug).toBe('off-topic')
			expect(getSubforumInfo('/foro/cine/hilo-456').slug).toBe('cine')
			expect(getSubforumInfo('/foro/musica/hilo-789').slug).toBe('musica')
		})
	})
})
