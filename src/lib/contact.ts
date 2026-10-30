// Contact form options (brief section 5, Contact). The page renders them now; the
// Phase 3 /api/contact route validates against the same values.

export interface Option {
  value: string;
  label: string;
}

/** Topics: the services (from the collection, in editor order), then the fixed extras. */
export function contactTopics(services: { id: string; data: { name: string } }[]): Option[] {
  return [
    ...services.map((service) => ({ value: service.id, label: service.data.name })),
    { value: 'audit', label: 'One Step Audit' },
    { value: 'kadi', label: 'Kadi rental' },
    { value: 'other', label: 'Something else' },
  ];
}

// Budget bands are form answers, not prices: BR-1 reads them to decide on the call link.
export const BUDGETS: Option[] = [
  { value: 'under-500', label: 'Under $500' },
  { value: '500-1500', label: '$500–1,500' },
  { value: '1500-5000', label: '$1,500–5,000' },
  { value: '5000-plus', label: '$5,000+' },
];

export const TIMELINES: Option[] = [
  { value: 'this-month', label: 'This month' },
  { value: 'within-3-months', label: 'Within 3 months' },
  { value: 'exploring', label: 'Just exploring' },
];

/** Limits from brief 12.4 (message) and sensible caps for the rest. */
export const LIMITS = { name: 100, email: 254, organisation: 150, website: 300, message: 5000 } as const;

/** The topic to preselect from `?topic=`, or '' when it is missing or unknown. */
export function topicFromQuery(search: string, topics: Option[]): string {
  const topic = new URLSearchParams(search).get('topic') ?? '';
  return topics.some((option) => option.value === topic) ? topic : '';
}
