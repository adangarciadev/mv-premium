export const MV_STYLES = `
/* =========================================
   MEDIAVIDA NATIVE STYLES
   ========================================= */

:host {
    /* Default color variables (Dark Mode) */
    --mv-text-color: #e8e8e8;
    --mv-heading-color: rgb(236, 237, 239);
    --mv-subheading-color: rgb(205, 209, 213);
    --mv-subheading-italic-color: rgb(132, 173, 218);
    --mv-link-color: #fc8f22;
    --mv-link-hover-color: #fff;
    --mv-quote-bg: rgb(42, 50, 55);
    --mv-quote-border: rgb(27, 28, 29);
    --mv-quote-text: rgb(236, 237, 239);
    --mv-table-th-bg: rgb(42, 50, 55);
    --mv-table-border: rgb(47, 51, 56);
    --mv-hr-color: rgb(47, 51, 56);
    --mv-spoiler-bg: #222;
    --mv-spoiler-border: #333;
    --mv-spoiler-text: #aaa;
    --mv-code-bg: #282c34;
    --mv-code-text: #abb2bf;
    --mv-code-border: #111;
    --mv-inline-code-bg: rgba(110, 118, 129, 0.4);
    --mv-inline-code-text: #c9d1d9;

    display: block;
    font-family: "proxima-nova", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    font-size: var(--mv-font-size, 14px) !important;
    color: var(--mv-text-color);
    line-height: 1.5;
    background-color: transparent;
    text-align: left; 

    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    
    width: 100%;
    overflow-x: hidden !important;
}

/* Light Mode Overrides */
:host(.light) {
    --mv-text-color: #0f172a;
    --mv-heading-color: #1e293b;
    --mv-subheading-color: #334155;
    --mv-subheading-italic-color: #475569;
    --mv-link-color: #f97316;
    --mv-link-hover-color: #ea580c;
    --mv-quote-bg: #f1f5f9;
    --mv-quote-border: #cbd5e1;
    --mv-quote-text: #334155;
    --mv-table-th-bg: #f1f5f9;
    --mv-table-border: #e2e8f0;
    --mv-hr-color: #e2e8f0;
    --mv-spoiler-bg: #f8fafc;
    --mv-spoiler-border: #e2e8f0;
    --mv-spoiler-text: #475569;
    --mv-code-bg: #f8fafc;
    --mv-code-text: #334155;
    --mv-code-border: #e2e8f0;
    --mv-inline-code-bg: #f1f5f9;
    --mv-inline-code-text: #475569;
}

/* Custom scrollbars for everything inside the preview (Tables, code blocks, etc) */
*::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
*::-webkit-scrollbar-track {
    background: transparent;
}
*::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius, 4px);
}
:host(.light) *::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
}
*::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}
:host(.light) *::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
}

* { box-sizing: border-box; }

.post-contents {
    width: 100%;     /* Exact width for text content */
    max-width: 100%;
    padding: 0; 
    margin: 0;        /* Left aligned */
    word-wrap: break-word;
    overflow-wrap: break-word;
    overflow-x: hidden !important;
}

.post-contents > :first-child {
    margin-top: 0 !important;
}

a, blockquote, h1, h2, h3, h4, h5, img, li, ol, p, pre, table, tbody, td, th, thead, tr, ul {
    margin: 0; padding: 0; border: 0; font-size: 100%; font: inherit; vertical-align: baseline;
}

a { text-decoration: none; color: var(--mv-link-color); cursor: pointer; }
a:hover { text-decoration: underline; color: var(--mv-link-hover-color); }

img { max-width: min(100%, 500px); max-height: 500px; width: auto; height: auto; object-fit: contain; }

.center { text-align: center; }
.center p { margin: 0; }
.center img { display: inline-block; margin: 0 auto; }

.ancla-link { color: var(--mv-link-color); cursor: pointer; text-decoration: none; }
.ancla-link:hover { color: var(--mv-link-hover-color); text-decoration: underline; }
.bar-offset { scroll-margin-top: 80px; display: block; height: 0; visibility: hidden; }

b, strong { font-weight: 600; color: var(--mv-bold-color, #c9a227); }
i, em { font-style: italic; color: var(--mv-heading-color); }
u { text-decoration: underline; color: var(--mv-heading-color); }

h1, h2, h3, h4, h5 { display: block; font-weight: 600; margin-bottom: 6px; }
h2 { font-size: 21px; color: var(--mv-heading-color); margin-top: 24px; line-height: 31.5px; border-bottom: 1px solid rgb(73, 89, 107); padding-bottom: 0px; }
h3 { font-size: 18px; color: var(--mv-subheading-color); margin-top: 24px; line-height: 24.3px; border-bottom: 0; }
h4 { font-size: 16px; color: var(--mv-subheading-italic-color); margin-top: 24px; line-height: 24px; }
h5 { font-size: 16px; color: var(--mv-subheading-italic-color); font-style: italic; margin-top: 24px; line-height: 24px; }
h3.bar { text-transform: uppercase; border-bottom: 1px solid rgb(73, 89, 107); margin-top: 24px; margin-bottom: 6px; color: var(--mv-subheading-color); padding-bottom: 0px; }

h2 + h3 { margin-top: 7px !important; }
h3 + h4 { margin-top: 7px !important; }
h4 + h5 { margin-top: -3px !important; }
h1 + h2, h1 + h3, h1 + h4, h1 + h5, h2 + h4, h2 + h5, h3 + h5 { margin-top: 7px !important; }
h1 + h5, h2 + h5, h3 + h5, h4 + h5 { margin-top: -3px !important; }

/* Native-like fix: Hide paragraph if it only contains an anchor */
p:has(> .bar-offset:only-child),
p:has(> .ancla-link:only-child) {
    margin: 0 !important;
    height: 0 !important;
    padding: 0 !important;
}

p { margin-top: 0; margin-bottom: 10px; }

blockquote, .quote {
    background: var(--mv-quote-bg);
    margin: 14px 0;
    padding: 10px;
    color: var(--mv-quote-text);
    border: 0 solid var(--mv-quote-border); 
    border-left-width: 3px !important;
    border-left-style: solid !important;
    border-left-color: var(--mv-quote-border) !important;
}
blockquote p, .quote p { margin: 0; }
blockquote footer { margin-top: 8px; font-size: 14px; color: var(--mv-quote-text); font-style: italic; }
blockquote footer cite { font-style: italic; }

.quote-formal {
    background: var(--mv-quote-bg);
    margin: 14px 0;
    border-left: 3px solid var(--mv-quote-border);
    border-radius: 0 2px 2px 0;
    overflow: hidden;
}

.quote-header {
    background: rgba(0, 0, 0, 0.12);
    padding: 6px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.quote-header-info {
    display: flex;
    gap: 6px;
    align-items: center;
}

.quote-postid {
    font-weight: 800;
    color: var(--mv-quote-text);
}

.quote-author-name {
    color: #9da5b4;
}

.quote-header-plus {
    font-weight: bold;
    color: #9da5b4;
    font-size: 16px;
    opacity: 0.8;
}

.quote-content {
    padding: 10px 12px;
    color: var(--mv-quote-text);
}

.quote-content p:last-child {
    margin-bottom: 0;
}

:host(.light) .quote-header {
    background: rgba(0, 0, 0, 0.04);
}

:host(.light) .quote-author-name,
:host(.light) .quote-header-plus {
    color: #64748b;
}



ul, ol { margin: 12px 0; padding-left: 22px; }
ul { list-style: disc; }
ol { list-style: decimal; }
li { margin-bottom: 2px; }

.spoiler-wrap { margin: 8px 0; }
a.spoiler { cursor: pointer; color: #b3c3d3 !important; background: 0 0; font-weight: bold; display: inline-flex; align-items: center; font-size: 13px; text-decoration: none !important; }
:host(.light) a.spoiler { color: #64748b !important; }
a.spoiler:hover { text-decoration: none !important; color: #fff !important; }
:host(.light) a.spoiler:hover { color: #0f172a !important; }
a.spoiler::before { content: "+"; display: inline-block; width: 12px; height: 12px; line-height: 12px; text-align: center; border: 1px solid #fc8f22; color: #fc8f22; font-size: 11px; margin-right: 6px; border-radius: var(--radius, 2px); }
a.spoiler.open::before { content: "-"; }
div.spoiler.animated { display: none; margin-top: 4px; background-color: var(--mv-spoiler-bg); border: 1px solid var(--mv-spoiler-border); padding: 6px 10px; color: var(--mv-spoiler-text); }
div.spoiler.animated.visible { display: block !important; }
div.spoiler.animated p:last-child { margin-bottom: 0; }

.table-wrap { overflow-x: auto; margin: 12px 0; border: 0; display: block; }
table { width: auto !important; max-width: 100%; border-collapse: collapse; background: transparent; font-size: 14px; }
th { font-weight: 700; color: var(--mv-quote-text); text-align: left; padding: 6px 13px; border: 1px solid var(--mv-table-border); background: var(--mv-table-th-bg); }
td { padding: 6px 13px; border: 1px solid var(--mv-table-border); color: var(--mv-quote-text); background: transparent; }
tr:nth-child(even) td { background: rgba(255, 255, 255, 0.03); }
:host(.light) tr:nth-child(even) td { background: rgba(0, 0, 0, 0.02); }

.center .table-wrap {
    display: inline-block;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
}

.center .table-wrap table,
.center table {
    margin-left: auto;
    margin-right: auto;
}

code.inline { 
    background: var(--mv-inline-code-bg); 
    color: var(--mv-inline-code-text); 
    padding: 0.2em 0.4em; 
    border-radius: var(--radius, 4px); 
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; 
    font-size: 85%; 
    border: 1px solid rgba(255, 255, 255, 0.1);
}

:host(.light) code.inline {
    border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Alignment */
.center, div[style*="text-align: center"], p[style*="text-align: center"] {
    text-align: center !important;
    display: block;
}

.code-wrapper { background: var(--mv-code-bg); color: var(--mv-code-text); padding: 12px; margin: 12px 0; border-radius: var(--radius, 6px); overflow-x: auto; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; line-height: 1.5; border: 1px solid var(--mv-code-border); position: relative; }
.code-wrapper code { display: block; overflow-x: auto; padding: 0; background: transparent; color: inherit; font-family: inherit; white-space: pre-wrap; word-wrap: break-word; }

.token.comment, .token.prolog, .token.doctype, .token.cdata { color: #5c6370; font-style: italic; }
.token.punctuation { color: #abb2bf; }
.token.namespace { opacity: 0.7; }
.token.property, .token.tag, .token.constant, .token.symbol, .token.deleted { color: #e06c75; }
.token.boolean, .token.number { color: #d19a66; }
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: #98c379; }
.token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string { color: #56b6c2; }
.token.atrule, .token.attr-value, .token.keyword { color: #c678dd; }
.token.function, .token.class-name { color: #61aeee; }
.token.regex, .token.important, .token.variable { color: #c678dd; }
.token.important, .token.bold { font-weight: bold; }
.token.italic { font-style: italic; }
.token.entity { cursor: help; }

.mv-code-lang-label { position: absolute; top: 0; right: 0; background: #21252b; color: #9da5b4; font-size: 11px; padding: 2px 8px; border-bottom-left-radius: 4px; text-transform: uppercase; font-weight: bold; user-select: none; z-index: 10; opacity: 0.9; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; }
img { max-width: min(100%, 500px); max-height: 500px; width: auto; height: auto; object-fit: contain; border-radius: var(--radius, 4px); }

img.emoji, img.smiley {
    height: 20px;
    width: auto;
    display: inline-block !important;
    vertical-align: middle;
    image-rendering: optimizeQuality;
    image-rendering: -webkit-optimize-contrast;
    max-width: none;
    border-radius: 0;
}

.embed {
    position: relative;
    border-radius: var(--radius, 4px);
    margin: 10px 0;
    background: #000;
}

.embed.r16-9 {
    padding-bottom: 56.25%; /* 16/9 = 0.5625 */
    height: 0;
}

.youtube_lite {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    width: 100%; height: 100%;
}

.youtube_lite a.preinit {
    display: block;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    cursor: pointer;
    text-decoration: none;
    position: relative;
}

.youtube_lite a.preinit:hover {
    filter: brightness(1.1);
}

.youtube_lite a.preinit::before {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 68px; height: 48px;
    background-color: rgba(33, 33, 33, 0.8);
    border-radius: var(--radius, 8px);
    z-index: 1;
    transition: background-color 0.2s;
}

.youtube_lite a.preinit:hover::before {
    background-color: #f00; /* Youtube Red on hover */
}

.youtube_lite a.preinit::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    width: 0; height: 0;
    border-style: solid;
    border-width: 10px 0 10px 18px; /* Triangle size */
    border-color: transparent transparent transparent #fff;
    pointer-events: none;
}

.embed.twitter {
    /* Mediavida usually limits tweet width */
    max-width: 550px;
    margin: 12px 0; /* Left-aligned based on base styles, or 0 auto for centering */
    background: transparent;
}

.embed.twitter iframe {
    /* Important to avoid ugly borders */
    border: none;
    width: 100%;
    /* In the real site this is handled by JS; here we force a background in case of slow loading */
    background: transparent; 
}

.twitter-card .generic-icon {
    color: #1DA1F2 !important; /* Classic Twitter blue */
    /* Or if you prefer X-style black: color: #fff !important; */
    background: rgba(29, 161, 242, 0.1);
}

ul.checklist {
    list-style-type: none !important; /* Remove bullet point */
    padding-left: 0;
    margin-left: 5px;
}

ul.checklist li {
    margin-bottom: 4px;
}

ul.checklist li p {
    margin: 0;
    display: inline-block;
}

ul.checklist label {
    cursor: default;
    color: var(--mv-text-color);
}

ul.checklist label.done {
    text-decoration: line-through;
    color: #888;
}

input.check {
    margin-right: 6px;
    position: relative;
    top: 1px;
}

hr {
    /* Styles extracted from Mediavida */
    background-color: var(--mv-hr-color);
    margin-top: 14px;
    margin-bottom: 14px;
    border: 0;
    
    /* Required to be visible since border is 0 */
    height: 1px; 
    display: block;
    width: 100%;
}

ul ul, ul ol, ol ul, ol ol {
    margin-top: 0;
    margin-bottom: 0;
}

ul ul, ol ul, ul ol {
    margin-left: 20px; /* Offset to the right */
}

.embed.instagram {
    margin: 15px 0;
    text-align: center; /* Center the iframe */
}

.embed-placeholder.generic-card {
    display: flex;
    align-items: center;
    background: #2a3237; /* Dark background MV style */
    border: 1px solid #3f4448;
    border-radius: var(--radius, 6px);
    padding: 12px;
    margin: 12px 0;
    gap: 15px;
    transition: background 0.2s;
}
:host(.light) .embed-placeholder.generic-card {
    background: #f1f5f9;
    border-color: #e2e8f0;
}

.embed-placeholder.generic-card:hover {
    background: #323a40;
    border-color: #555;
}
:host(.light) .embed-placeholder.generic-card:hover {
    background: #e2e8f0;
    border-color: #cbd5e1;
}

.generic-icon {
    background: #1f2326;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #84add6; /* MV Blueish */
    flex-shrink: 0;
}
:host(.light) .generic-icon {
    background: #e2e8f0;
    color: #3b82f6;
}

.generic-content {
    flex: 1;
    overflow: hidden; /* For long texts */
}

.generic-domain {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: bold;
    color: #999;
    margin-bottom: 2px;
    letter-spacing: 0.5px;
}

.generic-link {
    display: block;
    color: var(--mv-link-color); /* MV Orange */
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 14px;
    margin-bottom: 4px;
}

.generic-link:hover {
    text-decoration: underline;
    color: var(--mv-link-hover-color);
}

.generic-footer {
    font-size: 11px;
    color: #666;
    font-style: italic;
}

.steam-card {
    display: flex;
    position: relative;
    box-sizing: border-box;
    width: 100%;
    max-width: 620px;
    height: 115px;
    background: linear-gradient(135deg, #1b2838 0%, #2a475e 100%);
    border: 1px solid #3d5a73;
    border-radius: var(--radius, 4px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    overflow: hidden;
    margin: 10px 0;
    text-decoration: none !important;
    transition: all 0.2s ease;
}

.steam-card:hover {
    border-color: #66c0f4;
    box-shadow: 0 4px 16px rgba(102, 192, 244, 0.2);
    transform: translateY(-1px);
}

/* Header Image */
.steam-card-image {
    flex: 0 0 auto;
    width: 230px;
    height: 100%;
    overflow: hidden;
    background: #171a21;
}

.steam-card-image img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
}

.steam-card-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-left: 14px;
    padding-right: 80px;
    min-width: 0;
    gap: 2px;
}

.steam-card-title {
    margin: 0 !important;
    font-size: 16px !important;
    font-weight: 500 !important;
    color: #c7d5e0 !important;
    line-height: 1.3 !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border: none !important;
    padding: 0 !important;
    background: none !important;
}

.steam-card:hover .steam-card-title {
    color: #fff !important;
}

.steam-card-date {
    margin: 0 !important;
    font-size: 12px !important;
    font-weight: 400 !important;
    color: #8f98a0 !important;
    line-height: 1.4 !important;
}

.steam-card-genres {
    margin: 0 !important;
    font-size: 11px !important;
    font-weight: 400 !important;
    color: #67c1f5 !important;
    line-height: 1.4 !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.steam-card-platform {
    width: 16px;
    height: 16px;
    color: #8f98a0;
    margin-top: 4px;
    flex-shrink: 0;
}

.steam-card-logo {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 20px;
    height: 20px;
    color: #67c1f5;
    opacity: 0.6;
    transition: opacity 0.2s;
}

.steam-card:hover .steam-card-logo {
    opacity: 1;
}

.steam-card-price-area {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.steam-card-price-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-end; /* Right align text inside */
    justify-content: center;
    background-color: #3b3b3b; /* Fallback dark grayish */
    background: #00000033; /* Semi-transparent black for container */
    padding: 2px 4px; /* Minimal padding */
    height: 34px; /* Fixed height matching discount */
    min-width: 60px; /* Ensure wide enough */
    box-sizing: border-box;
}

.steam-card-price-wrapper.is-discounted {
    background: #4c6b22; /* Same green as discount background, or slightly different? */
    background: linear-gradient(to bottom, #4c6b22 5%, #3a5318 95%); /* Matching discount bg somewhat? */
    /* Actually user said "same background color". If discount is green, this should be green? 
       Usually on Steam the Discount is Green, Price block is Dark Gray.
       But user said "Button size equal to discount". "Price and old price with SAME background".
       If I make the wrapper the "button", I can style it green. */
    background: #4c6b22; /* Simple green to match badge */
    padding: 0 6px; /* Tighter padding */
    align-items: flex-end;
}

.steam-card-original-price {
    font-size: 11px;
    color: #a4d007; /* Light green text often used for original price on green bg? Or grayish? */
    color: #949494; /* Grayish for visibility against button? */
    /* If bg is green #4c6b22, gray text needs contrast. */
    color: #88cfa5; /* Light greenish gray */
    text-decoration: line-through;
    line-height: 1.1;
}

.steam-card-discount {
    font-size: 24px; /* Larger as requested */
    font-weight: 800; /* Bolder */
    color: #beee11;
    background: #4c6b22;
    padding: 0 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px; /* Match height */
    line-height: 1;
}

.steam-card-btn-text {
    font-size: 13px;
    font-weight: 400;
    color: #beee11; /* Matching discount text color */
    line-height: 1.1;
}

.steam-card-btn {
    padding: 0 14px;
    min-width: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px; /* Standard height */
    text-align: center;
    font-size: 13px;
    color: #d2e885;
    background: linear-gradient(to bottom, #799905 5%, #536904 95%);
    border-radius: var(--radius, 2px);
    text-decoration: none !important;
}

.steam-card-btn:hover {
    filter: brightness(1.15);
    color: #fff;
}

/* Free Game Button */
.steam-card-btn-free {
    color: #fff;
    background: #5c7e10;
}

/* Link Style Button (for errors) */
.steam-card-btn-link {
    color: #67c1f5;
    background: transparent;
    border: 1px solid #67c1f5;
    padding: 0 12px;
}

.steam-card-btn-link:hover {
    background: rgba(103, 193, 245, 0.1);
}

.steam-card-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    max-width: 620px;
    height: 115px;
    background: linear-gradient(135deg, #1b2838 0%, #2a475e 100%);
    border: 1px dashed #3d5a73;
    border-radius: var(--radius, 4px);
    margin: 10px 0;
    color: #8f98a0;
    font-size: 13px;
}

.steam-card-loading svg {
    color: #67c1f5;
    flex-shrink: 0;
}

.steam-card-error {
    justify-content: space-between;
    padding: 16px 20px;
}

.steam-card-error-content {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #c7d5e0;
    font-size: 14px;
}

.steam-card-error-icon {
    font-size: 18px;
}

/* Placeholder Container */
.steam-embed-placeholder {
    margin: 10px 0;
}
`
