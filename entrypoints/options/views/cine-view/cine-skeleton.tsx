/**
 * Holds the shape of the wall while storage answers. The poster grid is the part that costs
 * layout, so it is the part the placeholder reproduces — a spinner here would just move the
 * page twice.
 */
export function CineSkeleton() {
	return (
		<div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando tus críticas">
			<div className="cine-hero flex flex-col gap-7 border border-border p-6 sm:p-8">
				<div className="flex items-start justify-between gap-4">
					<div className="h-9 w-52 animate-pulse rounded-md bg-muted" />
					<div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
				</div>
				<div className="flex flex-col gap-3">
					<div className="h-6 w-full max-w-[36rem] animate-pulse rounded bg-muted" />
					<div className="h-6 w-full max-w-[24rem] animate-pulse rounded bg-muted" />
				</div>
				<div className="h-5 w-full max-w-[20rem] animate-pulse rounded bg-muted" />
			</div>

			<div className="flex gap-2">
				<div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
				<div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
			</div>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				{Array.from({ length: 10 }, (_, index) => (
					<div key={index} className="flex flex-col gap-2">
						<div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-muted" />
						<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
						<div className="h-3 w-10 animate-pulse rounded bg-muted" />
					</div>
				))}
			</div>
		</div>
	)
}
