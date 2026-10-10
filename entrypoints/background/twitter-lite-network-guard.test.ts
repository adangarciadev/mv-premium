import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupTwitterLiteNetworkGuard } from './twitter-lite-network-guard'

const mocks = vi.hoisted(() => ({
	platform: vi.fn(() => 'firefox-android'),
	getValue: vi.fn(),
	watch: vi.fn(),
	updateDynamicRules: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/platform', () => ({ getPlatformKind: mocks.platform }))
vi.mock('#imports', () => ({ storage: { defineItem: () => ({ getValue: mocks.getValue, watch: mocks.watch }) } }))
vi.mock('wxt/browser', () => ({ browser: { declarativeNetRequest: { updateDynamicRules: mocks.updateDynamicRules } } }))

describe('Twitter Lite network guard on mobile', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.platform.mockReturnValue('firefox-android')
		mocks.getValue.mockResolvedValue(null)
	})

	it.each([
		[true, true, true],
		[true, false, false],
		[false, true, false],
		[false, false, false],
	])('Twitter Lite=%s and Mobile Lite=%s: blocking=%s', async (twitterLiteEmbedsEnabled, mobileLiteEnabled, blocks) => {
		mocks.getValue.mockResolvedValue(JSON.stringify({ state: { twitterLiteEmbedsEnabled, mobileLiteEnabled } }))
		setupTwitterLiteNetworkGuard()
		await vi.waitFor(() => expect(mocks.updateDynamicRules).toHaveBeenCalledOnce())
		const rules = mocks.updateDynamicRules.mock.calls[0] as unknown as [{ addRules?: unknown[] }]
		expect(rules[0].addRules?.length ?? 0).toBe(blocks ? 3 : 0)
	})

	it('preserves desktop blocking without requiring Mobile Lite', async () => {
		mocks.platform.mockReturnValue('firefox-desktop')
		mocks.getValue.mockResolvedValue(JSON.stringify({ state: { twitterLiteEmbedsEnabled: true } }))
		setupTwitterLiteNetworkGuard()
		await vi.waitFor(() => expect(mocks.updateDynamicRules).toHaveBeenCalledWith(expect.objectContaining({ addRules: expect.any(Array) })))
	})

	it('removes mobile rules when Mobile Lite is disabled after startup', async () => {
		mocks.getValue.mockResolvedValue(JSON.stringify({ state: { twitterLiteEmbedsEnabled: true, mobileLiteEnabled: true } }))
		setupTwitterLiteNetworkGuard()
		await vi.waitFor(() => expect(mocks.updateDynamicRules).toHaveBeenCalledOnce())
		mocks.watch.mock.calls[0][0](JSON.stringify({ state: { twitterLiteEmbedsEnabled: true, mobileLiteEnabled: false } }))
		await vi.waitFor(() => expect(mocks.updateDynamicRules).toHaveBeenLastCalledWith({ removeRuleIds: [61001, 61002, 61003] }))
	})

	it.each([null, 'invalid json', 'null'])('removes stale rules for missing or invalid settings: %s', async raw => {
		mocks.getValue.mockResolvedValue(raw)
		setupTwitterLiteNetworkGuard()
		await vi.waitFor(() => expect(mocks.updateDynamicRules).toHaveBeenCalledWith({ removeRuleIds: [61001, 61002, 61003] }))
	})
})
