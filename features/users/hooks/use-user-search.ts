// features/users/hooks/use-user-search.ts
import { useQuery } from '@tanstack/react-query'
import { getSearchUsers, type SearchedUser } from '../lib/mv-users'
import { userKeys } from '@/services/api/query-keys'

/**
 * Hook for searching Mediavida users with a debounced query.
 * Leverages TanStack Query for caching and efficient state management.
 * @param username - The partial username to search for
 */
export function useUserSearch(username: string) {
	const { data, isLoading, isFetched, error } = useQuery({
		queryKey: userKeys.search(username),
		queryFn: () => getSearchUsers(username),
		enabled: username.length >= 3, // Only search with 3+ chars (MV min username length)
		staleTime: 1000 * 60 * 5, // Cache for 5 minutes
	})

	return {
		users: data ?? [],
		isLoading,
		isFetched,
		error,
	}
}

export type { SearchedUser }
