export interface KnowledgeEntry {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly tags: readonly string[];
}

const DISCOVERY_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'discovery-stormcaller',
    title: 'Qualification Signals Checklist',
    summary:
      'Use budget, urgency, business pain, and decision process as the core discovery signals for a first qualification pass.',
    tags: ['qualification', 'budget', 'urgency', 'decision', 'discovery']
  },
  {
    id: 'discovery-bell',
    title: 'Discovery Question Sequence',
    summary:
      'A short pattern that starts with business goals, then blockers, then success measures to keep early conversations focused.',
    tags: ['questions', 'goals', 'blockers', 'success', 'sequence']
  },
  {
    id: 'discovery-harbor',
    title: 'Opportunity Framing Notes',
    summary: 'Summaries land best when they restate the customer need, the likely fit, and the clearest next step.',
    tags: ['summary', 'fit', 'need', 'next-step', 'opportunity']
  }
] as const;

const PLANNING_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'planning-ruby',
    title: 'Account Priority Map',
    summary:
      'Anchor the plan on business outcomes, active stakeholders, delivery risks, and the next committed milestone.',
    tags: ['account', 'priority', 'stakeholders', 'risk', 'milestone']
  },
  {
    id: 'planning-atlas',
    title: 'Engagement Motion Guide',
    summary:
      'Choose among executive alignment, technical validation, or adoption recovery based on the account signal the user provides.',
    tags: ['engagement', 'executive', 'technical', 'adoption', 'motion']
  },
  {
    id: 'planning-risk',
    title: 'Risk Review Prompts',
    summary:
      'Surface timeline risk, unclear ownership, low sponsor engagement, and missing success criteria before recommending a plan.',
    tags: ['risk', 'timeline', 'ownership', 'sponsor', 'success']
  }
] as const;

const STAFFING_ENTRIES: readonly KnowledgeEntry[] = [
  {
    id: 'staffing-account-lead',
    title: 'Strategic Account Lead',
    summary: 'Owns executive alignment, multi-team coordination, and the overall engagement plan for complex accounts.',
    tags: ['lead', 'executive', 'coordination', 'engagement', 'strategy']
  },
  {
    id: 'staffing-solution-specialist',
    title: 'Solution Specialist',
    summary:
      'Handles product fit, technical storytelling, and proof planning when the account needs deeper solution confidence.',
    tags: ['solution', 'technical', 'fit', 'proof', 'planning']
  },
  {
    id: 'staffing-customer-success-partner',
    title: 'Customer Success Partner',
    summary:
      'Focuses on adoption signals, operational blockers, and expansion readiness after the initial plan is in motion.',
    tags: ['success', 'adoption', 'operations', 'expansion', 'readiness']
  }
] as const;

function normalise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreEntry(queryWords: readonly string[], entry: KnowledgeEntry): number {
  const haystack = [...entry.tags, entry.title, entry.summary].join(' ').toLowerCase();
  return queryWords.reduce((score, word) => (haystack.includes(word) ? score + 1 : score), 0);
}

function lookup(entries: readonly KnowledgeEntry[], query: string): readonly KnowledgeEntry[] {
  const words = normalise(query);
  const ranked = entries
    .map((entry) => ({ entry, score: words.length === 0 ? 1 : scoreEntry(words, entry) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, 3)
    .map((item) => item.entry);

  return ranked.length > 0 ? ranked : entries.slice(0, 2);
}

export function lookupDiscoveryKnowledge(query: string): readonly KnowledgeEntry[] {
  return lookup(DISCOVERY_ENTRIES, query);
}

export function lookupPlanningKnowledge(query: string): readonly KnowledgeEntry[] {
  return lookup(PLANNING_ENTRIES, query);
}

export function lookupStaffingKnowledge(query: string): readonly KnowledgeEntry[] {
  return lookup(STAFFING_ENTRIES, query);
}
