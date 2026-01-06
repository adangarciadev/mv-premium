/**
 * API Types - TMDB and External Services
 */

// TMDB Movie Types
export interface TMDBMovie {
	id: number
	title: string
	original_title: string
	overview: string
	poster_path: string | null
	backdrop_path: string | null
	release_date: string
	vote_average: number
	genre_ids: number[]
}

export interface TMDBMovieDetails extends TMDBMovie {
	runtime: number
	tagline: string
	genres: { id: number; name: string }[]
	production_countries: { iso_3166_1: string; name: string }[]
}

export interface TMDBCredits {
	cast: {
		id: number
		name: string
		character: string
		order: number
	}[]
	crew: {
		id: number
		name: string
		job: string
		department: string
	}[]
}

export interface TMDBVideos {
	results: {
		id: string
		key: string
		name: string
		site: string
		type: string
	}[]
}

export interface TMDBReleaseDates {
	results: {
		iso_3166_1: string
		release_dates: {
			certification: string
			release_date: string
			type: number
		}[]
	}[]
}

export interface TMDBSearchResult<T = TMDBMovie> {
	page: number
	results: T[]
	total_pages: number
	total_results: number
}

export interface TMDBPerson {
	id: number
	name: string
	profile_path: string | null
	known_for_department: string
	known_for: TMDBMovie[]
}

export interface TMDBPersonDetails extends TMDBPerson {
	biography: string
	birthday: string | null
	place_of_birth: string | null
	popularity: number
}

// TMDB TV Show Types
export interface TMDBTVShow {
	id: number
	name: string
	original_name: string
	overview: string
	poster_path: string | null
	backdrop_path: string | null
	first_air_date: string
	vote_average: number
	genre_ids: number[]
	origin_country: string[]
}

export interface TMDBTVShowDetails extends TMDBTVShow {
	tagline: string
	genres: { id: number; name: string }[]
	number_of_seasons: number
	number_of_episodes: number
	episode_run_time: number[]
	status: string // "Returning Series", "Ended", "Canceled", etc.
	type: string // "Scripted", "Documentary", "Miniseries", etc.
	networks: { id: number; name: string; logo_path: string | null }[]
	created_by: { id: number; name: string; profile_path: string | null }[]
	seasons: {
		id: number
		name: string
		season_number: number
		episode_count: number
		air_date: string | null
		poster_path: string | null
	}[]
	last_air_date: string | null
	in_production: boolean
	production_countries: { iso_3166_1: string; name: string }[]
}

// TMDB Season Details (for individual season requests)
export interface TMDBSeasonDetails {
	_id: string
	id: number
	name: string
	overview: string
	poster_path: string | null
	season_number: number
	air_date: string | null
	vote_average: number
	episodes: {
		id: number
		name: string
		overview: string
		episode_number: number
		air_date: string
		still_path: string | null
		vote_average: number
		runtime: number | null
	}[]
}

// ImgBB Types
export interface ImgBBUploadResponse {
	success: boolean
	data: {
		id: string
		url: string
		delete_url: string
		display_url: string
		size: number
		time: number
		image: {
			filename: string
			name: string
			mime: string
			extension: string
			url: string
		}
	}
}
