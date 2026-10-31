// One Step newsletter: results and messages shared by /api/subscribe, its pages and the
// form script (brief sections 6 and 8, 12.4). No server code, so it is safe in the browser.

export type SubscribeResult = 'subscribed' | 'already' | 'failed';

export const NEWSLETTER = {
  name: 'One Step',
  pitch: "What I'm building, learning and figuring out, one step at a time.",
  button: 'Subscribe',
  note: 'No spam. Unsubscribe anytime.',
} as const;

/** Brief 12.4 wording for "already subscribed" and "Beehiiv is down". */
export const SUBSCRIBE_MESSAGES: Record<SubscribeResult, string> = {
  subscribed: "Thanks, you're on the list.",
  already: "You're already on the list.",
  failed: "Couldn't subscribe just now. Please try again, or email me.",
};

/** Pages for a form posted without JavaScript (brief 12.4). */
export const SUBSCRIBE_PATHS: Record<SubscribeResult, string> = {
  subscribed: '/newsletter/thanks/',
  already: '/newsletter/already/',
  failed: '/newsletter/error/',
};
