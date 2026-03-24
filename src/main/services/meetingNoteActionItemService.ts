export interface ActionItem {
  id: string;
  description: string;
  owner: string | null;
  dueDate: string | null;
  status: 'open' | 'completed';
  policyImpact: 'no_change' | 'possible_change' | 'confirmed_change';
}

export interface MeetingNoteDigest {
  title: string;
  date: string | null;
  participants: string[];
  decisions: string[];
  actionItems: ActionItem[];
  policyImpactSummary: {
    noChange: number;
    possibleChange: number;
    confirmedChange: number;
  };
}

const POLICY_CHANGE_KEYWORDS = new Set([
  'policy', 'update', 'revise', 'amend', 'change', 'modify',
  'new-rule', 'regulation', 'compliance', 'governance',
  'mandate', 'requirement', 'enforce', 'approve', 'reject',
]);

const CONFIRMED_CHANGE_SIGNALS = new Set([
  'approved', 'decided', 'confirmed', 'finalized', 'ratified',
  'enacted', 'mandated', 'effective-immediately', 'must-update',
]);

const extractTitle = (content: string): string => {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
  }
  return 'Untitled Meeting Notes';
};

const ISO_DATE_REGEX = /\d{4}-\d{2}-\d{2}/;

const extractDate = (content: string): string | null => {
  const lines = content.split('\n').slice(0, 10);
  for (const line of lines) {
    const match = line.match(ISO_DATE_REGEX);
    if (match) {
      return match[0];
    }
  }
  return null;
};

const PARTICIPANTS_PATTERN = /^(?:participants|attendees|present)\s*[:：]\s*(.+)/i;

const extractParticipants = (content: string): string[] => {
  const lines = content.split('\n');
  const participants: string[] = [];

  for (const line of lines) {
    const match = line.trim().match(PARTICIPANTS_PATTERN);
    if (match) {
      const names = match[1]
        .split(/[,;]/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
      participants.push(...names);
    }
  }

  return [...new Set(participants)];
};

const DECISION_PATTERN = /^(?:[-*])\s*(?:decision|decided|agreed)\s*[:：]\s*(.+)/i;
const DECISION_SECTION_HEADER = /^#{1,3}\s*decisions?\b/i;

const extractDecisions = (content: string): string[] => {
  const lines = content.split('\n');
  const decisions: string[] = [];
  let inDecisionSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (DECISION_SECTION_HEADER.test(trimmed)) {
      inDecisionSection = true;
      continue;
    }

    if (inDecisionSection && /^#{1,3}\s/.test(trimmed) && !DECISION_SECTION_HEADER.test(trimmed)) {
      inDecisionSection = false;
      continue;
    }

    if (inDecisionSection && /^[-*]\s/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, '').trim();
      if (text.length > 0) {
        decisions.push(text);
      }
      continue;
    }

    const match = trimmed.match(DECISION_PATTERN);
    if (match) {
      decisions.push(match[1].trim());
    }
  }

  return decisions;
};

const ACTION_CHECKBOX_PATTERN = /^-\s*\[([ xX])\]\s*(?:ACTION\s*[:：]\s*)?(.+)/;
const OWNER_PATTERN = /@([a-zA-Z0-9_-]+)/;
const DUE_PATTERN = /(?:due|deadline)\s*[:：]\s*(\d{4}-\d{2}-\d{2})/i;
const ACTION_SECTION_HEADER = /^#{1,3}\s*action\s*items?\b/i;

const extractActionItems = (content: string): ActionItem[] => {
  const lines = content.split('\n');
  const items: ActionItem[] = [];
  let counter = 0;
  let inActionSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (ACTION_SECTION_HEADER.test(trimmed)) {
      inActionSection = true;
      continue;
    }

    if (inActionSection && /^#{1,3}\s/.test(trimmed) && !ACTION_SECTION_HEADER.test(trimmed)) {
      inActionSection = false;
      continue;
    }

    const checkboxMatch = trimmed.match(ACTION_CHECKBOX_PATTERN);
    if (checkboxMatch) {
      counter += 1;
      const isCompleted = checkboxMatch[1].toLowerCase() === 'x';
      const rawText = checkboxMatch[2].trim();

      const ownerMatch = rawText.match(OWNER_PATTERN);
      const dueMatch = rawText.match(DUE_PATTERN);

      const description = rawText
        .replace(OWNER_PATTERN, '')
        .replace(DUE_PATTERN, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      items.push({
        id: `AI-${String(counter).padStart(3, '0')}`,
        description,
        owner: ownerMatch ? ownerMatch[1] : null,
        dueDate: dueMatch ? dueMatch[1] : null,
        status: isCompleted ? 'completed' : 'open',
        policyImpact: classifySingleActionPolicyImpact(description),
      });
      continue;
    }

    if (inActionSection && /^[-*]\s/.test(trimmed)) {
      counter += 1;
      const rawText = trimmed.replace(/^[-*]\s+/, '').trim();

      const ownerMatch = rawText.match(OWNER_PATTERN);
      const dueMatch = rawText.match(DUE_PATTERN);

      const description = rawText
        .replace(OWNER_PATTERN, '')
        .replace(DUE_PATTERN, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      items.push({
        id: `AI-${String(counter).padStart(3, '0')}`,
        description,
        owner: ownerMatch ? ownerMatch[1] : null,
        dueDate: dueMatch ? dueMatch[1] : null,
        status: 'open',
        policyImpact: classifySingleActionPolicyImpact(description),
      });
    }
  }

  return items;
};

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
};

const classifySingleActionPolicyImpact = (
  description: string,
): 'no_change' | 'possible_change' | 'confirmed_change' => {
  const tokens = tokenize(description);

  let hasPolicy = false;
  let hasConfirmed = false;

  for (const token of tokens) {
    if (POLICY_CHANGE_KEYWORDS.has(token)) {
      hasPolicy = true;
    }
    if (CONFIRMED_CHANGE_SIGNALS.has(token)) {
      hasConfirmed = true;
    }
  }

  if (hasPolicy && hasConfirmed) {
    return 'confirmed_change';
  }
  if (hasPolicy) {
    return 'possible_change';
  }
  return 'no_change';
};

export const classifyPolicyImpact = (
  actionItems: ActionItem[],
): { noChange: number; possibleChange: number; confirmedChange: number } => {
  let noChange = 0;
  let possibleChange = 0;
  let confirmedChange = 0;

  for (const item of actionItems) {
    if (item.policyImpact === 'confirmed_change') {
      confirmedChange += 1;
    } else if (item.policyImpact === 'possible_change') {
      possibleChange += 1;
    } else {
      noChange += 1;
    }
  }

  return { noChange, possibleChange, confirmedChange };
};

export const parseMeetingNotes = (content: string): MeetingNoteDigest => {
  const title = extractTitle(content);
  const date = extractDate(content);
  const participants = extractParticipants(content);
  const decisions = extractDecisions(content);
  const actionItems = extractActionItems(content);
  const policyImpactSummary = classifyPolicyImpact(actionItems);

  return {
    title,
    date,
    participants,
    decisions,
    actionItems,
    policyImpactSummary,
  };
};

export class MeetingNoteActionItemService {
  extractActionItems(markdownContent: string): MeetingNoteDigest {
    return parseMeetingNotes(markdownContent);
  }

  classifyPolicyImpact(
    actionItems: ActionItem[],
  ): { noChange: number; possibleChange: number; confirmedChange: number } {
    return classifyPolicyImpact(actionItems);
  }
}

export const meetingNoteActionItemService = new MeetingNoteActionItemService();
