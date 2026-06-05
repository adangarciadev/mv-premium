import { describe, expect, it } from 'vitest'
import { detectPlatform } from './platform'

describe('detectPlatform', () => {
	it('detects Firefox Desktop', () => {
		expect(
			detectPlatform({
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
			})
		).toBe('firefox-desktop')
	})

	it('detects Firefox Android', () => {
		expect(
			detectPlatform({
				userAgent: 'Mozilla/5.0 (Android 15; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0',
			})
		).toBe('firefox-android')
	})

	it('detects Firefox Android from userAgentData platform', () => {
		expect(
			detectPlatform({
				userAgent: 'Mozilla/5.0 (Mobile; rv:145.0) Gecko/145.0 Firefox/145.0',
				userAgentDataPlatform: 'Android',
			})
		).toBe('firefox-android')
	})

	it('detects Chrome Desktop', () => {
		expect(
			detectPlatform({
				userAgent:
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
			})
		).toBe('chrome-desktop')
	})

	it('classifies Chrome Android as other', () => {
		expect(
			detectPlatform({
				userAgent:
					'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36',
			})
		).toBe('other')
	})

	it('classifies Chromium forks and unknown browsers as other', () => {
		expect(
			detectPlatform({
				userAgent:
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0',
			})
		).toBe('other')

		expect(detectPlatform({ userAgent: '' })).toBe('other')
	})
})
