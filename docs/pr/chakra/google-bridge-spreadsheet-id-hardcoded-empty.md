# Bug: GoogleBridgeService hardcodes empty spreadsheetId — env var ignored

## File
`src/main/services/googleBridgeService.ts` — `GoogleBridgeService` constructor (~line 442)

## Description
The constructor sets `const spreadsheetId = '';` unconditionally. This means
`MAIN_VITE_CHAKRA_GOOGLE_EMPLOYEE_SHEET_ID` (and equivalent Prana env aliases) is
never read by `GoogleBridgeService`. As a result:

- `LiveGoogleSheetsGateway` is never instantiated even when credentials and a
  sheet ID are configured.
- `getSnapshot()` always reports `sheetsConnected: false`.
- `listStaffRows()` always returns `[]` from the no-op fallback.

## Reproduction
Set valid OAuth credentials and `MAIN_VITE_CHAKRA_GOOGLE_EMPLOYEE_SHEET_ID` in
`.env`, authenticate via `chakra:google-auth-start`, then call
`operations:get-google-bridge-snapshot`. The snapshot will show
`sheetsConnected: false` and `spreadsheetId: ''`.

## Expected behaviour
`GoogleBridgeService` should read the spreadsheet ID from
`sqliteConfigStoreService` or from the runtime env (via `readMainEnv`) the same
way it reads OAuth credentials, then pass it to `LiveGoogleSheetsGateway`.

## Suggested fix (Prana change)
```typescript
// In GoogleBridgeService constructor, replace:
const spreadsheetId = '';

// With something like:
const googleConfig = sqliteConfigStoreService.readSnapshotSync()?.config?.google;
const spreadsheetId = googleConfig?.spreadsheetId
  ?? readMainEnv('CHAKRA_GOOGLE_EMPLOYEE_SHEET_ID')
  ?? readMainEnv('DHI_GOOGLE_EMPLOYEE_SHEET_ID')
  ?? '';
```

## Impact on Chakra
Chakra's own `googleSheetsService.ts` + `sheetsSyncService.ts` bypass
`GoogleBridgeService` entirely and call the Sheets API directly with the
spreadsheet ID from `runtimeEnvValue('GOOGLE_EMPLOYEE_SHEET_ID')`. The Chakra
employee-sync path is therefore **not affected** by this bug.

This bug only affects the `operations:*` IPC handlers that delegate to
`googleBridgeService` (Google Drive sync, policy publishing, forms ingestion).
