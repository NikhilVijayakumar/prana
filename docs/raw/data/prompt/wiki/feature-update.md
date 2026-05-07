# Feature-Specific Wiki Update (Generic)

**Trigger**: Update wiki for a single feature when only one feature in `docs/raw/features/` changed.

**Context**:
- Source: `docs/raw/features/{category}/{feature}.md`
- Target: `docs/wiki/features/{feature}.md` or update index
- Template: See `docs/core.md`
- Lightweight update - only touch what's necessary

**Works for**: Any language/framework

---

## Your Task

Update only wiki pages related to one feature that changed in `docs/raw/features/`.

**When to use**:
- User modified one feature doc
- User added one new feature
- User wants to refresh one feature without touching others

---

## Input

### Required: Feature Path

```
docs/raw/features/{category}/{feature-name}.md
```

**Examples**:
- `docs/raw/features/storage/vault.md`
- `docs/raw/features/api/users.md`
- `docs/raw/features/auth/login.md`

---

## Update Steps

### Step 1: Identify Feature

1. Parse: `{category}/{feature-name}`
2. Determine category from directory structure
3. Determine feature name from filename

### Step 2: Find Existing Wiki Pages

| Path | Action |
|------|--------|
| `docs/wiki/features/index.md` | Update (add/remove entry) |
| `docs/wiki/features/{feature}.md` | Create or update |
| `docs/wiki/runtime-maps/` | Check related runtime map |
| `docs/wiki/architecture/` | Check related invariant impact |

### Step 3: Update Features Index

In `docs/wiki/features/index.md`:

```markdown
### {Category}

| Feature | Status | Wiki Page |
|---------|--------|-----------|
| {Feature Name} | ✅ Active | [[features-{feature-name}]] |
```

- New: add row
- Modified: update row  
- Deleted: remove row

### Step 4: Create/Update Feature Detail Page

**New page**:
```markdown
# {Feature Name}

**Summary**: One-line purpose.

**Source**: `docs/raw/features/{category}/{feature}.md`

**Last Updated**: {YYYY-MM-DD}

---

## Key Takeaways

- {Essential info 1}
- {Essential info 2}
- {Essential info 3}

---

## Feature Details

{Key sections from source, concise}

---

## Related Pages

- [[features-index]]
- [[runtime-map-{related}]] (if exists)
- [[architecture-{related}]] (if applicable)
```

**Update existing**:
- Update Last Updated date
- Refresh Key Takeaways if content changed
- Fix broken links

### Step 5: Update Related Pages

Check if feature relates to:
- **Runtime map**: Update index link
- **Architecture**: Update invariant page if compliance changed

### Step 6: Log the Change

```markdown
## Update: {YYYY-MM-DD}

### Feature Update
- Updated: {category}/{feature}.md
- Action: {Added|Modified|Removed}
```

---

## Example Workflows

### Modified Feature

**Input**: `docs/raw/features/storage/vault.md` edited

**Steps**:
1. Read source file
2. Read/update wiki page
3. Update index entry
4. Check related runtime map
5. Log change

### New Feature

**Input**: `docs/raw/features/ai/agent.md` added

**Steps**:
1. Read source
2. Create wiki page
3. Add to index
4. Check/create runtime map
5. Log change

### Deleted Feature

**Input**: `docs/raw/features/legacy/old.md` removed

**Steps**:
1. Remove wiki page
2. Remove from index
3. Check related runtime map (mark deprecated)
4. Log change

---

## Constraints

1. **Minimal touch**: Only affected pages
2. **Preserve**: Don't remove wiki content unless source deleted
3. **Link integrity**: All `[[wiki-links]]` resolve after changes
4. **Verification**: Optional - only if architecture invariant affected

---

## Success Criteria

- [ ] Feature page created/updated in docs/wiki/features/
- [ ] Index updated in docs/wiki/features/index.md
- [ ] Related runtime-map link updated (if applicable)
- [ ] Change logged in docs/wiki/log.md
- [ ] All links resolve correctly
- [ ] Works for any language/framework