/**
 * Hook to fetch media data from TMDB/IMDb URLs
 */
import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'
import { resolveUrl, type MediaData } from '@/services/media/unified-resolver'

interface UseMediaDataResult {
	data: MediaData | null
	isLoading: boolean
	error: string | null
}

export function useMediaData(url: string): UseMediaDataResult {
	const [data, setData] = useState<MediaData | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false

		async function fetchData() {
			setIsLoading(true)
			setError(null)

			try {
				const result = await resolveUrl(url)
				if (cancelled) return

				if (result) {
					setData(result)
				} else {
					setError('No se pudo obtener información')
				}
			} catch (err) {
				if (cancelled) return
				setError('Error al cargar datos')
				logger.error('Error fetching media data:', err)
			} finally {
				if (!cancelled) {
					setIsLoading(false)
				}
			}
		}

		fetchData()

		return () => {
			cancelled = true
		}
	}, [url])

	return { data, isLoading, error }
}
