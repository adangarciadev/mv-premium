interface IconProps {
	className?: string
}

export const WindowsIcon = ({ className = 'store-platform-icon' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Windows" role="img">
		<path d="M0 3.45 9.75 2.1v9.45H0m10.95-9.6L24 0v11.4H10.95M0 12.6h9.75v9.45L0 20.7m10.95-8.1H24V24l-13.05-1.8" />
	</svg>
)

export const AppleIcon = ({ className = 'store-platform-icon' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="macOS" role="img">
		<path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.79 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.09ZM12.03 7.25C11.88 5.02 13.69 3.18 15.77 3c.29 2.58-2.34 4.5-3.74 4.25Z" />
	</svg>
)

export const LinuxIcon = ({ className = 'store-platform-icon' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label="Linux" role="img">
		<path d="M8.4 9.2C8.1 6.4 9.2 3 12 3s3.9 3.4 3.6 6.2c1.5 1.4 2.4 3.5 2.4 5.7 0 3.4-2.7 6.1-6 6.1s-6-2.7-6-6.1c0-2.2.9-4.3 2.4-5.7Z" />
		<circle cx="10.2" cy="8" r=".7" fill="currentColor" stroke="none" />
		<circle cx="13.8" cy="8" r=".7" fill="currentColor" stroke="none" />
		<path d="m10.3 10.4 1.7 1.1 1.7-1.1M9.2 18.8 7.4 21M14.8 18.8l1.8 2.2" />
	</svg>
)

export const StarIcon = ({ className = 'store-fact-icon' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="m12 2.5 2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55-4.76-4.64 6.58-.96L12 2.5Z" />
	</svg>
)

export const UsersIcon = ({ className = 'store-fact-icon' }: IconProps) => (
	<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H5Z" />
	</svg>
)

interface PlatformIconsProps {
	operatingSystems: readonly string[]
	className?: string
}

export function PlatformIcons({ operatingSystems, className }: PlatformIconsProps) {
	const normalized = new Set(operatingSystems.map(system => system.toLowerCase()))

	return (
		<span className={className} aria-label="Plataformas compatibles">
			{normalized.has('windows') && <WindowsIcon />}
			{(normalized.has('mac') || normalized.has('macos') || normalized.has('osx')) && <AppleIcon />}
			{normalized.has('linux') && <LinuxIcon />}
		</span>
	)
}
