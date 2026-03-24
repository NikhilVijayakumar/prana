# Hooks Documentation

## useDataState

The `useDataState` hook is a custom hook designed to manage the state of asynchronous data operations, typically API calls. It simplifies the process of handling different states like loading, success, error, and idle.

### Usage

```typescript
import { useDataState } from 'astra';
import { User } from './types';

// DIRECT USAGE (Not Recommended for Production)
const MyComponent = () => {
  const [state, execute] = useDataState<User[]>();

  const loadUsers = async () => {
    await execute(() => api.getUsers());
  };

  if (state.state === StateType.LOADING) return <LoadingSpinner />;
  // ...
};
```

### API

#### Parameters

- `customInitialState` (optional): `Partial<AppState<T>>` - Allows overriding the default initial state values.

#### Return Value

The hook returns a tuple `[appState, execute, setAppState]`:

1.  **`appState`**: `AppState<T>` - The current state object (INIT, LOADING, COMPLETED, data, error, etc.).
2.  **`execute`**: `(apiCall: () => Promise<ServerResponse<T>>) => Promise<void>` - Helper to auto-manage state transitions.
3.  **`setAppState`**: `React.Dispatch<React.SetStateAction<AppState<T>>>` - Manual state setter.

---

## Architectural Recommendation: The ViewModel Pattern

While `useDataState` can be used directly in components, **Astra strongly recommends always wrapping it in a ViewModel (Custom Hook)**.

### Why Use a ViewModel?

1.  **Separation of Concerns**: Keeps UI logic (Components) separate from Business logic (ViewModels).
2.  **Composition**: Allows managing multiple simultaneous API states (e.g., a list loading while a delete action is pending).
3.  **Consistency**: Provides a uniform interface for components, regardless of complexity.

### Pattern: ViewModel as Orchestrator

For features needing multiple API calls (CRUD), do not try to reuse a single `useDataState` hook. Instead, compose multiple hooks within one ViewModel.

#### Example: Complex User ViewModel

```typescript
export const useUsersViewModel = () => {
  // 1. State for the Main List (GET /users)
  const [listState, executeList] = useDataState<User[]>()

  // 2. State for a Specific User Detail (GET /users/:id)
  const [detailState, executeDetail] = useDataState<User>()

  // 3. State for an Action (DELETE /users/:id)
  // Use 'boolean' or 'void' since we only care about success/failure status
  const [deleteState, executeDelete] = useDataState<boolean>()

  // --- Actions ---

  const loadUsers = () => executeList(() => api.getUsers())

  const selectUser = (id: string) => executeDetail(() => api.getUser(id))

  const deleteUser = async (id: string) => {
    // Run the delete operation
    await executeDelete(() => api.deleteUser(id))

    // ORCHESTRATION: If delete succeeded, reload the list
    if (deleteState.isSuccess) {
      await loadUsers()
    }
  }

  // --- Public Interface for the View ---
  return {
    // Data
    users: listState.data,
    selectedUser: detailState.data,

    // Granular Loading States (allows UI to show specific spinners)
    isListLoading: listState.state === StateType.LOADING,
    isDeleting: deleteState.state === StateType.LOADING,

    // Actions
    loadUsers,
    selectUser,
    deleteUser
  }
}
```
