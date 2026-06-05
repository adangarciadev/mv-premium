const ENABLE_VALUE = 'enable'
const DISABLE_VALUE = 'disable'
const MOBILE_LITE_QUERY_PARAM = 'mvp_mobile_lite'

export type MobileLiteDevActivation = 'enable' | 'disable'

function readActivationValue(params: URLSearchParams): MobileLiteDevActivation | null {
	const value = params.get(MOBILE_LITE_QUERY_PARAM)

	if (value === ENABLE_VALUE || value === DISABLE_VALUE) {
		return value
	}

	return null
}

export function getMobileLiteDevActivation(search: string, hash = ''): MobileLiteDevActivation | null {
	const params = new URLSearchParams(search)
	const queryActivation = readActivationValue(params)

	if (queryActivation) {
		return queryActivation
	}

	const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
	return readActivationValue(hashParams)
}

export function getUrlWithoutMobileLiteDevParam(url: string): string {
	const parsed = new URL(url)
	parsed.searchParams.delete(MOBILE_LITE_QUERY_PARAM)
	const search = parsed.searchParams.toString()
	const hashValue = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
	const hashParams = new URLSearchParams(hashValue)
	const hash = hashParams.has(MOBILE_LITE_QUERY_PARAM)
		? (() => {
				hashParams.delete(MOBILE_LITE_QUERY_PARAM)
				const nextHash = hashParams.toString()
				return nextHash ? `#${nextHash}` : ''
			})()
		: parsed.hash
	return `${parsed.pathname}${search ? `?${search}` : ''}${hash}`
}
