export const FORUM_SELECT_LEFT_CLASS = 'mvp-forum-select-left'
export const FORUM_SELECT_RIGHT_CLASS = 'mvp-forum-select-right'

function isSeparatorItem(item: HTMLElement): boolean {
	return item.matches('.divider, [role="separator"]')
}

function isVisibleForumItem(item: HTMLElement, hiddenClass: string): boolean {
	if (item.classList.contains(hiddenClass) || item.classList.contains('ghost')) {
		return false
	}

	return Boolean(item.querySelector('a[href*="/foro/"]'))
}

export function syncForumSelectColumnClasses(menu: Element, hiddenClass: string): void {
	let visibleIndex = 0

	for (const child of Array.from(menu.children)) {
		if (!(child instanceof HTMLElement)) continue

		child.classList.remove(FORUM_SELECT_LEFT_CLASS, FORUM_SELECT_RIGHT_CLASS)

		if (isSeparatorItem(child)) {
			visibleIndex = 0
			continue
		}

		if (!isVisibleForumItem(child, hiddenClass)) continue

		child.classList.add(visibleIndex % 2 === 0 ? FORUM_SELECT_LEFT_CLASS : FORUM_SELECT_RIGHT_CLASS)
		visibleIndex += 1
	}
}
