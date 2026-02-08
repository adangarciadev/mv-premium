import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LiteAppProvider } from '@/providers/lite-app-provider'
import type { PropsWithChildren } from 'react'

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30 * 1000,
			retry: 1,
		},
	},
})

export function HomepageProvider({ children }: PropsWithChildren) {
	return (
		<LiteAppProvider darkMode={true}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</LiteAppProvider>
	)
}
