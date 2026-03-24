import { describe, expect, it } from 'vitest';
import { parseMeetingNotes, classifyPolicyImpact } from './meetingNoteActionItemService';

const SAMPLE_MEETING_NOTES = `# Weekly Administration Meeting Notes

Date: 2026-03-20

Participants: Alice Admin, Bob Builder, Eva Compliance

## Agenda

- Budget review
- Attendance policy update
- New hiring plan

## Decisions

- Decided: Increase Q2 training budget by 15%.
- Decided: Adopt new attendance tracking system starting April.

## Action Items

- [ ] ACTION: Draft updated attendance policy document @alice due: 2026-03-25
- [ ] ACTION: Review compliance requirements for new tracking system @eva due: 2026-03-22
- [x] ACTION: Submit Q1 report to director @bob due: 2026-03-18
- [ ] Update governance policy to reflect approved budget changes @alice due: 2026-03-27

## Notes

General discussion on team morale and upcoming events.
`;

const MINIMAL_NOTES = `# Quick Standup

- [ ] Fix build pipeline @dev
- [ ] ACTION: Deploy staging environment @ops due: 2026-04-01
`;

const POLICY_HEAVY_NOTES = `# Policy Review Session

Date: 2026-03-21

Participants: Eva, Arya

## Action Items

- [ ] ACTION: Amend security compliance policy — approved changes from audit @eva due: 2026-03-28
- [ ] ACTION: Update governance regulation mandate — finalized by director @arya due: 2026-03-30
- [ ] ACTION: Schedule team lunch @mira
`;

describe('meetingNoteActionItemService parseMeetingNotes', () => {
  it('extracts title from first heading', () => {
    const digest = parseMeetingNotes(SAMPLE_MEETING_NOTES);
    expect(digest.title).toBe('Weekly Administration Meeting Notes');
  });

  it('extracts date from content', () => {
    const digest = parseMeetingNotes(SAMPLE_MEETING_NOTES);
    expect(digest.date).toBe('2026-03-20');
  });

  it('extracts participants', () => {
    const digest = parseMeetingNotes(SAMPLE_MEETING_NOTES);
    expect(digest.participants).toContain('Alice Admin');
    expect(digest.participants).toContain('Bob Builder');
    expect(digest.participants).toContain('Eva Compliance');
  });

  it('extracts decisions from decision section', () => {
    const digest = parseMeetingNotes(SAMPLE_MEETING_NOTES);
    expect(digest.decisions).toHaveLength(2);
    expect(digest.decisions[0]).toContain('training budget');
  });

  it('extracts action items with owners and due dates', () => {
    const digest = parseMeetingNotes(SAMPLE_MEETING_NOTES);
    expect(digest.actionItems.length).toBeGreaterThanOrEqual(4);

    const aliceItem = digest.actionItems.find((a) => a.owner === 'alice');
    expect(aliceItem).toBeDefined();
    expect(aliceItem?.dueDate).toBe('2026-03-25');
    expect(aliceItem?.status).toBe('open');
  });

  it('marks completed checkboxes', () => {
    const digest = parseMeetingNotes(SAMPLE_MEETING_NOTES);
    const completed = digest.actionItems.find((a) => a.owner === 'bob');
    expect(completed?.status).toBe('completed');
  });

  it('handles minimal notes without sections', () => {
    const digest = parseMeetingNotes(MINIMAL_NOTES);
    expect(digest.title).toBe('Quick Standup');
    expect(digest.actionItems.length).toBeGreaterThanOrEqual(2);
  });

  it('returns default title when no heading exists', () => {
    const digest = parseMeetingNotes('Just some text without headings.');
    expect(digest.title).toBe('Untitled Meeting Notes');
  });
});

describe('meetingNoteActionItemService classifyPolicyImpact', () => {
  it('detects policy-related action items', () => {
    const digest = parseMeetingNotes(SAMPLE_MEETING_NOTES);
    const impact = classifyPolicyImpact(digest.actionItems);

    expect(impact.possibleChange + impact.confirmedChange).toBeGreaterThanOrEqual(1);
  });

  it('detects confirmed policy changes with strong signals', () => {
    const digest = parseMeetingNotes(POLICY_HEAVY_NOTES);
    const impact = classifyPolicyImpact(digest.actionItems);

    expect(impact.confirmedChange).toBeGreaterThanOrEqual(1);
  });

  it('classifies non-policy items as no_change', () => {
    const digest = parseMeetingNotes(POLICY_HEAVY_NOTES);
    const lunchItem = digest.actionItems.find((a) => a.owner === 'mira');

    expect(lunchItem?.policyImpact).toBe('no_change');
  });

  it('returns all zeros for empty action items', () => {
    const impact = classifyPolicyImpact([]);
    expect(impact.noChange).toBe(0);
    expect(impact.possibleChange).toBe(0);
    expect(impact.confirmedChange).toBe(0);
  });
});
