/**
 * Home Header - User greeting and settings button
 */
import Settings from 'lucide-react/dist/esm/icons/settings'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../../lib/current-user'
import { getInitial, currentYear } from './constants'

export function HomeHeader() {
	const navigate = useNavigate()
	const { data: user, isLoading } = useQuery({
		queryKey: ['current-user'],
		queryFn: getCurrentUser,
		staleTime: 1000 * 60 * 30, // 30 mins
	})

	const username = user?.username || 'Usuario'
	const avatarUrl = user?.avatarUrl

	if (isLoading) {
		return (
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<div className="h-[52px] w-[52px] rounded-xl bg-muted animate-pulse" />
					<div className="space-y-2">
						<div className="h-6 w-40 bg-muted rounded animate-pulse" />
						<div className="h-4 w-48 bg-muted rounded animate-pulse" />
					</div>
				</div>
				<div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
			</div>
		)
	}

	return (
		<div className="reveal reveal-d1 flex items-end justify-between">
			<div className="flex items-center gap-4">
				<div className="glint-border h-[52px] w-[52px] rounded-xl bg-card shadow-rest flex items-center justify-center overflow-hidden">
					{avatarUrl ? (
						<img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
					) : (
						<span className="font-display text-xl font-bold text-primary">{getInitial(username)}</span>
					)}
				</div>
				<div>
					<h1 className="text-2xl font-bold text-foreground">
						Hola, <span className="text-primary">{username}</span>
					</h1>
					<p className="text-muted-foreground text-sm mt-0.5">Tu actividad en Mediavida</p>
				</div>
			</div>

			<div className="flex items-center gap-4">
				<div className="hidden sm:block text-right">
					<span className="font-data text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
						Resumen anual
					</span>
					<span className="block font-data text-sm font-semibold text-foreground tracking-wide">{currentYear}</span>
				</div>
				<button
					onClick={() => navigate('/settings')}
					className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
				>
					<Settings className="h-5 w-5" />
				</button>
			</div>
		</div>
	)
}
