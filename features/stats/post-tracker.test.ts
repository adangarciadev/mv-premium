/**
 * Post Tracker Tests
 *
 * Tests for activity tracking: thread creation detection, deferred tracking
 * via sessionStorage, and completion functions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { STORAGE_KEYS } from '@/constants'

// Mock trackActivity before importing the module
const mockTrackActivity = vi.fn().mockResolvedValue(undefined)
vi.mock('@/features/stats/storage', () => ({
	trackActivity: (...args: unknown[]) => mockTrackActivity(...args),
}))

import {
	setupPostTracker,
	cleanupPostTracker,
	completePendingThreadCreation,
	completePendingPostEdit,
	completePendingReply,
} from './post-tracker'

// =============================================================================
// Helpers
// =============================================================================

/** Set window.location to a given URL (jsdom-compatible) */
function setLocation(url: string) {
	Object.defineProperty(window, 'location', {
		value: new URL(url),
		writable: true,
		configurable: true,
	})
}

/** Build a Mediavida thread page DOM with headlink and subforum */
function buildThreadPageDOM(options: {
	title: string
	subforum: string
	threadUrl: string
}) {
	document.body.innerHTML = `
		<div id="title">
			<div class="brand">
				<div class="section"><a href="/foro/tv">${options.subforum}</a></div>
				<h1><a class="headlink" href="${options.threadUrl}">${options.title}</a></h1>
			</div>
		</div>
	`
}

/** Build a new thread page DOM with title input and subforum */
function buildNewThreadPageDOM(options: { subforum: string }) {
	document.body.innerHTML = `
		<header id="title">
			<div class="brand brand-short fullw">
				<div class="section"><a href="/foro/musica">${options.subforum}</a></div>
				<h1>Test Thread Title</h1>
			</div>
		</header>
		<form>
			<input id="cabecera" type="text" value="" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
			<button name="Submit" type="submit">Crear tema</button>
		</form>
	`
}

/** Build a thread page DOM with quick reply form */
function buildThreadPageWithReplyDOM(options: {
	title: string
	subforum: string
	threadUrl: string
}) {
	document.body.innerHTML = `
		<div id="title">
			<div class="brand">
				<div class="section"><a href="/foro/tv">${options.subforum}</a></div>
				<h1><a class="headlink" href="${options.threadUrl}">${options.title}</a></h1>
			</div>
		</div>
		<form>
			<textarea id="cuerpo" name="cuerpo"></textarea>
			<button id="btsubmit" type="submit">Enviar respuesta</button>
		</form>
	`
}

// =============================================================================
// Tests
// =============================================================================

