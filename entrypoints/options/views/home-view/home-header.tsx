/**
 * Home Header - User greeting and settings button
 */
import Settings from 'lucide-react/dist/esm/icons/settings'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../../lib/current-user'
import { getInitial } from './constants'

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
					<div className="h-12 w-12 rounded-lg bg-muted animate-pulse" />
					<div className="space-y-2">
						<div className="h-5 w-32 bg-muted rounded animate-pulse" />
						<div className="h-4 w-48 bg-muted rounded animate-pulse" />
					</div>
				</div>
				<div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
			</div>
		)
	}

	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-4">
				<div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden ring-2 ring-primary/20">
					{avatarUrl ? (
						<img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
					) : (
						<span className="text-lg font-bold text-primary">{getInitial(username)}</span>
					)}
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight text-foreground">Hola, {username}</h1>
					<p className="text-muted-foreground text-sm">Tu actividad en Mediavida</p>
				</div>
			</div>

			<button
				onClick={() => navigate('/settings')}
				className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
			>
				<Settings className="h-5 w-5" />
			</button>
		</div>
	)
}
