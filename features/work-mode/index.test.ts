import { describe, it, expect } from 'vitest'
import { buildWorkModeCSS } from './index'
import type { WorkModeOptions } from '@/store/settings-types'

const ALL_ON: WorkModeOptions = {
	hideAvatars: true,
	hideImages: true,
	hideVideos: true,
	hideSocialEmbeds: true,
	hideSteamCards: true,
	hideForumIcons: true,
	disguiseTab: true,
}

const ALL_OFF: WorkModeOptions = {
	hideAvatars: false,
	hideImages: false,
	hideVideos: false,
	hideSocialEmbeds: false,
	hideSteamCards: false,
	hideForumIcons: false,
	disguiseTab: false,
}

describe('buildWorkModeCSS', () => {
	it('returns empty string when all options are off', () => {
		expect(buildWorkModeCSS(ALL_OFF)).toBe('')
	})

	it('returns CSS with all sections when all options are on', () => {
		const css = buildWorkModeCSS(ALL_ON)
		expect(css).toContain('MVP Work Mode')
		expect(css).toContain('.post-avatar img')
		expect(css).toContain('a.img-zoom')
		expect(css).toContain('data-s9e-mediaembed="youtube"')
		expect(css).toContain('.mvp-twitter-lite-card')
		expect(css).toContain('data-mvp-steam-bundle-card')
		expect(css).toContain('i.fid')
	})

	it('only includes avatar CSS when hideAvatars is true', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideAvatars: true })
		expect(css).toContain('.post-avatar img')
		expect(css).toContain('.post-avatar-reply img')
		expect(css).toContain('.post-avatar .letter')
		expect(css).toContain('.avatar-list img')
		expect(css).toContain('.avatar-list .letter')
		expect(css).toContain('.col-av img')
		expect(css).toContain('.col-av .letter')
		expect(css).toContain('#usermenu .avw img')
		expect(css).toContain('.m-btn.m-nav-user img')
		expect(css).toContain('#cover .user-avatar img')
		expect(css).toContain('.group-list img')
		expect(css).toContain('.firma-avatar img')
		expect(css).toContain('.firma-avatar .letter')
		expect(css).not.toContain('a.img-zoom')
		expect(css).not.toContain('youtube')
		expect(css).not.toContain('steam')
	})

	it('only includes image CSS when hideImages is true', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideImages: true })
		expect(css).toContain('a.img-zoom')
		expect(css).toContain('.c-side img.itemimg')
		expect(css).toContain('.c-side .featured-side img')
		expect(css).toContain('.news-media img')
		expect(css).toContain('.group-avatar-new img')
		expect(css).toContain('.news-media div')
		expect(css).toContain('#social')
		expect(css).toContain('#splash-3 .splash')
		expect(css).toContain('background-image: none !important')
		expect(css).not.toContain('.post-avatar img')
		expect(css).not.toContain('youtube')
	})

	it('only includes video CSS when hideVideos is true', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideVideos: true })
		expect(css).toContain('data-s9e-mediaembed="youtube"')
		expect(css).toContain('.youtube_lite')
		expect(css).toContain('.post-contents video')
		expect(css).not.toContain('.post-avatar img')
		// Social embed selectors should not appear as standalone hide rules
		expect(css).not.toContain('.mvp-twitter-lite-card')
	})

	it('only includes social embed CSS when hideSocialEmbeds is true', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideSocialEmbeds: true })
		expect(css).toContain('data-s9e-mediaembed="twitter"')
		expect(css).toContain('data-s9e-mediaembed="instagram"')
		expect(css).toContain('data-s9e-mediaembed="reddit"')
		expect(css).toContain('data-s9e-mediaembed="tiktok"')
		expect(css).toContain('data-s9e-mediaembed="facebook"')
		expect(css).toContain('data-s9e-mediaembed="bluesky"')
		expect(css).toContain('.mvp-twitter-lite-card')
		expect(css).not.toContain('.post-avatar img')
		expect(css).not.toContain('youtube')
	})

	it('only includes steam CSS when hideSteamCards is true', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideSteamCards: true })
		expect(css).toContain('data-mvp-steam-bundle-card')
		expect(css).toContain('.steam-embed-placeholder')
		expect(css).not.toContain('.post-avatar img')
		expect(css).not.toContain('youtube')
	})

	it('combines avatars + videos without affecting other sections', () => {
		const css = buildWorkModeCSS({
			hideAvatars: true,
			hideImages: false,
			hideVideos: true,
			hideSocialEmbeds: false,
			hideSteamCards: false,
			hideForumIcons: false,
			disguiseTab: false,
		})
		expect(css).toContain('.post-avatar img')
		expect(css).toContain('data-s9e-mediaembed="youtube"')
		expect(css).not.toContain('a.img-zoom')
		expect(css).not.toContain('.mvp-twitter-lite-card')
		expect(css).not.toContain('data-mvp-steam-bundle-card')
	})

	it('uses display: none !important for hiding rules', () => {
		const css = buildWorkModeCSS(ALL_ON)
		const displayNoneCount = (css.match(/display:\s*none\s*!important/g) || []).length
		expect(displayNoneCount).toBeGreaterThanOrEqual(4)
	})

	it('uses visibility: hidden for avatars to preserve layout', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideAvatars: true })
		expect(css).toContain('visibility: hidden !important')
		expect(css).not.toContain('display: none')
	})

	it('video section excludes social embeds with :not() selectors', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideVideos: true })
		// The .embed.r16-9 rule should exclude social embed types
		expect(css).toContain(':not([data-s9e-mediaembed="twitter"])')
		expect(css).toContain(':not([data-s9e-mediaembed="instagram"])')
	})

	it('social embeds section includes all 6 social platforms', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideSocialEmbeds: true })
		const platforms = ['twitter', 'instagram', 'reddit', 'tiktok', 'facebook', 'bluesky']
		for (const platform of platforms) {
			expect(css).toContain(`data-s9e-mediaembed="${platform}"`)
		}
	})

	it('only includes forum icon CSS when hideForumIcons is true', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideForumIcons: true })
		expect(css).toContain('i.fid')
		expect(css).not.toContain('.post-avatar img')
		expect(css).not.toContain('a.img-zoom')
		expect(css).not.toContain('youtube')
	})

	it('images section excludes smileys, emojis, and system images', () => {
		const css = buildWorkModeCSS({ ...ALL_OFF, hideImages: true })
		expect(css).toContain(':not(.emoji)')
		expect(css).toContain(':not([src*="/smileys/"])')
		expect(css).toContain(':not([src*="/emoji/"])')
		expect(css).toContain(':not([src*="/style/img/"])')
	})
})
