# Localization (i18n)

Astra provides a lightweight, Context-based localization solution. It is designed to be simple and fully typed, allowing instant switching of languages and managing translation strings (literals).

**CRITICAL RULE:** All UI text strings within JSX must be localized. Hardcoding text inside React components (e.g., `<Button>Submit</Button>`) is a direct violation of the Drishti architecture. You must use the `literal['key']` pattern for all user-facing text.

## Components

### 1. LanguageProvider (`src/common/localization/LanguageProvider.tsx`)

This is the main wrapper component that manages the localization state.

#### Props

| Prop | Type | Description |
|Args|---|---|
| `children` | `ReactNode` | The app content. |
| `translations` | `TranslationMap` | An object containing all translation strings. |
| `availableLanguages` | `LanguageDefinition[]` | List of supported languages (code & label). |
| `defaultLanguage` | `string` | (Optional) Initial language code. Defaults to 'en'. |

#### State Management

- Maintains `currentLanguage` state.
- Updates the `literal` object (the current dictionary) whenever the language changes.

---

### 2. Context & Hooks (`src/common/localization/LanguageContext.ts`)

#### `useLanguage()` Hook

Returns the context value:

```typescript
const {
  currentLanguage, // e.g., 'en'
  setCurrentLanguage, // function to change language
  literal, // object containing key-value strings
  availableLanguages // list of options for UI selectors
} = useLanguage()
```

#### `LanguageDefinition`

```typescript
type LanguageDefinition = {
  code: string // 'en', 'es', 'fr'
  label: string // 'English', 'Español', 'Français'
}
```

## Implementation Guide

### 1. Structure Your JSON Files

Create a separation file for each language (e.g., `en.json`, `es.json`).
**Crucial**: The `LanguageProvider` expects a flattened `Record<string, string>`. Do not use nested objects. Use dot notation for keys.

**`src/localization/en.json`**

```json
{
  "app.title": "My Super App",
  "auth.login": "Login",
  "error.network": "Network Error"
}
```

**`src/localization/es.json`**

```json
{
  "app.title": "Mi Súper App",
  "auth.login": "Iniciar Sesión",
  "error.network": "Error de Red"
}
```

### 2. Configure LanguageProvider

Import your JSON files and pass them to the `LanguageProvider`.

**`src/App.tsx`**

```tsx
import enTranslations from './localization/en.json'
import esTranslations from './localization/es.json'

// Map language codes to their translation objects
const translations = {
  en: enTranslations,
  es: esTranslations
}

// Define available languages for the UI selector
const availableLanguages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' }
]

export const App = () => {
  return (
    // 'defaultLanguage' is optional. It falls back to 'en' if omitted.
    // If you pass 'es', the app will start in Spanish.
    <LanguageProvider
      translations={translations}
      availableLanguages={availableLanguages}
      defaultLanguage="en"
    >
      <MainLayout />
    </LanguageProvider>
  )
}
```

#### Default Language Handling

The `defaultLanguage` prop sets the initial state.

- If provided: The provider initializes `currentLanguage` to this value.
- If omitted: The provider defaults to `'en'`.
- **Fallback**: If the specified language key (e.g., `'fr'`) is missing from the `translations` map, the `literal` object will be empty `{}`. Always ensure your `defaultLanguage` matches a key in your `translations` map.

3.  **Consume in Component**:

    ```tsx
    const { literal, setCurrentLanguage } = useLanguage()

    return (
      <div>
        <h1>{literal['welcome']}</h1>
        <button onClick={() => setCurrentLanguage('es')}>ES</button>
      </div>
    )
    ```

## Integration with ApiService

The `literal` object is often passed to the `ApiService` constructor. This ensures that generic error messages (like "Network Error") are also localized based on the user's selected language.
