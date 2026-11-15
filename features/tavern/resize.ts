const margin = 12
const step = 24

type Adjust = (rect: DOMRect, dx: number, dy: number, axis?: 'x' | 'y') => void

function bindHandle(panel: HTMLElement, handle: HTMLElement, adjust: Adjust) {
	handle.onpointerdown = event => {
		if (event.button !== 0 || !event.isPrimary) return
		const rect = panel.getBoundingClientRect()
		handle.setPointerCapture(event.pointerId)
		panel.classList.add('adjusting')
		handle.onpointermove = move => {
			if (move.pointerId === event.pointerId) adjust(rect, move.clientX - event.clientX, move.clientY - event.clientY)
		}
	}
	handle.onlostpointercapture = () => {
		handle.onpointermove = null
		panel.classList.remove('adjusting')
	}
	handle.onkeydown = event => {
		const rect = panel.getBoundingClientRect()
		switch (event.key) {
			case 'ArrowLeft': adjust(rect, -step, 0, 'x'); break
			case 'ArrowRight': adjust(rect, step, 0, 'x'); break
			case 'ArrowUp': adjust(rect, 0, -step, 'y'); break
			case 'ArrowDown': adjust(rect, 0, step, 'y'); break
			default: return
		}
		event.preventDefault()
	}
}

export function enableTavernWindow(panel: HTMLElement, resize: HTMLElement, move: HTMLElement): () => void {
	// Keep the bottom-right corner anchored while resizing from the top-left.
	bindHandle(panel, resize, (rect, dx, dy, axis) => {
		if (axis !== 'y') panel.style.width = Math.min(rect.right - margin, Math.max(320, rect.width - dx)) + 'px'
		if (axis !== 'x') panel.style.height = Math.min(rect.bottom - margin, Math.max(220, rect.height - dy)) + 'px'
	})
	const reposition: Adjust = (rect, dx, dy, axis) => {
		const width = document.documentElement.clientWidth || innerWidth
		const height = document.documentElement.clientHeight || innerHeight
		const right = width - rect.right - dx
		const bottom = height - rect.bottom - dy
		if (axis !== 'y') panel.style.right = Math.max(margin, Math.min(right, width - rect.width - margin)) + 'px'
		if (axis !== 'x') panel.style.bottom = Math.max(margin, Math.min(bottom, height - rect.height - margin)) + 'px'
	}
	bindHandle(panel, move, reposition)
	const keepVisible = () => reposition(panel.getBoundingClientRect(), 0, 0)
	window.addEventListener('resize', keepVisible)
	return () => window.removeEventListener('resize', keepVisible)
}
