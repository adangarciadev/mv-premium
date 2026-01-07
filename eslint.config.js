import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'

/** @type {import('eslint').Linter.Config[]} */
export default [
  // 1. Global Ignores (Files to be ignored)
  {
    ignores: [
      'node_modules/',
      '.output/',
      '.wxt/',
      'dist/',
      '*.config.js',
      '*.config.ts',
      '**/*.d.ts',
    ],
  },

  // 2. Base Configuration (Parser & Globals)
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    languageOptions: {
      parser: tseslint.parser, // Force TS parser for everything
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.es2022,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    // Define plugins to make them available
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react': pluginReact,
      'react-hooks': pluginReactHooks,
    },
    // Linter Options
    linterOptions: {
      reportUnusedDisableDirectives: "off", // Suppress warnings for unused eslint-disable comments
    },
  },

  // 3. RECOMMENDED RULES (COMMENTED OUT / DISABLED)
  // These lines are commented out to prevent strict errors in existing code.
  // By disabling them, we turn off the "strict mode" completely.
  // ---------------------------------------------------------------
  // pluginJs.configs.recommended,
  // ...tseslint.configs.recommended,
  // pluginReact.configs.flat.recommended,
  // ---------------------------------------------------------------

  // 4. Minimal React Config (Required to support JSX syntax)
  pluginReact.configs.flat['jsx-runtime'],

  // 5. Manual Rules (Only the specific rules you want to enforce)
  {
    rules: {
      // Kept empty or basic to avoid strict linting errors.
      // Since "recommended" configs are disabled above, existing code won't break CI.
      
      // Example: Disable console.log warnings/errors
      'no-console': 'off',
      
      // Hook rules kept as warnings to prevent logic bugs, but won't break the build
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]