import { useEffect, useMemo, useRef, useState } from 'react'
import Clock from 'lucide-react/dist/esm/icons/clock'
import {
	getCurrentLiveThreadDelay,
	getCurrentLiveThreadDelayQueueSize,
	getLiveThreadDelayOptions,
	onLiveThreadDelayQueueChange,
	updateLiveThreadDelay,
} from '../logic/live-thread-polling'

export function LiveDelayControl() {
	const [isOpen, setIsOpen] = useState(false)
	const [currentDelay, setCurrentDelay] = useState(() => getCurrentLiveThreadDelay())
	const [queueSize, setQueueSize] = useState(() => getCurrentLiveThreadDelayQueueSize())
	const rootRef = useRef<HTMLDivElement>(null)
	const delayOptions = useMemo(() => getLiveThreadDelayOptions(), [])

	useEffect(() => {
		onLiveThreadDelayQueueChange(size => {
			setQueueSize(size)
		})

		return () => {
			onLiveThreadDelayQueueChange(null)
		}
	}, [])

	useEffect(() => {
		if (!isOpen) return

		const onOutsideClick = (event: MouseEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}

		document.addEventListener('mousedown', onOutsideClick)
		return () => {
			document.removeEventListener('mousedown', onOutsideClick)
		}
	}, [isOpen])

	const currentOption = delayOptions.find(option => option.value === currentDelay) ?? delayOptions[0]

	const handleSelectDelay = async (delayMs: number) => {
		setCurrentDelay(delayMs)
		await updateLiveThreadDelay(delayMs)
		setIsOpen(false)
	}

	return (
		<div className="mvp-live-delay" ref={rootRef}>
			<button
				type="button"
				className={`mvp-live-delay-trigger ${currentDelay > 0 ? 'active' : ''}`}
				onClick={() => setIsOpen(prev => !prev)}
				title="Configurar delay de mensajes"
				aria-label="Configurar delay de mensajes"
				aria-expanded={isOpen}
			>
				<Clock className="mvp-live-delay-icon" />
				<span>{currentOption.shortLabel}</span>
				{queueSize > 0 && <span className="mvp-live-delay-badge">{queueSize}</span>}
			</button>

			{isOpen && (
				<div className="mvp-live-delay-menu" role="menu">
					<p className="mvp-live-delay-title">Delay en mensajes</p>

					{delayOptions.map(option => (
						<button
							key={option.value}
							type="button"
							className={`mvp-live-delay-option ${currentDelay === option.value ? 'active' : ''}`}
							onClick={() => {
								void handleSelectDelay(option.value)
							}}
						>
							<span>{option.label}</span>
							<span className="mvp-live-delay-check">{currentDelay === option.value ? '✓' : ''}</span>
						</button>
					))}

					{queueSize > 0 && (
						<p className="mvp-live-delay-queue-note">
							{queueSize} mensaje{queueSize !== 1 ? 's' : ''} en espera
						</p>
					)}
				</div>
			)}
		</div>
	)
}
