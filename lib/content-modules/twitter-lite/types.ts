import type { TweetLiteData } from '@/lib/messaging'

export interface TwitterLiteCardData extends TweetLiteData {
	canExpandTweet?: boolean
}
