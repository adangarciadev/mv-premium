import { beforeEach, describe, expect, it, vi } from 'vitest'
import { injectSaveDraftButton } from './save-draft-button-inject'

vi.mock('@/lib/lazy-toast', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

describe('save draft button injection', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		vi.restoreAllMocks()
	})

	it('adds copy and clear buttons next to the manual draft button', () => {
		document.body.innerHTML = `
			<div class="wpx">
				<form>
					<textarea id="cuerpo">Contenido del hilo</textarea>
					<div class="cf">
						<button type="submit">Crear tema</button>
						<button type="button" id="btpreview">Vista previa</button>
					</div>
				</form>
			</div>
		`

		injectSaveDraftButton()

		expect(document.querySelector('.mvp-save-draft-action')?.textContent).toContain('Guardar borrador')
		expect(document.querySelector('.mvp-copy-content-action')?.textContent).toContain('Copiar')
		expect(document.querySelector('.mvp-clear-content-action')?.textContent).toContain('Limpiar')
	})

	it('disables copy and clear while the editor is empty and re-enables them on input', () => {
		document.body.innerHTML = `
			<div class="wpx">
				<form>
					<textarea id="cuerpo"></textarea>
					<div class="cf">
						<button type="submit">Crear tema</button>
					</div>
				</form>
			</div>
		`

		injectSaveDraftButton()

		const textarea = document.querySelector<HTMLTextAreaElement>('#cuerpo')!
		const copyBtn = document.querySelector<HTMLButtonElement>('.mvp-copy-content-action')!
		const clearBtn = document.querySelector<HTMLButtonElement>('.mvp-clear-content-action')!

		expect(copyBtn.disabled).toBe(true)
		expect(clearBtn.disabled).toBe(true)

		textarea.value = 'Nuevo contenido'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))

		expect(copyBtn.disabled).toBe(false)
		expect(clearBtn.disabled).toBe(false)
	})

	it('clears editor content after confirmation and notifies listeners', () => {
		document.body.innerHTML = `
			<div class="wpx">
				<form>
					<textarea id="cuerpo">Contenido del hilo</textarea>
					<div class="cf">
						<button type="submit">Crear tema</button>
					</div>
				</form>
			</div>
		`
		vi.spyOn(window, 'confirm').mockReturnValue(true)

		injectSaveDraftButton()

		const textarea = document.querySelector<HTMLTextAreaElement>('#cuerpo')!
		const clearBtn = document.querySelector<HTMLButtonElement>('.mvp-clear-content-action')!
		const inputListener = vi.fn()
		const changeListener = vi.fn()
		textarea.addEventListener('input', inputListener)
		textarea.addEventListener('change', changeListener)

		clearBtn.click()

		expect(textarea.value).toBe('')
		expect(inputListener).toHaveBeenCalledOnce()
		expect(changeListener).toHaveBeenCalledOnce()
		expect(clearBtn.disabled).toBe(true)
	})

	it('shows copied feedback on the copy button for one second', async () => {
		vi.useFakeTimers()
		document.body.innerHTML = `
			<div class="wpx">
				<form>
					<textarea id="cuerpo">Contenido del hilo</textarea>
					<div class="cf">
						<button type="submit">Crear tema</button>
					</div>
				</form>
			</div>
		`

		injectSaveDraftButton()

		const textarea = document.querySelector<HTMLTextAreaElement>('#cuerpo')!
		const copyBtn = document.querySelector<HTMLButtonElement>('.mvp-copy-content-action')!

		copyBtn.click()
		await Promise.resolve()

		expect(copyBtn.textContent).toContain('Copiado')
		expect(copyBtn.disabled).toBe(true)

		textarea.value = 'Contenido editado durante el feedback'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))

		expect(copyBtn.disabled).toBe(true)

		vi.advanceTimersByTime(1000)

		expect(copyBtn.textContent).toContain('Copiar')
		expect(copyBtn.disabled).toBe(false)
	})
})
