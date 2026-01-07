# ADR-014: Infinite Scroll Sliding Window Architecture

## Status
Accepted

## Context
Mediavida threads can contain thousands of posts divided into hundreds of pages. A naive "Infinite Scroll" implementation (simply appending pages to the DOM indefinitely) leads to severe performance degradation:
1.  **Memory Exhaustion:** Thousands of DOM nodes, images, and embedded media consume excessive RAM.
2.  **Layout Thrashing:** The browser struggles to calculate the layout of a massive document.
3.  **Input Lag:** Scroll events and UI interactions become sluggish as the DOM grows.

## Decision
Implement a **Sliding Window** architecture combined with modern CSS optimizations to provide a "Premium" performance experience that remains fluid regardless of thread length.

## Technical implementation

### 1. Sliding Window Management
Instead of keeping all loaded pages in the DOM, the system maintains a "window" of active pages:
*   **Window Size:** Typically current page ± 2 pages.
*   **Dynamic Unloading:** When a page block moves too far from the viewport, its inner HTML is extracted and stored in a JavaScript variable (HTML Cache), and the DOM container is emptied.
*   **Height Preservation:** To prevent "scroll jumps," the system measures the page height before unloading and applies it as a fixed `min-height` to the placeholder.
*   **Seamless Re-hydration:** Using `IntersectionObserver`, placeholders are monitored. If the user scrolls back to an unloaded section, the cached HTML is instantly re-injected.

### 2. High-Performance Rendering
The system leverages modern browser capabilities to minimize CPU usage:
*   **`content-visibility: auto`**: Applied to every injected post. This allows the browser to skip the layout and rendering of off-screen posts completely until they are about to enter the viewport.
*   **Containment:** Using `contain: layout size` (via content-visibility) to isolate DOM changes within specific page blocks, preventing global layout recalculations.

### 3. Smart Intersection Loading
*   **Sentinel Pattern:** A transparent sentinel element at the bottom of the thread triggers the fetching of the next page using the `IntersectionObserver` API.
*   **Root Margins:** Fetching is triggered *before* the user reaching the actual bottom to ensure a continuous, uninterrupted reading flow.

## Consequences

### Positive
*   **Infinite Capacity:** Threads of any length can be navigated without increasing memory consumption linearly.
*   **Ultra-Smooth Scroll:** Frame rates remain high because the active DOM size is capped.
*   **Instant Navigation:** Re-hydrating cached pages is significantly faster than re-fetching them from the network.
*   **Premium UX:** Visual markers (Page Dividers) handle page transitions elegantly without the "jank" associated with traditional pagination.

### Negative
*   **Complexity:** Managing the state of unloaded/re-hydrated pages requires careful handling of React mounts/unmounts and feature cleanup to avoid memory leaks.
*   **Search Limitations:** Native `Ctrl+F` will only find text in the currently loaded window (mitigated by our own high-performance Thread Search feature).
