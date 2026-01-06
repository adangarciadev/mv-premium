/**
 * Query Key Factories
 * Centralized query key management for TanStack Query
 *
 * Usage:
 * - Use these factories for all useQuery/useMutation calls
 * - Import from '@/services/api/query-keys'
 * - Ensures consistent keys across the app for proper cache invalidation
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys#use-query-key-factories
 */

// =============================================================================
// TMDB KEYS
// =============================================================================

export const tmdbKeys = {
	all: ['tmdb'] as const,

	// Movies
	movies: () => [...tmdbKeys.all, 'movies'] as const,
	movie: (id: number) => [...tmdbKeys.movies(), id] as const,
	movieDetails: (id: number) => [...tmdbKeys.movie(id), 'details'] as const,
	movieCredits: (id: number) => [...tmdbKeys.movie(id), 'credits'] as const,
	movieVideos: (id: number) => [...tmdbKeys.movie(id), 'videos'] as const,
	movieReleaseDates: (id: number) => [...tmdbKeys.movie(id), 'releaseDates'] as const,
	movieTemplate: (id: number) => [...tmdbKeys.movie(id), 'template'] as const,
	search: (query: string) => [...tmdbKeys.movies(), 'search', query] as const,
	upcoming: (page: number) => [...tmdbKeys.movies(), 'upcoming', page] as const,
	nowPlaying: (page: number) => [...tmdbKeys.movies(), 'nowPlaying', page] as const,

	// People
	people: () => [...tmdbKeys.all, 'people'] as const,
	person: (id: number) => [...tmdbKeys.people(), id] as const,
	personSearch: (query: string) => [...tmdbKeys.people(), 'search', query] as const,
}

// =============================================================================
// MEDIA RESOLVER KEYS (TMDB/IMDb unified)
// =============================================================================

export const resolverKeys = {
	all: ['resolver'] as const,
	url: (url: string) => [...resolverKeys.all, 'url', url] as const,
}

// =============================================================================
// IMGBB KEYS
// =============================================================================

export const imgbbKeys = {
	all: ['imgbb'] as const,
	uploads: () => [...imgbbKeys.all, 'uploads'] as const,
	stats: () => [...imgbbKeys.all, 'stats'] as const,
	recentUploads: () => [...imgbbKeys.all, 'recentUploads'] as const,
}

// =============================================================================
// STORAGE KEYS (for features using browser.storage)
// =============================================================================

export const storageKeys = {
	all: ['storage'] as const,

	// Drafts
	drafts: () => [...storageKeys.all, 'drafts'] as const,
	draft: (id: string) => [...storageKeys.drafts(), id] as const,

	// Pinned Posts
	pinnedPosts: () => [...storageKeys.all, 'pinnedPosts'] as const,
	pinnedPostsByThread: (threadId: string) => [...storageKeys.pinnedPosts(), 'thread', threadId] as const,

	// Favorite Subforums
	favoriteSubforums: () => [...storageKeys.all, 'favoriteSubforums'] as const,

	// Saved Threads
	savedThreads: () => [...storageKeys.all, 'savedThreads'] as const,

	// User Customizations
	userCustomizations: () => [...storageKeys.all, 'userCustomizations'] as const,

	// Bookmarks
	bookmarks: () => [...storageKeys.all, 'bookmarks'] as const,

	// Muted Words
	mutedWords: () => [...storageKeys.all, 'mutedWords'] as const,
}

// =============================================================================
// GIPHY KEYS
// =============================================================================

export const gifKeys = {
	all: ['gifs'] as const,
	search: (query: string) => [...gifKeys.all, query] as const,
	trending: () => [...gifKeys.all, 'trending'] as const,
}

// =============================================================================
// MEDIAVIDA USER KEYS
// =============================================================================

export const userKeys = {
	all: ['mv-users'] as const,
	search: (username: string) => [...userKeys.all, 'search', username] as const,
	profile: (username: string) => [...userKeys.all, 'profile', username] as const,
}
