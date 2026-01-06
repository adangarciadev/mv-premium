import Key from 'lucide-react/dist/esm/icons/key'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface ApiKeyDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	apiKey: string
	onApiKeyChange: (key: string) => void
	onSave: () => void
}

/**
 * ApiKeyDialog component - Modal for configuring the ImgBB API key.
 * Essential for enabling image uploads within the editor.
 */
export function ApiKeyDialog({ open, onOpenChange, apiKey, onApiKeyChange, onSave }: ApiKeyDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				style={{
					maxWidth: '340px',
					padding: 0,
					gap: 0,
					overflow: 'hidden',
					backgroundColor: 'rgb(24, 24, 27)',
					border: '1px solid rgba(63, 63, 70, 0.5)',
					borderRadius: 'var(--radius, 12px)',
				}}
			>
				{/* Header with icon */}
				<div
					style={{
						padding: '16px 20px',
						borderBottom: '1px solid rgba(63, 63, 70, 0.5)',
						display: 'flex',
						alignItems: 'center',
						gap: '12px',
					}}
				>
					<div
						style={{
							width: '32px',
							height: '32px',
							borderRadius: 'var(--radius, 8px)',
							background: 'linear-gradient(135deg, hsl(45 90% 50%), hsl(35 90% 45%))',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Key style={{ width: 16, height: 16, color: 'white' }} />
					</div>
					<div>
						<DialogTitle style={{ fontSize: '15px', marginBottom: '2px', color: 'rgb(244, 244, 245)' }}>
							API Key de ImgBB
						</DialogTitle>
						<p style={{ fontSize: '12px', color: 'rgb(113, 113, 122)', margin: 0 }}>Necesaria para subir imágenes</p>
					</div>
				</div>

				{/* Content */}
				<div style={{ padding: '16px 20px' }}>
					<input
						type="text"
						value={apiKey}
						onChange={e => onApiKeyChange(e.target.value)}
						placeholder="Pega tu API key aquí"
						autoFocus
						onKeyDown={e => {
							e.stopPropagation()
							if (e.key === 'Enter' && apiKey.trim()) {
								onSave()
							}
						}}
						style={{
							width: '100%',
							height: '36px',
							padding: '0 12px',
							backgroundColor: 'rgb(39, 39, 42)',
							border: '1px solid rgba(63, 63, 70, 0.5)',
							borderRadius: 'var(--radius, 8px)',
							color: 'rgb(244, 244, 245)',
							fontSize: '13px',
							outline: 'none',
							fontFamily: 'inherit',
						}}
					/>

					<a
						href="https://api.imgbb.com/"
						target="_blank"
						rel="noopener"
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '4px',
							marginTop: '10px',
							fontSize: '12px',
							color: 'rgb(129, 140, 248)',
							textDecoration: 'none',
						}}
					>
						Obtener gratis en api.imgbb.com
						<ExternalLink style={{ width: 10, height: 10 }} />
					</a>
				</div>

				{/* Footer */}
				<div
					style={{
						padding: '12px 20px',
						borderTop: '1px solid rgba(63, 63, 70, 0.5)',
						display: 'flex',
						justifyContent: 'flex-end',
						gap: '8px',
					}}
				>
					<button
						onClick={() => onOpenChange(false)}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							padding: '0 12px',
							height: '32px',
							fontSize: '13px',
							fontWeight: 500,
							borderRadius: 'var(--radius, 6px)',
							border: '1px solid rgba(63, 63, 70, 0.5)',
							backgroundColor: 'transparent',
							color: 'rgb(161, 161, 170)',
							cursor: 'pointer',
							fontFamily: 'inherit',
						}}
					>
						Cancelar
					</button>
					<button
						onClick={onSave}
						disabled={!apiKey.trim()}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							padding: '0 12px',
							height: '32px',
							fontSize: '13px',
							fontWeight: 500,
							borderRadius: 'var(--radius, 6px)',
							border: 'none',
							backgroundColor: apiKey.trim() ? 'rgb(99, 102, 241)' : 'rgb(63, 63, 70)',
							color: apiKey.trim() ? '#fff' : 'rgb(113, 113, 122)',
							cursor: apiKey.trim() ? 'pointer' : 'not-allowed',
							fontFamily: 'inherit',
							boxShadow: apiKey.trim() ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none',
						}}
					>
						Guardar
					</button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
