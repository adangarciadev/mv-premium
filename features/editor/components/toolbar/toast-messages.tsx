interface ToastMessagesProps {
	uploadError: string | null
	successMessage: string | null
	onDismissError: () => void
}

/**
 * ToastMessages component - Renders non-intrusive floating notifications for operations like image uploads.
 */
export function ToastMessages({ uploadError, successMessage, onDismissError }: ToastMessagesProps) {
	return (
		<>
			{/* Upload Error Toast */}
			{uploadError && (
				<div
					style={{
						position: 'fixed',
						bottom: '1rem',
						right: '1rem',
						padding: '0.625rem 0.875rem',
						background: 'hsl(0 62.8% 30.6%)',
						color: 'white',
						borderRadius: '0.375rem',
						fontSize: '0.8125rem',
						zIndex: 99999,
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
						boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
						animation: 'slideIn 200ms ease-out',
						cursor: 'pointer',
					}}
					onClick={onDismissError}
				>
					{uploadError}
				</div>
			)}

			{/* Success Toast */}
			{successMessage && (
				<div
					style={{
						position: 'fixed',
						bottom: '1rem',
						right: '1rem',
						padding: '0.625rem 0.875rem',
						background: 'hsl(142 70% 35%)',
						color: 'white',
						borderRadius: '0.375rem',
						fontSize: '0.8125rem',
						zIndex: 99999,
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
						boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
						animation: 'slideIn 200ms ease-out',
					}}
				>
					✓ {successMessage}
				</div>
			)}
		</>
	)
}
