# Mediavida Premium Extension

<p align="center">
  <img src="public/icon/128.png" alt="Mediavida Premium Logo" width="128" height="128">
</p>

<p align="center">
  <strong>Premium features for the Mediavida.com forum</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#development">Development</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#testing">Testing</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Overview

Mediavida Premium is a browser extension that enhances the [Mediavida.com](https://www.mediavida.com) forum with premium features like infinite scroll, draft auto-save, TMDB integration, custom themes, keyboard shortcuts, and much more.

**Supported Browsers:** Chrome, Firefox

**Tech Stack:**

- [WXT](https://wxt.dev/) - Web Extension Framework
- [React 19](https://react.dev/) - UI Library
- [TypeScript](https://www.typescriptlang.org/) - Type Safety
- [Tailwind CSS v3](https://tailwindcss.com/) - Styling
- [Zustand](https://zustand-demo.pmnd.rs/) - State Management
- [Shadcn/ui](https://ui.shadcn.com/) - Component Library

---

## Features

### 🎬 Content & Media

| Feature               | Description                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------ |
| **TMDB Integration**  | Hover cards with movie/TV show info from TMDB when hovering over links in the Cinema forum |
| **Media Hover Cards** | Preview YouTube, Twitch, and Steam links without leaving the page                          |
| **Gallery Mode**      | View all images in a thread in a beautiful gallery layout                                  |
| **Image Upload**      | Upload images directly to ImgBB/Catbox from the editor                                     |

### ✍️ Editor Enhancements

| Feature               | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| **Draft Auto-Save**   | Never lose your posts - automatic draft saving with recovery    |
| **Templates**         | Save and reuse post templates with slash commands (`/template`) |
| **Code Highlighting** | Syntax highlighting for code blocks with 20+ languages          |
| **Table Editor**      | Visual table creation for BBCode                                |
| **Live Preview**      | Real-time BBCode/markdown preview while typing                  |

### 📚 Organization

| Feature                | Description                                         |
| ---------------------- | --------------------------------------------------- |
| **Bookmarks**          | Save posts for quick access later                   |
| **Saved Threads**      | Bookmark entire threads to your personal collection |
| **Favorite Subforums** | Quick access to your most visited forums            |
| **Pinned Posts**       | Pin important posts within threads                  |
| **Muted Words**        | Hide posts containing specific words or phrases     |

### 🚀 Navigation & UX

| Feature                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| **Command Menu**       | `Ctrl+K` to quickly navigate anywhere            |
| **Infinite Scroll**    | Auto-load next pages as you scroll               |
| **Live Thread**        | Real-time thread updates with polling            |
| **Keyboard Shortcuts** | Navigate and interact without touching the mouse |
| **Ultrawide Support**  | Optimized layouts for ultrawide monitors         |

### 🤖 AI-Powered

| Feature               | Description                            |
| --------------------- | -------------------------------------- |
| **Post Summary**      | AI-powered summarization of long posts |
| **Thread Summarizer** | Get a quick summary of entire threads  |

### 🎨 Customization

| Feature                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| **Theme Editor**        | Create and apply custom CSS themes               |
| **User Customizations** | Per-user CSS styling and notes                   |
| **Custom Icons**        | Set custom icons for users and subforums         |
| **Activity Stats**      | View your forum activity statistics and heatmaps |

---

## Installation

### From Browser Stores (Recommended)

- **Chrome Web Store**: _Coming soon_
- **Firefox Add-ons**: _Coming soon_

### Manual Installation (Development Build)

1. Clone the repository:

   ```bash
   git clone https://github.com/adangarciadev/mv-premium.git
   cd mv-premium
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build for your browser:

   ```bash
   npm run build           # Chrome
   npm run build:firefox   # Firefox
   ```

4. Load the extension:
   - **Chrome**: Go to `chrome://extensions`, enable "Developer mode", click "Load unpacked", select `.output/chrome-mv3`
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select any file in `.output/firefox-mv2`

---

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Commands

```bash
# Start development server with hot reload
npm run dev              # Chrome
npm run dev:firefox      # Firefox

# Production build
npm run build            # Chrome
npm run build:firefox    # Firefox

# Create distributable ZIP
npm run zip              # Chrome
npm run zip:firefox      # Firefox

# Type checking
npm run compile          # or: npm run typecheck

# Linting
npm run lint

# Testing
npm test                 # Watch mode
npm run test:run         # Single run
npm run test:coverage    # With coverage report
npm run test:ui          # Interactive UI
```

### Project Structure

```
mv-premium/
├── assets/              # Global CSS files
│   ├── shadow.css       # Tailwind for Shadow DOM components
│   ├── app.css          # Global site modifications
│   └── theme.css        # CSS variables
├── components/          # Shared React components
│   └── ui/              # Shadcn/ui components
├── constants/           # App-wide constants
├── entrypoints/         # Extension entry points
│   ├── background/      # Background script (CORS proxy, API keys)
│   ├── content/         # Content script logic
│   ├── options/         # Dashboard/Settings page
│   └── popup/           # Browser toolbar popup
├── features/            # Feature modules (self-contained)
│   ├── bookmarks/
│   ├── cine/
│   ├── drafts/
│   └── ...
├── hooks/               # Shared React hooks
├── lib/                 # Utilities and core logic
│   ├── mv-api/          # Mediavida API client
│   └── storage/         # Storage utilities
├── services/            # External API integrations
│   ├── api/             # TMDB, Steam, ImgBB
│   ├── ai/              # AI services (Gemini)
│   └── media/           # Media URL resolvers
├── store/               # Zustand stores
├── types/               # TypeScript type definitions
└── docs/                # Documentation
    └── adr/             # Architecture Decision Records
```

---

## Architecture

### Extension Contexts

The extension operates in three main contexts:

1. **Background Script** - Handles API requests, manages secure keys, provides CORS proxy
2. **Content Script** - Injects features into Mediavida pages (~1.2MB bundle)
3. **Options Page** - Full React SPA for settings management

### Key Architectural Decisions

| Decision                      | Rationale                                                                 |
| ----------------------------- | ------------------------------------------------------------------------- |
| **Shadow DOM Isolation**      | All injected UI uses Shadow DOM to avoid CSS conflicts with Mediavida     |
| **Monolithic Content Script** | WXT doesn't effectively code-split; disk loading is fast (~50ms)          |
| **Background API Proxy**      | All external API requests go through background for CORS and key security |
| **Feature-based Structure**   | Each feature is self-contained with its own components, logic, and hooks  |

### Detailed Documentation

- See [CLAUDE.md](.claude/CLAUDE.md) for comprehensive technical documentation
- See [docs/adr/](docs/adr/) for Architecture Decision Records

---

## Testing

The project uses [Vitest](https://vitest.dev/) with 694+ tests across 49+ test files.

```bash
npm test                 # Run in watch mode
npm run test:run         # Single run
npm run test:coverage    # Generate coverage report
```

### Test Stack

- **Framework**: Vitest (native Vite integration)
- **DOM Environment**: jsdom
- **React Testing**: @testing-library/react
- **Mocking**: Browser APIs mocked in `tests/setup.ts`

### Writing Tests

Tests are co-located with source files:

```
lib/
  date-utils.ts
  date-utils.test.ts      # Test file next to source
```

---

## API Keys Configuration

Some features require API keys. These are stored securely in browser storage and never exposed to page context.

| Service    | Feature       | How to Get                                                                   |
| ---------- | ------------- | ---------------------------------------------------------------------------- |
| **ImgBB**  | Image upload  | [imgbb.com/api](https://api.imgbb.com/)                                      |
| **TMDB**   | Movie/TV info | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)       |
| **Gemini** | AI features   | [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey) |

Configure keys in the extension's Dashboard → Settings → API Keys.

---

## Contributing

Contributions are welcome! Please follow these guidelines:

### Code Style

- **Language**: English for code, Spanish for user-facing text
- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier with tabs
- **Icons**: Use `lucide-react` with direct imports only

### Important Patterns

1. **Shadow DOM**: All injected UI must use `<ShadowWrapper>`
2. **Root Manager**: Never use `ReactDOM.createRoot` directly
3. **API Requests**: All external requests go through background script
4. **Storage**: Use `@wxt-dev/storage` only, never raw `browser.storage`
5. **Logging**: Use `logger` from `@/lib/logger`, not `console.*`

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm run test:run`)
5. Ensure type checking passes (`npm run compile`)
6. Submit a Pull Request

---

## Debugging

Open the browser console on any Mediavida page and run:

```javascript
mvpDebug() // Inspect all extension storage keys
```

---

## License

This project is licensed under the Mozilla Public License 2.0 (MPL-2.0).  
See the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [WXT](https://wxt.dev/) for the excellent extension framework
- [Shadcn/ui](https://ui.shadcn.com/) for beautiful components
- [TMDB](https://www.themoviedb.org/) for movie/TV data
- The Mediavida community for inspiration and feedback
