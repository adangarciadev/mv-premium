/**
 * Delay Control Component
 *
 * Floating widget to control the delay for native LIVE threads.
 * Shows current delay, queue size badge, and allows changing delay.
 */

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Check from 'lucide-react/dist/esm/icons/check'
import Info from 'lucide-react/dist/esm/icons/info'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { delayManager } from '../logic/delay-manager'
import { nativeLiveDelayStorage } from '../storage'

const DELAY_OPTIONS = [
	{ value: 0, label: 'Sin delay', shortLabel: 'Real-time' },
	{ value: 15000, label: '15 segundos', shortLabel: '15s' },
	{ value: 30000, label: '30 segundos', shortLabel: '30s' },
	{ value: 45000, label: '45 segundos', shortLabel: '45s' },
	{ value: 60000, label: '1 minuto', shortLabel: '1m' },
	{ value: 75000, label: '1m 15s', shortLabel: '1m 15s' },
	{ value: 90000, label: '1m 30s', shortLabel: '1m 30s' },
	{ value: 105000, label: '1m 45s', shortLabel: '1m 45s' },
	{ value: 120000, label: '2 minutos', shortLabel: '2m' },
] as const

export function DelayControl() {
	const [currentDelay, setCurrentDelay] = useState(0)
	const [queueSize, setQueueSize] = useState(0)
	const [isOpen, setIsOpen] = useState(false)

	// Initialize on mount
	useEffect(() => {
		// Load saved preference
		const loadSavedDelay = async () => {
			const savedDelay = await nativeLiveDelayStorage.getValue()
			setCurrentDelay(savedDelay)

			// Start the delay manager
			delayManager.start(savedDelay)
		}

		// Register queue size callback
		delayManager.onQueueSizeChange(size => {
			setQueueSize(size)
		})

		loadSavedDelay()

		// Cleanup on unmount
		return () => {
			delayManager.stop()
		}
	}, [])

	const handleDelayChange = useCallback(async (newDelay: number) => {
		setCurrentDelay(newDelay)

		// Update manager
		delayManager.setDelay(newDelay)

		// If changing from 0 to non-zero or manager not active, restart
		if (!delayManager.getIsActive()) {
			delayManager.start(newDelay)
		}

		// Persist preference
		await nativeLiveDelayStorage.setValue(newDelay)

		setIsOpen(false)
	}, [])

	const currentOption = DELAY_OPTIONS.find(opt => opt.value === currentDelay) || DELAY_OPTIONS[0]

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						'h-7 gap-1.5 px-2 text-md font-medium',
						'bg-background/80 backdrop-blur-sm',
						'border-border/50 hover:border-primary/50',
						'transition-all duration-200',
						currentDelay > 0 && 'border-primary/40 bg-primary/5'
					)}
				>
					<Clock className="h-3.5 w-3.5" />
					<span>{currentOption.shortLabel}</span>
					{queueSize > 0 && (
						<Badge
							variant="secondary"
							className={cn(
								'ml-0.5 h-4 min-w-[18px] px-1 text-[10px] font-bold',
								'bg-primary/20 text-primary',
								'animate-pulse'
							)}
						>
							{queueSize}
						</Badge>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-48 p-2 overflow-visible"
				align="center"
				sideOffset={8}
			>
				<div className="space-y-1">
					<div className="flex items-center justify-between mb-2 px-1">
						<p className="text-xs font-semibold text-muted-foreground">
							Delay en mensajes
						</p>
						<SimpleTooltip
							content={
								<div className="w-[280px] whitespace-normal text-center leading-snug space-y-1.5 p-0.5">
									<p>
										<span className="font-semibold text-primary">
											Límite de seguridad:
										</span>{' '}
										Si se acumulan más de 100 mensajes en cola, los más antiguos
										se mostrarán automáticamente.
									</p>
									<p className="text-muted-foreground/80 text-[10px]">
										Esto evita problemas de memoria en el navegador.
									</p>
								</div>
							}
						>
							<div className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
								<Info className="h-3 w-3" />
							</div>
						</SimpleTooltip>
					</div>
					{DELAY_OPTIONS.map(option => (
						<Button
							key={option.value}
							variant={currentDelay === option.value ? 'secondary' : 'ghost'}
							size="sm"
							className={cn(
								'w-full justify-between h-8 text-md',
								currentDelay === option.value && 'bg-primary/10 text-primary'
							)}
							onClick={() => handleDelayChange(option.value)}
						>
							<span>{option.label}</span>
							{currentDelay === option.value && (
								<Check className="h-3.5 w-3.5" />
							)}
						</Button>
					))}
				</div>
				{queueSize > 0 && (
					<p className="text-[10px] text-muted-foreground mt-2 px-1">
						{queueSize} mensaje{queueSize !== 1 ? 's' : ''} en espera
					</p>
				)}
			</PopoverContent>
		</Popover>
	)
}