describe('Post Tracker', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		sessionStorage.clear()
		document.body.innerHTML = ''
	})

	afterEach(() => {
		cleanupPostTracker()
		document.body.innerHTML = ''
	})

	// =========================================================================
	// isNewThreadPage detection (tested via setupPostTracker + form submit)
	// =========================================================================
	describe('new thread detection', () => {
		it('should detect /foro/{subforum}/nuevo-hilo as new thread page', () => {
			setLocation('https://www.mediavida.com/foro/tv/nuevo-hilo')
			buildNewThreadPageDOM({ subforum: 'Televisión' })

			const titleInput = document.querySelector<HTMLInputElement>('#cabecera')!
			titleInput.value = 'Bote de Pasapalabra, lo gana ¿Rosa o Manu?'

			setupPostTracker()

			// Trigger form submit
			const form = document.querySelector('form')!
			form.dispatchEvent(new Event('submit'))

			// Should save to sessionStorage as pending THREAD CREATION (not reply)
			const pending = sessionStorage.getItem(STORAGE_KEYS.PENDING_THREAD_CREATION)
			expect(pending).not.toBeNull()

			const parsed = JSON.parse(pending!)
			expect(parsed.title).toBe('Bote de Pasapalabra, lo gana ¿Rosa o Manu?')
			expect(parsed.subforum).toBe('Televisión')

			// Should NOT save as pending reply
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_REPLY)).toBeNull()
		})

		it('should detect /nuevo-hilo (root level) as new thread page', () => {
			setLocation('https://www.mediavida.com/nuevo-hilo')
			buildNewThreadPageDOM({ subforum: 'General' })

			const titleInput = document.querySelector<HTMLInputElement>('#cabecera')!
			titleInput.value = 'Mi nuevo hilo'

			setupPostTracker()

			const form = document.querySelector('form')!
			form.dispatchEvent(new Event('submit'))

			const pending = sessionStorage.getItem(STORAGE_KEYS.PENDING_THREAD_CREATION)
			expect(pending).not.toBeNull()

			const parsed = JSON.parse(pending!)
			expect(parsed.title).toBe('Mi nuevo hilo')
		})

		it('should use "Nuevo hilo" as fallback title when input is empty', () => {
			setLocation('https://www.mediavida.com/foro/tv/nuevo-hilo')
			buildNewThreadPageDOM({ subforum: 'Televisión' })

			// Leave title input empty
			setupPostTracker()

			const form = document.querySelector('form')!
			form.dispatchEvent(new Event('submit'))

			const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.PENDING_THREAD_CREATION)!)
			expect(parsed.title).toBe('Nuevo hilo')
		})

		it('should NOT detect a regular thread page as new thread', () => {
			setLocation('https://www.mediavida.com/foro/tv/bote-pasapalabra-123')
			buildThreadPageWithReplyDOM({
				title: 'Bote de Pasapalabra',
				subforum: 'Televisión',
				threadUrl: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
			})

			setupPostTracker()

			const form = document.querySelector('form')!
			form.dispatchEvent(new Event('submit'))

			// Should NOT be tracked as thread creation
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_THREAD_CREATION)).toBeNull()
			// Should be tracked as a reply
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_REPLY)).not.toBeNull()
		})
	})

	// =========================================================================
	// Reply deferred tracking
	// =========================================================================
	describe('reply deferred tracking', () => {
		it('should save reply info to sessionStorage on form submit', () => {
			setLocation('https://www.mediavida.com/foro/tv/bote-pasapalabra-123')
			buildThreadPageWithReplyDOM({
				title: 'Bote de Pasapalabra',
				subforum: 'Televisión',
				threadUrl: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
			})

			setupPostTracker()

			const form = document.querySelector('form')!
			form.dispatchEvent(new Event('submit'))

			const pending = sessionStorage.getItem(STORAGE_KEYS.PENDING_REPLY)
			expect(pending).not.toBeNull()

			const parsed = JSON.parse(pending!)
			expect(parsed.title).toBe('Bote de Pasapalabra')
			expect(parsed.subforum).toBe('Televisión')
			expect(parsed.url).toContain('bote-pasapalabra-123')
			expect(parsed.timestamp).toBeGreaterThan(0)
		})

		it('should extract title from document.title as fallback when headlink is missing', () => {
			setLocation('https://www.mediavida.com/foro/tv/un-hilo-456')
			// Build DOM without headlink
			document.body.innerHTML = `
				<form>
					<textarea id="cuerpo" name="cuerpo"></textarea>
					<button id="btsubmit" type="submit">Enviar</button>
				</form>
			`
			document.title = 'Título del hilo - Televisión - Mediavida'

			setupPostTracker()

			const form = document.querySelector('form')!
			form.dispatchEvent(new Event('submit'))

			const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.PENDING_REPLY)!)
			expect(parsed.title).toBe('Título del hilo')
			expect(parsed.subforum).toBe('Televisión')
		})
	})

	// =========================================================================
	// completePendingThreadCreation
	// =========================================================================
	describe('completePendingThreadCreation', () => {
		it('should complete tracking with correct data', () => {
			setLocation('https://www.mediavida.com/foro/tv/bote-pasapalabra-123')

			sessionStorage.setItem(
				STORAGE_KEYS.PENDING_THREAD_CREATION,
				JSON.stringify({
					title: 'Bote de Pasapalabra, lo gana ¿Rosa o Manu?',
					subforum: 'Televisión',
					timestamp: Date.now(),
				})
			)

			completePendingThreadCreation()

			expect(mockTrackActivity).toHaveBeenCalledWith({
				type: 'post',
				action: 'create',
				title: 'Bote de Pasapalabra, lo gana ¿Rosa o Manu?',
				context: 'Televisión',
				url: expect.stringContaining('bote-pasapalabra-123'),
			})

			// Should clear sessionStorage
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_THREAD_CREATION)).toBeNull()
		})

		it('should discard stale pending data (> 30s old)', () => {
			setLocation('https://www.mediavida.com/foro/tv/bote-pasapalabra-123')

			sessionStorage.setItem(
				STORAGE_KEYS.PENDING_THREAD_CREATION,
				JSON.stringify({
					title: 'Old thread',
					subforum: 'Televisión',
					timestamp: Date.now() - 60000, // 60 seconds ago
				})
			)

			completePendingThreadCreation()

			expect(mockTrackActivity).not.toHaveBeenCalled()
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_THREAD_CREATION)).toBeNull()
		})

		it('should do nothing when no pending data exists', () => {
			completePendingThreadCreation()
			expect(mockTrackActivity).not.toHaveBeenCalled()
		})
	})

	// =========================================================================
	// completePendingReply
	// =========================================================================
	describe('completePendingReply', () => {
		it('should complete reply tracking with stored data', () => {
			sessionStorage.setItem(
				STORAGE_KEYS.PENDING_REPLY,
				JSON.stringify({
					title: 'Bote de Pasapalabra',
					subforum: 'Televisión',
					url: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
					timestamp: Date.now(),
				})
			)

			completePendingReply()

			expect(mockTrackActivity).toHaveBeenCalledWith({
				type: 'post',
				action: 'publish',
				title: 'Bote de Pasapalabra',
				context: 'Televisión',
				url: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
			})

			// Should clear sessionStorage
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_REPLY)).toBeNull()
		})

		it('should discard stale pending reply (> 30s old)', () => {
			sessionStorage.setItem(
				STORAGE_KEYS.PENDING_REPLY,
				JSON.stringify({
					title: 'Old reply',
					subforum: 'TV',
					url: 'https://www.mediavida.com/foro/tv/old-thread',
					timestamp: Date.now() - 60000,
				})
			)

			completePendingReply()

			expect(mockTrackActivity).not.toHaveBeenCalled()
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_REPLY)).toBeNull()
		})

		it('should do nothing when no pending reply exists', () => {
			completePendingReply()
			expect(mockTrackActivity).not.toHaveBeenCalled()
		})
	})

	// =========================================================================
	// completePendingPostEdit
	// =========================================================================
	describe('completePendingPostEdit', () => {
		it('should complete edit tracking when on the correct thread', () => {
			setLocation('https://www.mediavida.com/foro/tv/bote-pasapalabra-123')
			buildThreadPageDOM({
				title: 'Bote de Pasapalabra',
				subforum: 'Televisión',
				threadUrl: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
			})

			sessionStorage.setItem(
				STORAGE_KEYS.PENDING_POST_EDIT,
				JSON.stringify({
					subforum: 'Televisión',
					url: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
					timestamp: Date.now(),
				})
			)

			completePendingPostEdit()

			expect(mockTrackActivity).toHaveBeenCalledWith({
				type: 'post',
				action: 'update',
				title: 'Bote de Pasapalabra',
				context: 'Televisión',
				url: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
			})

			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_POST_EDIT)).toBeNull()
		})

		it('should NOT complete when on a different thread', () => {
			setLocation('https://www.mediavida.com/foro/tv/otro-hilo-456')
			buildThreadPageDOM({
				title: 'Otro hilo',
				subforum: 'Televisión',
				threadUrl: 'https://www.mediavida.com/foro/tv/otro-hilo-456',
			})

			sessionStorage.setItem(
				STORAGE_KEYS.PENDING_POST_EDIT,
				JSON.stringify({
					subforum: 'Televisión',
					url: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
					timestamp: Date.now(),
				})
			)

			completePendingPostEdit()

			// Should NOT track because we're on a different thread
			expect(mockTrackActivity).not.toHaveBeenCalled()
			// Pending data should still be in sessionStorage (waiting for correct page)
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_POST_EDIT)).not.toBeNull()
		})

		it('should discard stale pending edit (> 30s old)', () => {
			setLocation('https://www.mediavida.com/foro/tv/bote-pasapalabra-123')

			sessionStorage.setItem(
				STORAGE_KEYS.PENDING_POST_EDIT,
				JSON.stringify({
					subforum: 'Televisión',
					url: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
					timestamp: Date.now() - 60000,
				})
			)

			completePendingPostEdit()

			expect(mockTrackActivity).not.toHaveBeenCalled()
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_POST_EDIT)).toBeNull()
		})
	})

	// =========================================================================
	// Full flow simulation: new thread creation
	// =========================================================================
	describe('full flow: new thread creation', () => {
		it('should track thread creation across page navigation', () => {
			// Step 1: User is on nuevo-hilo page, fills form, submits
			setLocation('https://www.mediavida.com/foro/tv/nuevo-hilo')
			buildNewThreadPageDOM({ subforum: 'Televisión' })

			const titleInput = document.querySelector<HTMLInputElement>('#cabecera')!
			titleInput.value = 'Bote de Pasapalabra, lo gana ¿Rosa o Manu?'

			setupPostTracker()
			const form = document.querySelector('form')!
			form.dispatchEvent(new Event('submit'))

			// Verify pending data was saved
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_THREAD_CREATION)).not.toBeNull()
			expect(mockTrackActivity).not.toHaveBeenCalled()

			// Step 2: Simulate page navigation to the created thread
			cleanupPostTracker()
			setLocation('https://www.mediavida.com/foro/tv/bote-pasapalabra-789')
			document.body.innerHTML = ''

			// Step 3: completePendingThreadCreation runs on thread page load
			completePendingThreadCreation()

			expect(mockTrackActivity).toHaveBeenCalledWith({
				type: 'post',
				action: 'create',
				title: 'Bote de Pasapalabra, lo gana ¿Rosa o Manu?',
				context: 'Televisión',
				url: expect.stringContaining('bote-pasapalabra-789'),
			})

			// sessionStorage should be cleared
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_THREAD_CREATION)).toBeNull()
		})
	})

	// =========================================================================
	// Full flow simulation: reply
	// =========================================================================
	describe('full flow: reply', () => {
		it('should track reply across page reload', () => {
			// Step 1: User is on thread page, submits reply
			setLocation('https://www.mediavida.com/foro/tv/bote-pasapalabra-123')
			buildThreadPageWithReplyDOM({
				title: 'Bote de Pasapalabra',
				subforum: 'Televisión',
				threadUrl: 'https://www.mediavida.com/foro/tv/bote-pasapalabra-123',
			})

			setupPostTracker()
			const form = document.querySelector('form')!
			form.dispatchEvent(new Event('submit'))

			// Pending reply saved to sessionStorage
			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_REPLY)).not.toBeNull()
			expect(mockTrackActivity).not.toHaveBeenCalled()

			// Step 2: Page reloads (same thread)
			cleanupPostTracker()

			// Step 3: completePendingReply runs on page load
			completePendingReply()

			expect(mockTrackActivity).toHaveBeenCalledWith({
				type: 'post',
				action: 'publish',
				title: 'Bote de Pasapalabra',
				context: 'Televisión',
				url: expect.stringContaining('bote-pasapalabra-123'),
			})

			expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_REPLY)).toBeNull()
		})
	})
})
