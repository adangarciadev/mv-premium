/**
 * ApiKeyInput - Input component for API keys with visibility toggle, save button, and verify
 */
import { useState, useEffect } from 'react'
import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import X from 'lucide-react/dist/esm/icons/x'
import Check from 'lucide-react/dist/esm/icons/check'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Play from 'lucide-react/dist/esm/icons/play'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface ApiKeyInputProps {
	value: string
	onChange: (value: string) => void
	placeholder?: string
	label?: string
	onVerify?: (key: string) => Promise<boolean>
}

export function ApiKeyInput({ value, onChange, placeholder, label, onVerify }: ApiKeyInputProps) {
	const [showKey, setShowKey] = useState(false)
	const [localValue, setLocalValue] = useState(value)
	const [hasChanges, setHasChanges] = useState(false)
	const [verifyState, setVerifyState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

	useEffect(() => {
		setLocalValue(value)
		setHasChanges(false)
		setVerifyState(value ? 'success' : 'idle')
	}, [value])

	const handleInputChange = (newValue: string) => {
		setLocalValue(newValue)
		setHasChanges(newValue !== value)
		setVerifyState('idle')
	}

	const handleSave = async () => {
		// 1. Commit the change
		onChange(localValue)
		setHasChanges(false)
		
		// 2. Immediate verification flow
		setVerifyState('loading')
		
		if (onVerify) {
			try {
				const isValid = await onVerify(localValue)
				setVerifyState(isValid ? 'success' : 'error')
				if (isValid) {
					toast.success('API Key guardada y activa', { description: `${label || 'Key'} verificada correctamente` })
				} else {
					toast.error('API Key guardada pero inválida', { description: 'Verifica que la key sea correcta' })
				}
			} catch {
				setVerifyState('error')
				toast.error('Error al verificar', { description: 'No se pudo conectar con el servicio' })
			}
		} else {
			// Simple fallback for inputs without verify logic
			await new Promise(resolve => setTimeout(resolve, 400))
			setVerifyState('success')
			toast.success('API Key guardada', { description: `${label || 'Key'} configurada correctamente` })
		}
	}

	const handleClear = () => {
		onChange('')
		setLocalValue('')
		setHasChanges(false)
		setVerifyState('idle')
		toast.success('API Key eliminada')
	}

	const handleCancel = () => {
		setLocalValue(value)
		setHasChanges(false)
	}

	return (
		<div className="flex items-center gap-2">
			<div className="relative">
				<Input
					type={showKey ? 'text' : 'password'}
					value={localValue}
					onChange={(e) => handleInputChange(e.target.value)}
					placeholder={placeholder}
					className={cn(
						"w-80 font-mono text-xs pr-9",
						verifyState === 'success' && 'border-green-500 focus-visible:ring-green-500',
						verifyState === 'error' && 'border-destructive focus-visible:ring-destructive'
					)}
				/>
			</div>
			
			{/* Visibility toggle */}
			<Button
				variant="ghost"
				size="icon"
				onClick={() => setShowKey(!showKey)}
				className="h-9 w-9"
				title={showKey ? 'Ocultar' : 'Mostrar'}
			>
				{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
			</Button>

			{/* Save/Cancel buttons - show when there are changes or loading */}
			{hasChanges || verifyState === 'loading' ? (
				<>
					<Button
						variant="default"
						size="icon"
						onClick={handleSave}
						className="h-9 w-9 shrink-0"
						title="Guardar y verificar"
						disabled={verifyState === 'loading'}
					>
						{verifyState === 'loading' ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Check className="h-4 w-4" />
						)}
					</Button>
					{!hasChanges && verifyState === 'loading' ? null : (
						<Button
							variant="ghost"
							size="icon"
							onClick={handleCancel}
							className="h-9 w-9"
							title="Cancelar"
							disabled={verifyState === 'loading'}
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</>
			) : (
				<>
					{/* Status indicator / Action buttons when no changes */}
					{value && (
						<div className="flex items-center gap-1">
							<div className={cn(
								"flex items-center justify-center h-9 w-9 rounded-md border",
								verifyState === 'success' && 'bg-green-500/10 border-green-500/20 text-green-500',
								verifyState === 'error' && 'bg-destructive/10 border-destructive/20 text-destructive',
								verifyState === 'idle' && 'bg-muted border-muted-foreground/20 text-muted-foreground'
							)}>
								{verifyState === 'success' ? (
									<CheckCircle2 className="h-4 w-4" />
								) : verifyState === 'error' ? (
									<X className="h-4 w-4" />
								) : (
									<Play className="h-4 w-4" />
								)}
							</div>
							
							<Button
								variant="ghost"
								size="icon"
								onClick={handleClear}
								className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
								title="Eliminar API Key"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	)
}

