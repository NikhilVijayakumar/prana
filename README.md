# Prana — प्राण (Life Force)

> **The Engine Core** — Runtime services, persistence, Electron main process, and globally-shared UI screens.

## Scope

| Layer | Contents |
|---|---|
| **Main Process** | Electron entry point, IPC handlers, cron scheduler |
| **Services** | LLM gateway, SQLite repository, Vault sync, context engine, all backend service implementations |
| **Core UI** | Splash, Login, Forgot/Reset Password, Vault browsers, Infrastructure layers |
| **Persistence** | SQLite database, encrypted Vault (`.vzip`) lifecycle |

## Architecture

Prana follows **Clean Architecture + MVVM** for UI screens and a service-oriented pattern for backend logic.

```
packages/prana/
├── main/            # Electron main process entry + IPC services
│   ├── index.ts     # App entry point
│   ├── config/      # Main process configuration
│   └── services/    # All backend service implementations
├── ui/              # Renderer-side UI screens (MVVM)
│   ├── splash/
│   ├── login/
│   ├── authentication/
│   ├── vault/
│   └── ...
├── services/        # Renderer-side service adapters
└── docs/            # Localized documentation
```

## Import Rules

- ✅ **May import from**: `@astra/*`, `@dharma/*`
- ❌ **Must never import from**: `@dhi/*`, `@vidhan/*`

## Running Tests

```bash
# From the project root
npm run test
```

All 34 service test files live in `packages/prana/main/services/*.test.ts`.

## Documentation

See [docs/](docs/) for module-specific documentation including email management, vault architecture, and login flows.
