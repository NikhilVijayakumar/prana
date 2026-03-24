# State Management Documentation

## AppState

`AppState` is the core interface used throughout the Astra library to represent the state of data-driven features. It provides a consistent structure for ViewModels and UI components to consume.

### Interface Definition

```typescript
export interface AppState<T> {
  state: StateType
  isError: boolean
  isSuccess: boolean
  status: HttpStatusCode
  statusMessage: string
  data: T | null
}
```

### StateType Enum

The `StateType` enum defines the high-level lifecycle of a data operation:

```typescript
export enum StateType {
  INIT = 0, // Initial state, no action taken yet
  LOADING = 1, // Operation in progress
  COMPLETED = 2 // Operation finished (success or failure)
}
```

### Best Practices

1.  **Immutability**: Always treat `AppState` as immutable. Use the `execute` helper from `useDataState` or properly spread previous state when updating manually.
2.  **Type Safety**: Always specify the generic type `T` (e.g., `AppState<User[]>`) to ensure type safety for the `data` property.
3.  **Consistency**: Use `AppState` in conjunction with `ServerResponse` from the Repository layer and `useDataState` in the ViewModel layer to maintain a consistent data flow.
