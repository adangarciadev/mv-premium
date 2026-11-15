export function syncTavernAccess(): void {
	const open = !!document.getElementById('mvp-tavern-dock')
	const enter = document.getElementById('mvp-live-tavern')?.shadowRoot?.querySelector<HTMLButtonElement>('.enter')
	if (enter && enter.disabled !== open) {
		enter.disabled = open
		enter.querySelector('span')!.textContent = open ? 'Taberna abierta' : enter.dataset.entryLabel!
	}
	const top = document.getElementById('mvp-gamedev-tavern')
	if (!top || top.inert === open) return
	if (open) top.querySelector<HTMLElement>('[popover]')?.hidePopover?.()
	top.inert = open
	top.style.opacity = open ? '0.55' : ''
	const button = top.querySelector('button')
	if (button) button.disabled = open
}
