# Theming, UI & Tokens (Drishti Architecture)

Astra leverages Material UI (MUI) for its component library, augmented by a strictly enforced custom token system. It provides a robust `ThemeProvider` wrapper to handle dynamic theme switching (Light/Dark mode) and persistence.

## 0. Token-First Enforcement

**CRITICAL RULE:** All UI implementations MUST use predefined tokens.
- **Colors**: Defined in `src/renderer/src/theme/tokens/colors.ts`. Magic hex codes (e.g., `#FF5533`) are strictly forbidden. Use `theme.palette.*` or the custom `colors` export.
- **Spacing**: Defined in `src/renderer/src/theme/tokens/spacing.ts`. Hardcoded pixel values (e.g., `padding: '13px'`) are banned. Use MUI's `sx={ p: spacing.md }` or standard MUI spacing multipliers (`p={2}`).
- **Typography**: Defined in `src/renderer/src/theme/tokens/typography.ts`. Only standard MUI `<Typography variant="...">` variants are allowed. Custom fonts via CSS are prohibited.

---

## Architecture

### 1. ThemeProvider (`src/common/theme/ThemeProvider.tsx`)

A custom wrapper around MUI's native `ThemeProvider`. It adds logic for:

- **State**: Managing `darkMode` boolean.
- **Persistence**: reading/writing `darkMode` preference to `localStorage`.
- **Storybook Support**: Accepts a `forceTheme` prop to lock the theme for UI testing.

#### Props

```typescript
type ThemeProviderProps = {
  lightTheme: Theme // MUI Theme object
  darkTheme: Theme // MUI Theme object
  forceTheme?: 'light' | 'dark' // Optional overrides
}
```

### 2. Theme Context (`src/common/theme/ThemeContext.ts`)

#### `useTheme()` Hook

This is **not** the MUI standard hook (which is `useTheme` from `@mui/material`). This is Astra's custom hook to access the _toggle functionality_.

```typescript
const {
  darkMode, // boolean
  toggleDarkMode // function() => void
} = useTheme()
```

> **Note**: To access theme variables (colors, spacing), continue using MUI's `useTheme` or `makeStyles`. Use Astra's `useTheme` only for switching modes.

---

## Implementation Details

### Persistence

The provider automatically checks `localStorage` on initialization:

```typescript
const [internalDarkMode, setInternalDarkMode] = useState(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('darkMode') === 'true'
  }
  return false
})
```

This ensures the user's preference is remembered across sessions.

### Storybook Integration

The `forceTheme` prop allows you to create stories that specifically render in Dark Mode without manual interaction.

```tsx
// MyComponent.stories.tsx
export const DarkModeView = () => (
  <ThemeProvider lightTheme={l} darkTheme={d} forceTheme="dark">
    <MyComponent />
  </ThemeProvider>
)
```

## Setup Example

```tsx
import { createTheme } from '@mui/material/styles'
import { ThemeProvider } from 'astra'
import { lightTheme, darkTheme } from './theme/appTheme' // Inherits from theme/tokens

export const App = () => (
  <ThemeProvider lightTheme={lightTheme} darkTheme={darkTheme}>
    <MainLayout />
  </ThemeProvider>
)
```
