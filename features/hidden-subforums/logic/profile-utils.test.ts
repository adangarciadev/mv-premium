import { describe, expect, it } from 'vitest'
import { getProfileActivityThreadLink, isUserProfileActivityPath } from './profile-utils'

describe('hidden-subforums profile utils', () => {
	it('detects profile activity pages that render thread cards', () => {
		expect(isUserProfileActivityPath('/id/SupermaN_CK/posts')).toBe(true)
		expect(isUserProfileActivityPath('/id/SupermaN_CK/me-gusta')).toBe(true)
		expect(isUserProfileActivityPath('/id/SupermaN_CK/marcadores/2')).toBe(true)
		expect(isUserProfileActivityPath('/id/SupermaN_CK/menciones')).toBe(true)
		expect(isUserProfileActivityPath('/id/SupermaN_CK/temas')).toBe(false)
		expect(isUserProfileActivityPath('/foro/deportes')).toBe(false)
	})

	it('extracts the thread link from a profile activity card', () => {
		document.body.innerHTML = `
			<div class="block cf post" id="post-14121">
				<div class="post-body">
					<div class="post-meta">
						<h1><a href="/foro/deportes/thread-oficial-real-madrid-cf-20252026-v2-733342/471#14121">Thread Oficial</a></h1>
					</div>
				</div>
				<div class="read-more">
					<a href="/foro/deportes/thread-oficial-real-madrid-cf-20252026-v2-733342/471#14121" class="btn">Ir al tema</a>
				</div>
			</div>
		`

		const card = document.querySelector('.block.cf.post')
		const link = card ? getProfileActivityThreadLink(card) : null

		expect(link?.getAttribute('href')).toBe('/foro/deportes/thread-oficial-real-madrid-cf-20252026-v2-733342/471#14121')
	})
})
