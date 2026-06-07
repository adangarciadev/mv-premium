import { describe, expect, it } from 'vitest'
import {
	classifyUploadError,
	getUploadErrorUserMessage,
} from './upload-errors'

describe('upload-errors', () => {
	it('classifies rate limits from HTTP 429 and response text', () => {
		expect(classifyUploadError({ status: 429, provider: 'freeimage' })).toBe('rate_limit')
		expect(classifyUploadError({ message: 'You have reached the flood limit', provider: 'freeimage' })).toBe('rate_limit')
	})

	it('classifies server, payload and internal upload errors', () => {
		expect(classifyUploadError({ status: 503, provider: 'freeimage' })).toBe('server_error')
		expect(classifyUploadError({ status: 413, provider: 'freeimage' })).toBe('payload_too_large')
		expect(classifyUploadError({ message: 'Upload internal error', provider: 'freeimage' })).toBe('internal_error')
	})

	it('classifies invalid ImgBB API keys', () => {
		expect(classifyUploadError({ status: 403, provider: 'imgbb' })).toBe('invalid_api_key')
		expect(classifyUploadError({ message: 'Invalid API key', provider: 'imgbb' })).toBe('invalid_api_key')
	})

	it('returns friendly Freeimage saturation messages', () => {
		expect(getUploadErrorUserMessage('rate_limit', 'freeimage')).toContain('Freeimage puede estar limitando')
		expect(getUploadErrorUserMessage('internal_error', 'freeimage')).toContain('Freeimage puede estar saturado')
	})

})
