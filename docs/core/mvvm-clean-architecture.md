# MVVM Clean Architecture Guide

This guide provides step-by-step instructions for implementing the Model-View-ViewModel (MVVM) Clean Architecture in your application using the `astra` library.

## Architectural Overview

Astra strictly separates concerns into three layers:

1.  **View (UI)**: React Components (Container + Presentational). Each View component operates on its own dedicated state defined by `AppState<T>`.
2.  **ViewModel**: State management and business logic hook. The ViewModel exclusively owns and manages the View's local `AppState<T>`, acting as the middleman between the UI and data.
3.  **Repository**: Data abstraction and API handling. The Repository communicates with the backend and guarantees a uniform `ServerResponse<T>` output.

## 1. Directory Structure

Organize your features to keep related code together. We recommend a `features/` directory with subfolders for each domain.

```text
src/renderer/src/
├── features/
│   └── [feature_name]/        # e.g., users
│       ├── view/              # UI Components (Pure MUI)
│       │   ├── [Feature]Container.tsx
│       │   └── [Feature]List.tsx
│       ├── viewmodel/         # Business Logic
│       │   └── use[Feature]ViewModel.ts
│       └── repo/              # Data Layer
│           └── [Feature]Repo.ts
└── layout/                    # App Shell (MainLayout)
```

---

## 2. Step-by-Step Implementation

### Step 1: The Repository Layer

Create a repository to handle data fetching. Extend `ApiService` if using REST, or implement your own logic. As per `repository-layer.md`, the Repository completely abstracts all network errors and consistently returns a safe `ServerResponse<T>`.

**File:** `src/features/users/repo/UsersRepo.ts`

```typescript
import { ApiService, ServerResponse } from 'astra'

export interface User {
  id: string
  name: string
}

class UsersRepo {
  constructor(private api: ApiService) {}

  async getUsers(): Promise<ServerResponse<User[]>> {
    // Uses the injected ApiService instance
    return this.api.get<User[]>('/api/users')
  }
}
```

### Step 2: The ViewModel Layer

The ViewModel manages state. Use `useDataState` to handle loading, error, and success states automatically.

**File:** `src/features/users/viewmodel/useUsersViewModel.ts`

```typescript
import { useEffect } from 'react'
import { useDataState, useApiClient, AppState } from 'astra'
import { UsersRepo, User } from '../repo/UsersRepo'

export const useUsersViewModel = () => {
  const api = useApiClient()
  const usersRepo = new UsersRepo(api)
  
  // 1. Initialize state manager
  // usersState automatically implements the AppState<User[]> interface,
  // providing the view with its independent lifecycle structure.
  const [usersState, setUsersState] = useDataState<User[]>([])

  // 2. Define actions
  const fetchUsers = async () => {
    setUsersState.loading() // sets AppState.state = StateType.LOADING
    
    // The Repository guarantees a ServerResponse<User[]>
    const response = await usersRepo.getUsers()

    // Map the ServerResponse to the ViewModel's internal AppState
    if (response.isSuccess) {
      setUsersState.success(response.data) // updates AppState with data
    } else {
      setUsersState.error(response.error) // updates AppState with error details
    }
  }

  // 3. Load on mount
  useEffect(() => {
    fetchUsers()
  }, [])

  // 4. Expose public API
  return {
    state: usersState, // Contains: data, isLoading, isError, error
    reload: fetchUsers
  }
}
```

### Step 3: The View Layer

Split your UI into a **Stateful Container** and **Stateless Components**.

#### 3a. Stateless Component (The "XML")

This component only renders props. It knows nothing about logic or API calls. **It must exclusively use MUI components and Astra tokens.**

**File:** `src/renderer/src/features/users/view/UsersList.tsx`

```tsx
import { FC } from 'react';
import { User } from '../repo/UsersRepo';
import { Stack, Button, Typography, Paper } from '@mui/material';
import { useLanguage } from 'astra';

interface UsersListProps {
  users: User[];
  onReload: () => void;
}

export const UsersList: FC<UsersListProps> = ({ users, onReload }) => {
  const { literal } = useLanguage();

  return (
    <Stack spacing={2} sx={{ p: 4 }}>
      <Button variant="contained" onClick={onReload}>
        {literal['action.reload']}
      </Button>
      <Stack spacing={1}>
        {users.map((user) => (
          <Paper key={user.id} sx={{ p: 2 }}>
            <Typography variant="body1">{user.name}</Typography>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
};
```

#### 3b. Stateful Container (The "Fragment")

This component connects the ViewModel to the View using `AppStateHandler`.

**File:** `src/features/users/view/UsersContainer.tsx`

```typescript
import { FC } from 'react';
import { AppStateHandler } from 'astra';
import { useUsersViewModel } from '../viewmodel/useUsersViewModel';
import { UsersList } from './UsersList';

export const UsersContainer: FC = () => {
  // 1. Hook into ViewModel
  const { state, reload } = useUsersViewModel();

  // 2. Delegate state handling to Astra
  return (
    <AppStateHandler
      state={state}
      onRetry={reload}
    >
      {/* 3. Render Success View */}
      <UsersList
        users={state.data}
        onReload={reload}
      />
    </AppStateHandler>
  );
};
```

### Step 4: App Initialization

Astra provides core providers that must wrap your application to handle Theme and Localization.

**File:** `src/App.tsx`

```tsx
import { FC } from 'react'
import { ThemeProvider, LanguageProvider } from 'astra'
import { translations, availableLanguages, DEFAULT_LANGUAGE } from './localization/i18n'
import { lightTheme, darkTheme } from './theme/appTheme'
import { MainLayout } from './layout/MainLayout' // Your custom layout
import { UsersContainer } from './features/users/view/UsersContainer'

export const App: FC = () => {
  return (
    <LanguageProvider
      translations={translations}
      availableLanguages={availableLanguages}
      defaultLanguage={DEFAULT_LANGUAGE}
    >
      <ThemeProvider lightTheme={lightTheme} darkTheme={darkTheme}>
        {/* Your Router or Main Layout */}
        <MainLayout>
          <UsersContainer />
        </MainLayout>
      </ThemeProvider>
    </LanguageProvider>
  )
}
```

---

## Reference & Documentation

- **State Management**: See [Hooks Documentation](hooks.md) for `useDataState` and [State Documentation](state.md) for `AppState` definitions.
- **Theming**: See [Theming Documentation](theming.md) for `ThemeProvider`.
- **Localization**: See [Localization Documentation](localization.md).
- **UI Components**: See [Wrapper Components](components/wrapper.md) for details on `AppStateHandler`.

---

## Best Practices

- **Do** keep ViewModels pure (no UI imports like JSX).
- **Do** use `AppStateHandler` to ensure consistent Loading/Error UIs.
- **Don't** make API calls directly in components (even `.tsx`).
- **Don't** put complex logic in `useEffect` inside components; move it to the ViewModel.
