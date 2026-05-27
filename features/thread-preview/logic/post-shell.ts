import { absolutizeUrl } from './url'

interface PreviewCreatorInfo {
	name?: string
	href?: string
	avatar?: HTMLElement
	authorClass?: string
}

export function repairPreviewPostShell(body: HTMLElement, sourceRow?: HTMLTableRowElement): void {
	const post = body.querySelector<HTMLElement>('.post[data-num], div[id^="post-"]')
	if (!post) return

	if (!post.classList.contains('post')) post.classList.add('post')
	post.classList.remove('news')
	if (!post.getAttribute('data-num')) {
		post.setAttribute('data-num', post.id.match(/^post-(\d+)$/)?.[1] || '1')
	}
	if (!post.id) post.id = `post-${post.getAttribute('data-num') || '1'}`

	const creator = getCreatorInfoFromRow(sourceRow) ?? getCreatorInfoFromPost(post)
	const postBody = ensurePostBody(post)
	ensurePostAvatar(post, creator)
	ensurePostMeta(post, postBody, creator)
}

function ensurePostBody(post: HTMLElement): HTMLElement {
	const existing = post.querySelector<HTMLElement>(':scope > .post-body, :scope > .cuerpo')
	if (existing) return existing

	const body = document.createElement('div')
	body.className = 'post-body'
	const movable = Array.from(post.childNodes).filter(node => {
		if (!(node instanceof HTMLElement)) return true
		return !node.matches('.name-pad, .post-avatar, .post-avatar-reply')
	})

	movable.forEach(node => body.appendChild(node))
	post.appendChild(body)
	return body
}

function getCreatorInfoFromRow(row?: HTMLTableRowElement): PreviewCreatorInfo | null {
	const link = row?.querySelector<HTMLAnchorElement>('.col-av a[href^="/id/"], .col-av a[href*="/id/"]')
	if (!link) return null

	const titleName = link.title.match(/^(.+?)\s+creó\b/i)?.[1]?.trim()
	const image = link.querySelector<HTMLImageElement>('img')
	const letter = link.querySelector<HTMLElement>('.letter')
	const href = link.getAttribute('href') || link.href

	return {
		name: titleName || image?.alt || link.textContent.trim() || undefined,
		href: href ? absolutizeUrl(href) || href : undefined,
		avatar: cloneAvatarLink(link, image, letter),
	}
}

function getCreatorInfoFromPost(post: HTMLElement): PreviewCreatorInfo | null {
	const author = post.querySelector<HTMLAnchorElement>('a.autor[href], .post-meta a[href^="/id/"]')
	const avatarLink = post.querySelector<HTMLAnchorElement>('.post-avatar a[href], .post-avatar-reply a[href]')
	const image = avatarLink?.querySelector<HTMLImageElement>('img')
	const letter = avatarLink?.querySelector<HTMLElement>('.letter')
	const name = author?.textContent.trim() || post.getAttribute('data-autor') || image?.alt || undefined
	const href = author?.getAttribute('href') || avatarLink?.getAttribute('href') || undefined

	return {
		name,
		href: href ? absolutizeUrl(href) || href : undefined,
		avatar: avatarLink ? cloneAvatarLink(avatarLink, image ?? null, letter ?? null) : undefined,
		authorClass: author?.className,
	}
}

function cloneAvatarLink(
	source: HTMLAnchorElement,
	image?: HTMLImageElement | null,
	letter?: HTMLElement | null
): HTMLElement {
	const link = source.cloneNode(false) as HTMLAnchorElement
	link.classList.remove('tooltip-left')
	link.classList.add('user-card')
	const href = source.getAttribute('href') || source.href
	if (href) link.href = absolutizeUrl(href) || href

	const content = image ?? letter
	if (content) {
		const clone = content.cloneNode(true) as HTMLElement
		if (clone instanceof HTMLImageElement) {
			const dataSrc = clone.getAttribute('data-src')
			const src = clone.getAttribute('src')
			if ((!src || src.includes('/style/img/pix.gif')) && dataSrc) {
				clone.src = absolutizeUrl(dataSrc) || dataSrc
			} else if (src) {
				clone.src = absolutizeUrl(src) || src
			}
			clone.classList.add('avatar')
		}
		link.appendChild(clone)
	}

	return link
}

function ensurePostAvatar(post: HTMLElement, creator: PreviewCreatorInfo | null): void {
	if (post.querySelector(':scope > .post-avatar, :scope > .post-avatar-reply')) return

	const avatar = document.createElement('div')
	avatar.className = 'post-avatar mvp-thread-preview-synthetic-avatar'
	if (creator?.avatar) {
		avatar.appendChild(creator.avatar)
	} else if (creator?.name) {
		const letter = document.createElement('span')
		letter.className = 'letter avatar'
		letter.textContent = creator.name.slice(0, 1).toUpperCase()
		avatar.appendChild(letter)
	}

	if (!avatar.childNodes.length) return
	const namePad = post.querySelector('.name-pad')
	if (namePad?.nextSibling) {
		post.insertBefore(avatar, namePad.nextSibling)
	} else {
		post.prepend(avatar)
	}
}

function ensurePostMeta(post: HTMLElement, postBody: HTMLElement, creator: PreviewCreatorInfo | null): void {
	let meta = postBody.querySelector<HTMLElement>(':scope > .post-meta, :scope > .post-meta-reply')
	if (!meta) {
		meta = document.createElement('div')
		meta.className = 'post-meta mvp-thread-preview-synthetic-meta'
		postBody.prepend(meta)
	}

	if (!meta.querySelector('a.autor') && creator?.name) {
		const author = document.createElement('a')
		author.className = creator.authorClass || 'autor user-card'
		author.textContent = creator.name
		if (creator.href) author.href = creator.href
		meta.prepend(author)
	}

	if (!meta.querySelector('a.qn')) {
		const qn = document.createElement('a')
		qn.className = 'qn'
		qn.href = '#1'
		qn.textContent = '#1'
		meta.appendChild(qn)
	}

	const qn = meta.querySelector<HTMLAnchorElement>('a.qn')
	if (qn) qn.setAttribute('href', `#${post.getAttribute('data-num') || '1'}`)
}
