/**
 * Thread Gallery Feature
 *
 * Scans forum threads for images and videos, displaying them
 * in an interactive fullscreen carousel gallery.
 *
 * NOTE: GalleryCarousel is NOT exported here to enable proper code splitting.
 * It's loaded dynamically in inject-gallery.tsx to avoid bundling jszip.
 */

export { injectGalleryTrigger } from './logic/inject-gallery'
