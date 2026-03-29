# GAP-017: Governance Review UI Enhancements

## Scope
Renderer-side validation, feedback collection, and filtering UI for lifecycle draft and cron proposal review queues.

## Current Implementation State
Γ£à **Completed** (from prior session):
- Lifecycle draft queue state integrated into LifecycleProvider.
- Cron proposal queue and task audit log added to settings viewmodel.
- Lifecycle manager page renders draft queue with approve/reject buttons.
- Settings view renders schedule proposal queue with approve/reject buttons.
- Task audit log panel visible in settings view.
- TypeScript compilation passing (node + web).

## Current Gaps

### 1. Mandatory Reject Comment Not Enforced
- **Current Behavior**: Reject action accepts optional `reviewNote`. No UI requirement to provide feedback.
- **Risk**: AI cannot improve rejected proposals without knowing the reason; operational visibility reduced.
- **Requirement**: User explicitly stated: "reject comment should be mandatory so that ai know why it is rejected and improve it."
- **Impact**: Both lifecycle draft and cron proposal reject flows affected.

### 2. No Status Filtering UI
- **Current Behavior**: Draft and proposal queues show only PENDING items by default.
- **API Support**: `listLifecycleDrafts(status)` and `listCronProposals(status)` accept status filters (PENDING, APPROVED, REJECTED, OVERRIDDEN).
- **Missing UI**: No tabs or selector to switch between status views.
- **Risk**: Historical context (approved/rejected/overridden items) not visible; audit trail feels incomplete in UI.

### 3. No Dedicated Queue Orchestration Page
- **Current Behavior**: Governance queues split across lifecycle manager (drafts) and settings (proposals, audit).
- **Missing**: Consolidated queue management with advanced filtering, search, bulk actions.
- **Priority**: Low (optional enhancement); can defer.

### 4. Reviewer Note Input Not Wired
- **Current Behavior**: `reviewNote` field accepted in API but not collected from UI.
- **Missing**: Modal or inline form to capture reviewer feedback for approvals and mandatory feedback for rejections.
- **Impact**: Cannot record why approve was accepted; cannot enforce mandatory comment on reject.

## Fix Plan

### Phase 1 (HIGH Priority): Mandatory Reject Comment + Feedback UI
1. **Create `ReviewActionModal` component** (`src/renderer/src/features/settings/components/ReviewActionModal.tsx`):
   - Props: `isOpen`, `entityType`, `entityName`, `onApprove`, `onReject`, `onCancel`.
   - Layout: Shows entity summary, two action buttons (Approve, Reject).
   - Approve button: Optional `reviewNote` TextField; always enabled.
   - Reject button: Required `reviewNote` TextField; disabled until minLength >= 4 characters.
   - Validation: Client-side check before calling callbacks.

2. **Integrate into Lifecycle Manager Page**:
   - Replace inline approve/reject buttons with modal trigger.
   - Show draft entity type, ID, and proposed JSON in modal summary.
   - Pass `reviewNote` to `reviewLifecycleDraft(draftId, status, reviewNote)`.

3. **Integrate into Settings Proposal Queue**:
   - Replace inline approve/reject buttons with modal trigger.
   - Show proposal name, expression, and created timestamp in modal summary.
   - Pass `reviewNote` to `reviewCronProposal(proposalId, status, reviewNote)`.

4. **Update Localization** (`docs/localization/i18n.ts`):
   - Add keys: `settings.review.modal.title`, `.approveLabel`, `.rejectLabel`, `.noteLabel`, `.noteRequired`, `.noteMinLength`.

5. **Update Viewmodels** to handle `reviewNote`:
   - `useSettingsViewModel.reviewScheduleProposal()` already passes reviewNote through.
   - `LifecycleProvider.reviewLifecycleDraft()` already passes reviewNote through.
   - No viewmodel changes needed; wiring complete.

### Phase 2 (MEDIUM Priority): Status Filtering Tabs
1. **Add Tabs component to Lifecycle Manager**:
   - Tab options: PENDING | APPROVED | REJECTED | OVERRIDDEN.
   - Default: PENDING.
   - On tab change: call `refreshLifecycleDrafts(selectedStatus)`.
   - Render filtered draft queue below tabs.

2. **Add Tabs component to Settings Proposal Queue**:
   - Tab options: PENDING | APPROVED | REJECTED | OVERRIDDEN.
   - Default: PENDING.
   - On tab change: call `refreshCronProposals(selectedStatus)` via viewmodel.
   - Render filtered proposal queue below tabs.

3. **Update Viewmodels & Provider**:
   - `LifecycleProvider.refreshLifecycleDrafts(status)` signature already supports status param.
   - Settings viewmodel method already supports status filtering.
   - No API changes needed; just UI wiring.

### Phase 3 (LOW Priority - Optional): Queue Orchestration Page
1. Create dedicated `src/renderer/src/features/management/pages/QueueOrchestrationPage.tsx`.
2. Consolidate lifecycle drafts + cron proposals + task audit in one view.
3. Add unified search, multi-select filter, bulk approval/rejection actions.
4. Link from main nav or settings sidebar (defer routing decision).
5. Can be done incrementally; not blocking Phase 1 & 2.

## Tests Required
- Γ£à ReviewActionModal: renders correctly, validates reject note field, enables Approve always.
- Γ£à Lifecycle Manager: modal triggered on approve/reject click, passes reviewNote correctly.
- Γ£à Settings Proposal Queue: modal triggered on approve/reject click, passes reviewNote correctly.
- Γ£à Tabs integration: switching status filters refetches appropriate queue.
- Γ£à TypeScript: all changes pass `npm run typecheck`.

## Documentation Updates Required
- **docs/module/management-suite.md**: Add section on ReviewActionModal usage, status filtering UI, mandatory reject comment policy.
- **docs/module/queue-visualization.md**: (if exists) Update to reference new filtering tabs and orchestration page (when implemented).
- **docs/astra/CR/ReviewActionModal.md**: Create CR for potential upstream promotion to Astra.

## Performance Considerations
- ReviewActionModal: lightweight stateless component, no async logic.
- Status filtering: leverages existing repo methods; no new queries.
- Filter state: kept local to each page (lifecycle manager + settings); no global state pollution.

## Dependencies
- MUI components: Dialog, TextField, Button, Tab (already available).
- Astra: useLanguage hook (already available).
- No new package dependencies required.
