export type PlatformKind = 'firefox-desktop' | 'firefox-android' | 'chrome-desktop' | 'other'

interface PlatformDetectionInput {
	userAgent?: string
	userAgentDataPlatform?: string
}

function includesToken(value: string, token: string): boolean {
	return value.toLowerCase().includes(token.toLowerCase())
}

export function detectPlatform(input: PlatformDetectionInput = {}): PlatformKind {
	const userAgent = input.userAgent ?? ''
	const platform = input.userAgentDataPlatform ?? ''
	const isAndroid = includesToken(userAgent, 'Android') || includesToken(platform, 'Android')
	const isFirefox = /\bFirefox\//i.test(userAgent)

	if (isFirefox && isAndroid) {
		return 'firefox-android'
	}

	if (isFirefox) {
		return 'firefox-desktop'
	}

	const isChrome = /\b(?:Chrome|Chromium)\//i.test(userAgent)
	const isKnownChromiumFork = /\b(?:Edg|OPR|Opera|Vivaldi)\//i.test(userAgent)
	if (isChrome && !isAndroid && !isKnownChromiumFork) {
		return 'chrome-desktop'
	}

	return 'other'
}

export function getPlatformKind(): PlatformKind {
	const nav = globalThis.navigator as Navigator & {
		userAgentData?: {
			platform?: string
		}
	}

	return detectPlatform({
		userAgent: nav.userAgent,
		userAgentDataPlatform: nav.userAgentData?.platform,
	})
}

export function isFirefoxAndroidRuntime(): boolean {
	return getPlatformKind() === 'firefox-android'
}
