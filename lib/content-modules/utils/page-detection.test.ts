import { beforeEach, describe, expect, it } from 'vitest'
import {
	getCenteredPostsPageKind,
	isCenteredPostsSupportedPage,
	isPaginatedSubforumPage,
} from './page-detection'

function setPath(path: string): void {
	window.history.pushState({}, '', path)
}

describe('page-detection', () => {
	beforeEach(() => {
		setPath('/')
	})

	describe('isPaginatedSubforumPage', () => {
		it('detects valid paginated subforum urls', () => {
			setPath('/foro/diablo/p2')
			expect(isPaginatedSubforumPage()).toBe(true)
		})

		it('rejects invalid paginated urls', () => {
			setPath('/foro/spy/p2')
			expect(isPaginatedSubforumPage()).toBe(false)
		})
	})

	describe('centered posts support', () => {
		it('supports thread pages', () => {
			setPath('/foro/diablo/diablo-ii-resurrected-reign-of-the-warlock-731946/2')
			expect(getCenteredPostsPageKind()).toBe('thread')
			expect(isCenteredPostsSupportedPage()).toBe(true)
		})

		it('supports spy page', () => {
			setPath('/foro/spy')
			expect(getCenteredPostsPageKind()).toBe('listing')
			expect(isCenteredPostsSupportedPage()).toBe(true)
		})

		it('supports subforum pages and paginated subforums', () => {
			setPath('/foro/dev')
			expect(getCenteredPostsPageKind()).toBe('listing')
			expect(isCenteredPostsSupportedPage()).toBe(true)

			setPath('/foro/dev/p3')
			expect(getCenteredPostsPageKind()).toBe('listing')
			expect(isCenteredPostsSupportedPage()).toBe(true)
		})

		it('keeps unsupported pages disabled', () => {
			setPath('/foro/new')
			expect(getCenteredPostsPageKind()).toBe('unsupported')
			expect(isCenteredPostsSupportedPage()).toBe(false)

			setPath('/foro/post.php')
			expect(getCenteredPostsPageKind()).toBe('unsupported')
			expect(isCenteredPostsSupportedPage()).toBe(false)
		})
	})
})
