/**
 * TanStack Query Configuration
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// Extend TanStack Query meta types
interface QueryMeta extends Record<string, unknown> {
	/** Si es true, muestra un toast en caso de error */
	toast?: boolean
	/** Mensaje personalizado para el error */
	errorMessage?: string
	/** Custom success message (mutations only) */
	successMessage?: string
}

declare module '@tanstack/react-query' {
	interface Register {
		queryMeta: QueryMeta
		mutationMeta: QueryMeta
	}
}

/**
 * Default QueryClient
 */
export const queryClient = new QueryClient({
	// 1. Manejo global de errores de lectura (GET)
	queryCache: new QueryCache({
		onError: (error, query) => {
			if (!query.meta?.toast) return
			const message = query.meta.errorMessage || error.message || 'Error al cargar datos'
			toast.error(message)
		},
	}),

	// 2. Global mutation handling (POST/PUT/DELETE)
	mutationCache: new MutationCache({
		onError: (error, variables, context, mutation) => {
			// By default mutations DO show errors, unless meta.toast is explicitly false
			if (mutation.meta?.toast === false) return

			const message = mutation.meta?.errorMessage || error.message || 'Error al guardar'
			toast.error(message)
		},
		onSuccess: (data, variables, context, mutation) => {
			// Optional: Automatic success toast if defined in meta
			if (mutation.meta?.successMessage) {
				toast.success(mutation.meta.successMessage)
			}
		},
	}),

	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
		},
		// Removed onError from here because mutationCache now handles it more powerfully
	},
})
