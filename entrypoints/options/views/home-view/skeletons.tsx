/**
 * Home View - Skeleton components for loading states
 */
import { ActivityGraphSkeleton } from '@/features/stats'

export function TopSubforumsSkeleton() {
	return (
		<div className="bg-card border border-border rounded-xl p-5 h-full animate-pulse">
			<div className="flex items-center gap-2 mb-6">
				<div className="h-4 w-4 bg-muted rounded-full" />
				<div className="h-4 w-32 bg-muted rounded" />
			</div>
			<div className="space-y-6">
				{Array.from({ length: 5 }).map((_, i) => (
					<div key={i}>
						<div className="flex justify-between mb-2">
							<div className="flex items-center gap-2">
								<div className="h-3 w-4 bg-muted rounded" />
								<div className="h-4 w-24 bg-muted rounded" />
							</div>
							<div className="h-3 w-12 bg-muted rounded" />
						</div>
						<div className="h-1.5 w-full bg-secondary rounded-full" />
					</div>
				))}
			</div>
		</div>
	)
}

export function StorageStatsSkeleton() {
	return (
		<div className="bg-card border border-border rounded-xl p-5 h-full animate-pulse flex flex-col">
			<div className="flex items-center gap-2 mb-6">
				<div className="h-4 w-4 bg-muted rounded-full" />
				<div className="h-4 w-40 bg-muted rounded" />
			</div>
			<div className="flex-1 flex flex-col justify-center gap-8">
				<div className="space-y-3">
					<div className="flex justify-between">
						<div className="h-3 w-20 bg-muted rounded" />
						<div className="h-3 w-24 bg-muted rounded" />
					</div>
					<div className="h-3 w-full bg-secondary rounded-full" />
					<div className="h-2 w-16 ml-auto bg-muted rounded" />
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="h-16 bg-muted/50 rounded-lg border border-border/50" />
					<div className="h-16 bg-muted/50 rounded-lg border border-border/50" />
				</div>
				<div className="h-8 w-full bg-muted/30 rounded-lg mt-2" />
			</div>
		</div>
	)
}

export function HomeSkeleton() {
	return (
		<div className="space-y-6 pb-10">
			{/* Header Skeleton */}
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

			{/* Stats Grid Skeleton */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{[1, 2, 3].map(i => (
					<div key={i} className="rounded-xl bg-card border border-border p-5 h-28 animate-pulse relative overflow-hidden">
						<div className="space-y-3">
							<div className="h-3 w-16 bg-muted rounded" />
							<div className="h-8 w-12 bg-muted rounded" />
							<div className="h-3 w-24 bg-muted rounded" />
						</div>
					</div>
				))}
			</div>

			{/* Activity Graph Skeleton */}
			<ActivityGraphSkeleton />

			{/* Secondary Grid Skeletons */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[350px]">
				<TopSubforumsSkeleton />
				<StorageStatsSkeleton />
			</div>
		</div>
	)
}

export function WidgetsSkeleton() {
	return (
		<div className="space-y-6">
			{/* Stats Grid Skeleton */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{[1, 2, 3].map(i => (
					<div key={i} className="rounded-xl bg-card border border-border p-5 h-28 animate-pulse relative overflow-hidden">
						<div className="space-y-3">
							<div className="h-3 w-16 bg-muted rounded" />
							<div className="h-8 w-12 bg-muted rounded" />
							<div className="h-3 w-24 bg-muted rounded" />
						</div>
					</div>
				))}
			</div>

			{/* Activity Graph Skeleton */}
			<ActivityGraphSkeleton />

			{/* Secondary Grid Skeletons */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[350px]">
				<TopSubforumsSkeleton />
				<StorageStatsSkeleton />
			</div>
		</div>
	)
}
