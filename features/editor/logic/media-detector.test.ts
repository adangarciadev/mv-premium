/**
 * Tests for Media URL Detector
 *
 * Tests media URL detection for YouTube, Twitter, Steam, etc.
 */
import { describe, it, expect } from 'vitest'
import { isMediaUrl, getMediaType, normalizeMediaUrl } from './media-detector'

describe('media-detector', () => {
	describe('isMediaUrl', () => {
		describe('YouTube', () => {
			it('should detect youtube.com/watch URLs', () => {
				expect(isMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
				expect(isMediaUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
			})

			it('should detect youtu.be short URLs', () => {
				expect(isMediaUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
			})

			it('should detect YouTube Shorts', () => {
				expect(isMediaUrl('https://youtube.com/shorts/abc123')).toBe(true)
			})
		})

		describe('Twitter/X', () => {
			it('should detect twitter.com status URLs', () => {
				expect(isMediaUrl('https://twitter.com/user/status/123456789')).toBe(true)
			})

			it('should detect x.com status URLs', () => {
				expect(isMediaUrl('https://x.com/user/status/123456789')).toBe(true)
			})
		})

		describe('Instagram', () => {
			it('should detect Instagram post URLs', () => {
				expect(isMediaUrl('https://www.instagram.com/p/ABC123xyz/')).toBe(true)
			})

			it('should detect Instagram reel URLs', () => {
				expect(isMediaUrl('https://www.instagram.com/reel/ABC123xyz/')).toBe(true)
			})

			it('should detect Instagram TV URLs', () => {
				expect(isMediaUrl('https://www.instagram.com/tv/ABC123xyz/')).toBe(true)
			})
		})

		describe('Steam', () => {
			it('should detect Steam store URLs', () => {
				expect(isMediaUrl('https://store.steampowered.com/app/440')).toBe(true)
				expect(isMediaUrl('https://store.steampowered.com/app/570/Dota_2/')).toBe(true)
			})
		})

		describe('Amazon', () => {
			it('should detect Amazon.es product URLs', () => {
				expect(isMediaUrl('https://www.amazon.es/Product-Name/dp/B08N5WRWNW')).toBe(true)
			})

			it('should detect Amazon.com product URLs', () => {
				expect(isMediaUrl('https://www.amazon.com/Product-Name/gp/product/B08N5WRWNW')).toBe(true)
			})
		})

		describe('Twitch', () => {
			it('should detect Twitch clip URLs', () => {
				expect(isMediaUrl('https://twitch.tv/streamer/clip/ClipName')).toBe(true)
				expect(isMediaUrl('https://clips.twitch.tv/ClipName')).toBe(true)
			})

			it('should detect Twitch video URLs', () => {
				expect(isMediaUrl('https://www.twitch.tv/videos/123456789')).toBe(true)
			})
		})

		describe('Spotify', () => {
			it('should detect Spotify track URLs', () => {
				expect(isMediaUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe(true)
			})

			it('should detect Spotify album URLs', () => {
				expect(isMediaUrl('https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT')).toBe(true)
			})

			it('should detect Spotify playlist URLs', () => {
				expect(isMediaUrl('https://open.spotify.com/playlist/4cOdK2wGLETKBW3PvgPWqT')).toBe(true)
			})
		})

		describe('TikTok', () => {
			it('should detect TikTok video URLs', () => {
				expect(isMediaUrl('https://www.tiktok.com/@user/video/1234567890')).toBe(true)
			})

			it('should detect TikTok short URLs', () => {
				expect(isMediaUrl('https://vm.tiktok.com/abc123')).toBe(true)
			})
		})

		describe('Vimeo', () => {
			it('should detect Vimeo video URLs', () => {
				expect(isMediaUrl('https://vimeo.com/123456789')).toBe(true)
			})
		})

		describe('Streamable', () => {
			it('should detect Streamable URLs', () => {
				expect(isMediaUrl('https://streamable.com/abc123')).toBe(true)
			})
		})

		describe('edge cases', () => {
			it('should return false for non-media URLs', () => {
				expect(isMediaUrl('https://example.com')).toBe(false)
				expect(isMediaUrl('https://google.com')).toBe(false)
			})

			it('should return false for image URLs', () => {
				expect(isMediaUrl('https://example.com/image.jpg')).toBe(false)
			})

			it('should return false for invalid URLs', () => {
				expect(isMediaUrl('not-a-url')).toBe(false)
				expect(isMediaUrl('')).toBe(false)
			})
		})
	})

	describe('getMediaType', () => {
		it('should return youtube for YouTube URLs', () => {
			expect(getMediaType('https://www.youtube.com/watch?v=abc')).toBe('youtube')
		})

		it('should return twitter for Twitter/X URLs', () => {
			expect(getMediaType('https://twitter.com/user/status/123')).toBe('twitter')
			expect(getMediaType('https://x.com/user/status/123')).toBe('twitter')
		})

		it('should return steam for Steam URLs', () => {
			expect(getMediaType('https://store.steampowered.com/app/440')).toBe('steam')
		})

		it('should return spotify for Spotify URLs', () => {
			expect(getMediaType('https://open.spotify.com/track/abc')).toBe('spotify')
		})

		it('should return null for non-media URLs', () => {
			expect(getMediaType('https://example.com')).toBe(null)
		})

		it('should return null for invalid URLs', () => {
			expect(getMediaType('not-a-url')).toBe(null)
		})
	})

	describe('normalizeMediaUrl', () => {
		describe('YouTube Shorts', () => {
			it('should convert YouTube Shorts URL to /v/ format', () => {
				expect(normalizeMediaUrl('https://www.youtube.com/shorts/yfxNZSRj3E8'))
					.toBe('https://www.youtube.com/v/yfxNZSRj3E8')
			})

			it('should handle YouTube Shorts without www', () => {
				expect(normalizeMediaUrl('https://youtube.com/shorts/abc123'))
					.toBe('https://youtube.com/v/abc123')
			})

			it('should handle http protocol', () => {
				expect(normalizeMediaUrl('http://youtube.com/shorts/xyz789'))
					.toBe('http://youtube.com/v/xyz789')
			})

			it('should handle video IDs with hyphens and underscores', () => {
				expect(normalizeMediaUrl('https://youtube.com/shorts/ab-cd_ef'))
					.toBe('https://youtube.com/v/ab-cd_ef')
			})
		})

		describe('non-Shorts URLs', () => {
			it('should not modify regular YouTube watch URLs', () => {
				const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
				expect(normalizeMediaUrl(url)).toBe(url)
			})

			it('should not modify youtu.be URLs', () => {
				const url = 'https://youtu.be/dQw4w9WgXcQ'
				expect(normalizeMediaUrl(url)).toBe(url)
			})

			it('should not modify non-YouTube URLs', () => {
				const url = 'https://twitter.com/user/status/123'
				expect(normalizeMediaUrl(url)).toBe(url)
			})
		})

		describe('edge cases', () => {
			it('should trim whitespace', () => {
				expect(normalizeMediaUrl('  https://youtube.com/shorts/abc123  '))
					.toBe('https://youtube.com/v/abc123')
			})

			it('should return original URL if invalid', () => {
				expect(normalizeMediaUrl('not-a-url')).toBe('not-a-url')
			})

			it('should return empty string if empty', () => {
				expect(normalizeMediaUrl('')).toBe('')
			})
		})
	})
})

