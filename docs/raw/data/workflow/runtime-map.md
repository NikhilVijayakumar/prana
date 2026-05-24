# Runtime Map Workflow

## Generate a new runtime map

1. Open `docs/raw/data/prompt/runtime-map/runtime-map.md` in a text editor
2. Below the LLM Instructions section, add the feature's input data:
   - Feature doc content
   - Source file list
   - Source code (concatenated with file headers)
   - Template structure
3. Copy the entire composed prompt
4. Paste into Claude (or any LLM)
5. Claude returns a JSON with `runtimeMapContent`
6. Save the content as `docs/raw/architecture/runtime-map/{feature-name}.md`

## Grade and index existing maps

```powershell
python scripts/runtime-map-grade.py --report
python scripts/runtime-map-index.py
```

## File reference

| File | Purpose |
|------|---------|
| `docs/raw/data/prompt/runtime-map/runtime-map.md` | LLM prompt template for generating a single feature runtime map |
| `docs/raw/data/template/runtime_map_template.md` | Canonical structure reference |
| `scripts/runtime-map-grade.py` | Score all existing runtime maps, optionally generate report |
| `scripts/runtime-map-index.py` | Regenerate the index from all runtime map metadata |
