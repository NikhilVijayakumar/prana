# Testing Strategies

## Unit Testing
- **Framework:** `vitest` mapped via npm script `test:unit` and `test:unit:watch`.
- **Environment:** Mocked out Node.js and external dependencies via cross-env bounds (e.g. `cross-env NODE_ENV=test`).
- **Convention:** Unit tests generally co-locate alongside the actual implementation components/services checking specific logical outputs and states.
- Vitest handles execution of both fast functional component verification and underlying Main process service isolation.

## End-to-End (E2E) Testing
- **Framework:** Playwright mapped via npm script `test:e2e` and `test:e2e:headed`.
- **Location:** Dedicated E2E flows exist inside the `tests/` directory ensuring entire UI surfaces match intent across bootstrapping, rendering, and context processing natively in Election environments.
- Ensures cross-compatibility across expected behaviors mapped out by MVP standards.

## Validation & Linting
- Codebase style format validation is performed through integrated `Prettier` rules.
- Static typing correctness is validated through ESLint and typescript compilation bindings (`typecheck:node` and `typecheck:web`).
