# 03 Organism Complex UI

## Goal
Higher-order reusable UI blocks with richer composition while keeping domain orchestration outside the component.

---

## ReviewActionModal

Path: `src/ui/shared-components/ReviewActionModal.tsx`

User story:
As a reviewer, I need approve/reject interactions with mandatory reject rationale so decisions are auditable.

State contract:
- Controlled open/close and loading states.
- Internal state remains UI-only text/mode.

API definition:
```ts
export interface ReviewActionModalProps {
  isOpen: boolean;
  title?: string;
  entityType: string;
  entityName?: string;
  entitySummary?: string;
  onApprove: (reviewNote?: string) => void;
  onReject: (reviewNote: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}
```

---

## SyncHealthWidget

Path: `src/ui/shared-components/SyncHealthWidget.tsx`

User story:
As an operator, I need a sync-health control widget so I can monitor status and trigger push/pull safely.

State contract:
- Fully controlled by props.
- No direct import from app-specific services.

Generalization notes:
- Keep shape exported as public contract type.
- Use neutral status labels and callback names.

---

## Non-Promotion Notes

Components intentionally kept in Prana:
- `DynamicProfileRenderer`: tightly coupled to lifecycle state contracts.
- `DirectorInteractionBar`: coupled to employee directory semantics and app sender identity.
- `MainLayout`: route/state orchestration and app-shell concerns.
