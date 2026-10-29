// Values the layout needs before the site settings singleton exists.
// feature/content-model moves these into Keystatic site settings (brief section 4).
export const site = {
  name: 'Joylynn Wanjiru',
  signature: 'One step at a time.',
} as const;

export const nav = [
  { href: '/writing', label: 'Writing' },
  { href: '/steps', label: 'Steps' },
  { href: '/work', label: 'Work' },
  { href: '/about', label: 'About' },
] as const;

export const workWithMe = { href: '/work-with-me', label: 'Work with me' } as const;
