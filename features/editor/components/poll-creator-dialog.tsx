/**
 * Poll Creator Dialog
 * Dialog for creating Mediavida polls with all available options
 *
 * Uses simple React state for form management (no external dependencies)
 * to keep the bundle size minimal.
 */

import { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Vote from 'lucide-react/dist/esm/icons/vote'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import X from 'lucide-react/dist/esm/icons/x'
import Eye from 'lucide-react/dist/esm/icons/eye'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Check from 'lucide-react/dist/esm/icons/check'
import { stopKeyboardPropagation as stopPropagation, cn } from '@/lib/utils'

// ============================================================================
// Form Types
// ============================================================================

const MIN_OPTIONS = 2
const MAX_OPTIONS = 20

interface PollFormData {
	pollName: string
	options: { value: string }[]
	isPublic: boolean
	showResultsBeforeVote: boolean
	ageYears: string
	ageMonths: string
	ageDays: string
	closeDate: string
	closeTime: string
}

const defaultValues: PollFormData = {
	pollName: '',
	options: [{ value: '' }, { value: '' }],
	isPublic: true,
	showResultsBeforeVote: false,
	ageYears: '',
	ageMonths: '',
	ageDays: '',
	closeDate: '',
	closeTime: '',
}

// ============================================================================
// Component
// ============================================================================

interface PollCreatorDialogProps {
	isOpen: boolean
	onClose: () => void
	onInsert: (bbcode: string) => void
}

/**
 * PollCreatorDialog component - Advanced interface for creating Mediavida-compatible polls.
 * Supports public voting, age requirements, and automatic closing dates via native BBCode attributes.
 */
export function PollCreatorDialog({ isOpen, onClose, onInsert }: PollCreatorDialogProps) {
	// Form state with simple React state (no external dependencies)
	const [formData, setFormData] = useState<PollFormData>(defaultValues)

	// Destructure for easier access
	const { pollName, options, isPublic, showResultsBeforeVote, ageYears, ageMonths, ageDays, closeDate, closeTime } =
		formData

	// UI state
	const [showPreview, setShowPreview] = useState(false)
	const [copied, setCopied] = useState(false)

	// Reset form when dialog opens
	useEffect(() => {
		if (isOpen) {
			setFormData(defaultValues)
			setShowPreview(false)
			setCopied(false)
		}
	}, [isOpen])

	// Generic field updater
	const updateField = useCallback(<K extends keyof PollFormData>(field: K, value: PollFormData[K]) => {
		setFormData(prev => ({ ...prev, [field]: value }))
	}, [])

	// Option helpers
	const updateOption = useCallback((index: number, value: string) => {
		setFormData(prev => ({
			...prev,
			options: prev.options.map((opt, i) => (i === index ? { value } : opt)),
		}))
	}, [])

	// Handle dialog open/close
	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				onClose()
			}
		},
		[onClose]
	)

	// Add new option
	const addOption = useCallback(() => {
		if (options.length < MAX_OPTIONS) {
			setFormData(prev => ({
				...prev,
				options: [...prev.options, { value: '' }],
			}))
		}
	}, [options.length])

	// Remove option
	const removeOption = useCallback(
		(index: number) => {
			if (options.length > MIN_OPTIONS) {
				setFormData(prev => ({
					...prev,
					options: prev.options.filter((_, i) => i !== index),
				}))
			}
		},
		[options.length]
	)

	// Generate age string (e.g., "1y6m2d")
	const generateAgeString = useCallback((): string => {
		const parts: string[] = []
		if (ageYears && parseInt(ageYears) > 0) parts.push(`${ageYears}y`)
		if (ageMonths && parseInt(ageMonths) > 0) parts.push(`${ageMonths}m`)
		if (ageDays && parseInt(ageDays) > 0) parts.push(`${ageDays}d`)
		return parts.join('')
	}, [ageYears, ageMonths, ageDays])

	// Generate close date string (e.g., "31/12/2025 23:59")
	const generateCloseDateString = useCallback((): string => {
		if (!closeDate) return ''
		const [year, month, day] = closeDate.split('-')
		const time = closeTime || '23:59'
		return `${day}/${month}/${year} ${time}`
	}, [closeDate, closeTime])

	// Generate BBCode
	const generateBBCode = useCallback((): string => {
		if (!pollName.trim()) return ''

		const attrs: string[] = [`poll=${pollName.trim()}`]

		if (!isPublic) {
			attrs.push('public=false')
		}

		const ageStr = generateAgeString()
		if (ageStr) {
			attrs.push(`age=${ageStr}`)
		}

		if (showResultsBeforeVote) {
			attrs.push('results=vote')
		}

		const closeDateStr = generateCloseDateString()
		if (closeDateStr) {
			attrs.push(`close=${closeDateStr}`)
		}

		const validOptions = options.filter(opt => opt.value.trim())
		if (validOptions.length < MIN_OPTIONS) return ''

		const optionLines = validOptions.map(opt => `- ${opt.value.trim()}`).join('\n')

		return `[${attrs.join(' ')}]\n${optionLines}\n[/poll]`
	}, [pollName, options, isPublic, showResultsBeforeVote, generateAgeString, generateCloseDateString])

	// Check if form is valid (derived state)
	const isFormValid = pollName.trim() && options.filter(opt => opt.value.trim()).length >= MIN_OPTIONS

	// Handle insert
	const handleInsert = useCallback(() => {
		const bbcode = generateBBCode()
		if (bbcode) {
			onInsert(bbcode)
			onClose()
		}
	}, [generateBBCode, onInsert, onClose])

	// Handle copy to clipboard
	const handleCopy = useCallback(async () => {
		const bbcode = generateBBCode()
		if (bbcode) {
			await navigator.clipboard.writeText(bbcode)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}, [generateBBCode])

	const bbcodePreview = generateBBCode()

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="p-0 gap-0 overflow-hidden bg-card border-border rounded-xl flex flex-col w-[520px] max-h-[640px] max-w-[95vw]"
				showCloseButton={false}
			>
				{/* Header */}
				<DialogHeader className="p-4 px-5 border-b border-border flex flex-row items-center justify-between">
					<DialogTitle className="flex items-center gap-2.5 text-foreground text-[15px] font-semibold">
						<div className="p-1.5 rounded-lg bg-primary/15 flex">
							<Vote className="w-4 h-4 text-primary" />
						</div>
						Crear Encuesta
					</DialogTitle>
					<button
						onClick={onClose}
						className="flex items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-muted-foreground cursor-pointer transition-all hover:bg-muted hover:text-foreground"
						title="Cerrar"
					>
						<X className="w-[18px] h-[18px]" />
					</button>
				</DialogHeader>

				{/* Content */}
				<div
					className="flex-1 overflow-auto p-5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
					onKeyDown={stopPropagation}
				>
					{/* Poll Name */}
					<div className="mb-5">
						<label className="block text-[13px] font-medium text-foreground mb-1.5">Nombre de la encuesta *</label>
						<input
							type="text"
							placeholder="Mi encuesta"
							value={pollName}
							onChange={e => updateField('pollName', e.target.value)}
							onKeyDown={stopPropagation}
							className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
						/>
					</div>

					{/* Options */}
					<div className="mb-5">
						<div className="flex justify-between items-center mb-2">
							<label className="text-[13px] font-medium text-foreground">Opciones de votación *</label>
							<span className="text-[11px] text-muted-foreground">
								{options.length}/{MAX_OPTIONS}
							</span>
						</div>
						<div className="flex flex-col gap-2">
							{options.map((option, index) => (
								<div key={index} className="flex items-center gap-2">
									<input
										type="text"
										placeholder={`Opción ${index + 1}`}
										value={option.value}
										onChange={e => updateOption(index, e.target.value)}
										onKeyDown={stopPropagation}
										className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
									/>
									<button
										type="button"
										onClick={() => removeOption(index)}
										disabled={options.length <= MIN_OPTIONS}
										className={cn(
											'w-8 h-8 p-0 flex items-center justify-center rounded-md transition-colors bg-transparent border-none',
											options.length <= MIN_OPTIONS
												? 'opacity-50 cursor-not-allowed text-muted-foreground/50'
												: 'cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground'
										)}
										title="Eliminar opción"
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								</div>
							))}
						</div>
						<button
							type="button"
							onClick={addOption}
							disabled={options.length >= MAX_OPTIONS}
							className={cn(
								'w-full mt-2 h-9 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/30 text-xs font-medium text-muted-foreground transition-colors',
								options.length >= MAX_OPTIONS
									? 'opacity-50 cursor-not-allowed'
									: 'hover:bg-muted hover:text-foreground cursor-pointer'
							)}
						>
							<Plus className="w-3.5 h-3.5" />
							Añadir opción
						</button>
					</div>

					{/* Switches */}
					<div className="mb-5">
						<label className="block text-[13px] font-medium text-foreground mb-1.5">Configuración</label>

						{/* Switch Item 1 */}
						<div className="flex items-center justify-between py-3 border-b border-border">
							<div>
								<span className="text-[13px] text-foreground font-medium">Votación pública</span>
								<span className="block text-[11px] text-muted-foreground mt-0.5">
									Los votos de cada usuario serán visibles
								</span>
							</div>
							<button
								type="button"
								onClick={() => updateField('isPublic', !isPublic)}
								className={cn(
									'w-11 h-6 rounded-full transition-colors relative border-none cursor-pointer',
									isPublic ? 'bg-primary' : 'bg-muted'
								)}
							>
								<div
									className={cn(
										'w-[18px] h-[18px] rounded-full bg-background absolute top-[3px] transition-all duration-150 shadow-sm',
										isPublic ? 'left-[23px]' : 'left-[3px]'
									)}
								/>
							</button>
						</div>

						{/* Switch Item 2 */}
						<div className="flex items-center justify-between py-3 border-b border-border">
							<div>
								<span className="text-[13px] text-foreground font-medium">Mostrar resultados sin votar</span>
								<span className="block text-[11px] text-muted-foreground mt-0.5">
									Ver resultados antes de emitir el voto
								</span>
							</div>
							<button
								type="button"
								onClick={() => updateField('showResultsBeforeVote', !showResultsBeforeVote)}
								className={cn(
									'w-11 h-6 rounded-full transition-colors relative border-none cursor-pointer',
									showResultsBeforeVote ? 'bg-primary' : 'bg-muted'
								)}
							>
								<div
									className={cn(
										'w-[18px] h-[18px] rounded-full bg-background absolute top-[3px] transition-all duration-150 shadow-sm',
										showResultsBeforeVote ? 'left-[23px]' : 'left-[3px]'
									)}
								/>
							</button>
						</div>
					</div>

					{/* Age Requirement */}
					<div className="mb-5">
						<label className="block text-[13px] font-medium text-foreground mb-1">Antigüedad mínima de cuenta</label>
						<span className="block text-xs text-muted-foreground mb-2">
							Opcional: solo usuarios con cuentas más antiguas podrán votar
						</span>
						<div className="flex gap-3">
							<div className="flex-1 flex items-center gap-1.5">
								<input
									type="number"
									min="0"
									max="20"
									placeholder="0"
									value={ageYears}
									onChange={e => updateField('ageYears', e.target.value)}
									onKeyDown={stopPropagation}
									className="h-9 w-[60px] text-center rounded-md border border-input bg-transparent px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								/>
								<span className="text-xs text-muted-foreground">años</span>
							</div>
							<div className="flex-1 flex items-center gap-1.5">
								<input
									type="number"
									min="0"
									max="11"
									placeholder="0"
									value={ageMonths}
									onChange={e => updateField('ageMonths', e.target.value)}
									onKeyDown={stopPropagation}
									className="h-9 w-[60px] text-center rounded-md border border-input bg-transparent px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								/>
								<span className="text-xs text-muted-foreground">meses</span>
							</div>
							<div className="flex-1 flex items-center gap-1.5">
								<input
									type="number"
									min="0"
									max="364"
									placeholder="0"
									value={ageDays}
									onChange={e => updateField('ageDays', e.target.value)}
									onKeyDown={stopPropagation}
									className="h-9 w-[60px] text-center rounded-md border border-input bg-transparent px-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								/>
								<span className="text-xs text-muted-foreground">días</span>
							</div>
						</div>
					</div>

					{/* Close Date */}
					<div className="mb-5">
						<label className="block text-[13px] font-medium text-foreground mb-1">Fecha de cierre</label>
						<span className="block text-xs text-muted-foreground mb-2">
							Opcional: la encuesta cerrará automáticamente en esta fecha
						</span>
						<div className="flex gap-2">
							<input
								type="date"
								value={closeDate}
								onChange={e => updateField('closeDate', e.target.value)}
								onKeyDown={stopPropagation}
								className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							/>
							<input
								type="time"
								value={closeTime}
								onChange={e => updateField('closeTime', e.target.value)}
								onKeyDown={stopPropagation}
								className="w-[120px] h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							/>
						</div>
					</div>

					{/* Preview */}
					<div>
						<button
							type="button"
							onClick={() => setShowPreview(!showPreview)}
							disabled={!isFormValid}
							className={cn(
								'w-full h-9 flex items-center justify-center gap-2 rounded-md border transition-colors text-xs font-medium',
								isFormValid
									? 'bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
									: 'bg-muted/10 border-border/50 text-muted-foreground/50 cursor-not-allowed'
							)}
						>
							<Eye className="w-3.5 h-3.5" />
							{showPreview ? 'Ocultar vista previa' : 'Ver código BBCode'}
						</button>

						{showPreview && bbcodePreview && (
							<div className="relative mt-2">
								<pre className="p-3 rounded-lg bg-muted border border-border text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all m-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
									{bbcodePreview}
								</pre>
								<button
									onClick={handleCopy}
									className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-md bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer border-none"
									title="Copiar al portapapeles"
								>
									{copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<DialogFooter className="p-3 px-5 border-t border-border flex justify-end gap-2 bg-muted/10">
					<button
						type="button"
						onClick={onClose}
						className="h-9 px-4 rounded-md border border-border bg-transparent text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={handleInsert}
						disabled={!isFormValid}
						className={cn(
							'h-9 px-4 flex items-center gap-2 rounded-md text-sm font-medium transition-colors shadow-sm cursor-pointer border-none',
							isFormValid
								? 'bg-primary text-primary-foreground hover:bg-primary/90'
								: 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
						)}
					>
						<Vote className="w-3.5 h-3.5" />
						Insertar encuesta
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
