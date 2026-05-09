import { describe, expect, it } from 'vitest'
import {
	FORUM_SELECT_LEFT_CLASS,
	FORUM_SELECT_RIGHT_CLASS,
	syncForumSelectColumnClasses,
} from './forum-select-layout'

const HIDDEN_CLASS = 'mvp-hidden-subforum'

function createForumSelect(): HTMLUListElement {
	const menu = document.createElement('ul')
	menu.id = 'forum-select'
	menu.innerHTML = `
		<li><a href="/foro/deportes">Deportes</a></li>
		<li class="${HIDDEN_CLASS}"><a href="/foro/cine">Cine</a></li>
		<li><a href="/foro/tv">Televisión</a></li>
		<li><a href="/foro/juegos">Juegos</a></li>
		<li role="separator" class="divider"></li>
		<li class="ghost"></li>
		<li><a href="/foro/off-topic">OFF-Topic</a></li>
		<li><a href="/foro/feda">FEDA</a></li>
	`

	return menu
}

describe('forum select layout', () => {
	it('recalculates left and right column classes from visible items only', () => {
		const menu = createForumSelect()

		syncForumSelectColumnClasses(menu, HIDDEN_CLASS)

		const [deportes, cine, tv, juegos, divider, ghost, offTopic, feda] = Array.from(menu.children)

		expect(deportes).toHaveClass(FORUM_SELECT_LEFT_CLASS)
		expect(cine).not.toHaveClass(FORUM_SELECT_LEFT_CLASS)
		expect(cine).not.toHaveClass(FORUM_SELECT_RIGHT_CLASS)
		expect(tv).toHaveClass(FORUM_SELECT_RIGHT_CLASS)
		expect(juegos).toHaveClass(FORUM_SELECT_LEFT_CLASS)
		expect(divider).not.toHaveClass(FORUM_SELECT_LEFT_CLASS)
		expect(ghost).not.toHaveClass(FORUM_SELECT_LEFT_CLASS)
		expect(offTopic).toHaveClass(FORUM_SELECT_LEFT_CLASS)
		expect(feda).toHaveClass(FORUM_SELECT_RIGHT_CLASS)
	})
})
