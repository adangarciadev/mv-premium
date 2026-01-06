import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// Extension data is local, so we can keep it fresh but check often if needed
			// But for dashboard, maybe default staleTime
			staleTime: 1000 * 60 * 5, // 5 minutes
			retry: false,
		},
	},
})
