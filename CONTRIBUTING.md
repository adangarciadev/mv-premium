# Contributing to MV Premium Extension

Thanks for your interest in contributing! This document will guide you through setting up your development environment.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/adangarciadev/mv-premium.git
cd mv-premium

# Install dependencies
npm install

# Start in development mode (Chrome)
npm run dev

# Start in development mode (Firefox)
npm run dev:firefox
```

## 📂 Project Structure

```
features/          # Extension features
  └── [feature]/
      ├── components/  # React components
      ├── logic/       # Pure logic, event listeners
      ├── storage.ts   # Storage definitions
      └── index.ts     # Entry point

lib/               # Shared utilities
components/        # Reusable UI components
constants/         # Global constants
hooks/             # Custom React hooks
store/             # Global state (Zustand)
services/          # External services (APIs)
```

## 🧪 Testing

```bash
# Run tests once
npm test -- --run

# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage

# View tests in interactive UI
npm run test:ui
```

### Testing Conventions

- Tests are placed next to the file they test: `file.ts` → `file.test.ts`
- Avoid importing modules that depend on browser APIs directly
- Re-implement pure functions for testing when necessary

## 🎨 Styles and UI

### Shadow DOM

All components injected into the page must use `<ShadowWrapper>`:

```tsx
import { ShadowWrapper } from '@/components/shadow-wrapper'

export function MyComponent() {
	return (
		<ShadowWrapper className="z-50">
			<div className="bg-card p-4">{/* Your content */}</div>
		</ShadowWrapper>
	)
}
```

### CSS

| File                | Usage                        |
| ------------------- | ---------------------------- |
| `assets/shadow.css` | Full Tailwind for Shadow DOM |
| `assets/app.css`    | Global site modifications    |
| `assets/theme.css`  | Shared CSS variables         |

## 🔧 Available Scripts

| Script                  | Description                |
| ----------------------- | -------------------------- |
| `npm run dev`           | Development (Chrome)       |
| `npm run dev:firefox`   | Development (Firefox)      |
| `npm run build`         | Production build (Chrome)  |
| `npm run build:firefox` | Production build (Firefox) |
| `npm run lint`          | Run ESLint                 |
| `npm run typecheck`     | Check TypeScript types     |
| `npm test`              | Run tests                  |

## 📝 Commits

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: fix bug in X
docs: update documentation
test: add tests for Y
chore: update dependencies
refactor: reorganize code for Z
```

## 🐛 Reporting Bugs

1. Check if the bug has already been reported
2. Include:
   - Browser version
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

## 💡 Proposing Features

1. Open an Issue describing the feature
2. Wait for feedback before implementing
3. Reference the Issue in your PR

## 🔐 Secrets for CI/CD

For automatic releases, configure these secrets in GitHub:

### Chrome Web Store (optional)

- `CHROME_EXTENSION_ID`: Extension ID
- `CWS_CLIENT_ID`: OAuth Client ID
- `CWS_CLIENT_SECRET`: OAuth Client Secret
- `CWS_REFRESH_TOKEN`: OAuth Refresh Token

### Firefox Add-ons (optional)

- `FIREFOX_ADDON_GUID`: Extension GUID
- `FIREFOX_API_KEY`: API Key
- `FIREFOX_API_SECRET`: API Secret

### Coverage (optional)

- `CODECOV_TOKEN`: Codecov Token

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project.
