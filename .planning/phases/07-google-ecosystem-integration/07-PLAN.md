---
plan_id: 07-google-ecosystem-integration
wave: 1
depends_on: []
files_modified:
  - src/main/services/googleBridgeService.ts
  - src/main/services/googleOAuthServer.ts
autonomous: true
---

# Phase 7: Google Ecosystem Integration - Execution Plan

## Goal
Establish authenticated channels safely isolating Google OAuth callbacks internally inside an Ephemeral localhost boundary, while mapping specific Sheets, Docs, and Forms sync APIs purely through native Typescript REST Fetch parameters.

## Tasks

<task>
<id>create-oauth-ephemeral-server</id>
<title>Create Ephemeral Localhost OAuth Server</title>
<read_first>
- src/main/services/sqliteConfigStoreService.ts
</read_first>
<action>
1. Create `src/main/services/googleOAuthServer.ts`.
2. Implement a class wrapping native Node `http.createServer`.
3. Export `async launchOAuthCallback(clientId: string, clientSecret: string, port: 3111): Promise<GoogleBridgeCredentials>`.
4. Logic flow: The function opens the listener on `port`, then shells out (`execSync('start ...' / 'open ...')`) firing the browser to `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=http://localhost:3111/auth/callback&response_type=code&scope=...`.
5. The local server explicitly listens for `GET /auth/callback?code=XYZ`. 
6. Inside the server route intercept, `fetch` against `https://oauth2.googleapis.com/token` mapping the `code`, `client_id`, `client_secret` resolving to pull the `access_token` and `refresh_token`.
7. Once resolution fetches the Token response map, shut down the `.close()` listener and return the formatted credentials mapping correctly out to standard execution.
</action>
<acceptance_criteria>
- `googleOAuthServer.ts` is implemented exposing `launchOAuthCallback`.
- Native NodeJS `http` triggers and safely destroys upon successful callback.
- Exchanging the redirect `code` relies strictly upon generic `fetch()` yielding `access_token`.
</acceptance_criteria>
</task>

<task>
<id>implement-raw-google-docs-api</id>
<title>Implement Native Google Docs Upload</title>
<read_first>
- src/main/services/googleBridgeService.ts
</read_first>
<action>
1. In `googleBridgeService.ts`, locate `LiveGoogleDocsPublisher.publishPolicyToDoc`.
2. Generate an OAuth Bearer scoped authorization structure mapping over: `this._credentials.accessToken` (Assume a getter method exists or parse directly if available; note you need a valid access token derived from the refresh token).
3. Use the `upload/drive/v3/files` multipart REST endpoint instead of the standard Docs framework natively.
4. Pass `uploadType=multipart` mapping JSON structural boundaries containing `"mimeType": "application/vnd.google-apps.document"` explicitly alongside the raw HTML block payload.
5. In `LiveGoogleDocsPuller.pullDocToVault`, utilize generic REST querying `https://docs.googleapis.com/v1/documents/${documentId}` pulling JSON bodies directly down and formatting safely.
</action>
<acceptance_criteria>
- `LiveGoogleDocsPublisher` implements `upload/drive/v3/files` mapping an `application/vnd.google-apps.document` payload natively via multipart text arrays.
- `publishPolicyToDoc` and `pullDocToVault` resolve successfully without reliance over `@googleapis/docs`.
</acceptance_criteria>
</task>

<task>
<id>implement-raw-google-sheets-api</id>
<title>Implement Native Google Sheets & Forms Resolvers</title>
<read_first>
- src/main/services/googleBridgeService.ts
</read_first>
<action>
1. In `googleBridgeService.ts`, edit `LiveGoogleSheetsGateway.listStaffRows`.
2. Generate an OAuth Bearer scoped `fetch` mapping: `https://sheets.googleapis.com/v4/spreadsheets/${this._spreadsheetId}/values/Staff!A:Z`.
3. Inside `LiveGoogleFormsGateway.listFeedbackResponses`, generate a mapping via `https://forms.googleapis.com/v1/forms/${id}/responses`. 
4. Parse the raw JSON responses and map them strictly onto `GoogleSheetStaffRow` and `GoogleFormFeedbackResponse` objects explicitly replacing the current `console.log` placeholders.
</action>
<acceptance_criteria>
- `LiveGoogleSheetsGateway` parses explicit `fetch` APIs querying JSON spreadsheet mappings accurately.
- Responses correctly convert un-nested JSON arrays explicitly into standard typed object models matching interface definitions structurally.
</acceptance_criteria>
</task>

<task>
<id>optimize-cron-scheduling</id>
<title>Redefine Polling Cron Execution Constraints</title>
<read_first>
- src/main/services/googleBridgeService.ts
</read_first>
<action>
1. Locate `GOOGLE_SYNC_CRON_EXPRESSION` inside `googleBridgeService.ts`.
2. Change the assignment mapping from `0 */12 * * *` literally into `0 0 * * *` enforcing standard single-day executions conservatively across generic constraints globally avoiding Webhook penalties effectively. 
</action>
<acceptance_criteria>
- Constant string literal `GOOGLE_SYNC_CRON_EXPRESSION` resolves exclusively over `0 0 * * *`.
</acceptance_criteria>
</task>

## Verification Strategy
- Perform full Node module Typecheck evaluations verifying HTTP maps correctly compile.
- Create explicit local testing execution mapping generic `curl` HTTP tests against a live initialized mock `http.createServer()` boundary natively guaranteeing the server intercepts callback parameters effectively returning valid API responses physically.

## Must Haves
- Pure native TS `fetch()`. No explicit `@googleapis/` dependencies permitted cleanly inside the `.package.json`.
- Strict mapping closures over internal node port triggers accurately terminating server listening events on resolution or timeout.
