// Pure helpers and fixed copy for Work with me and the service pages (brief sections 5, 6 and 8).
// Prices always come from site settings (BR-7); these only format them.

/** "$77 USD": whole amounts, with the currency code next to every price (brief 12.7 default). */
export function formatPrice(amount: number, currency: string): string {
  const symbol = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  return `${symbol} ${currency}`;
}

/** Booking link with the tracking parameters from brief section 8. */
export function bookingUrl(url: string, button: string): string {
  const link = new URL(url);
  link.searchParams.set('utm_source', 'site');
  link.searchParams.set('utm_content', button);
  return link.toString();
}

/** Contact form with a topic preselected (brief section 5, Contact). */
export const contactPath = (topic?: string) => (topic ? `/contact/?topic=${encodeURIComponent(topic)}` : '/contact/');

export const FREE_CALL_FILTER = 'Free calls check fit, not solve problems. Best for teams with a budget and a timeline.';

/** How every engagement runs (brief section 5, service detail pages). */
export const PROCESS_STEPS = ['Audit', 'Plan and quote', 'Build', 'Launch and support'] as const;
