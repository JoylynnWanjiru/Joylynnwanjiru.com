// Browser side of the One Step forms (brief 12.4): sends with fetch, shows the result in
// place, keeps the email on failure and disables the button while sending.

import { SUBSCRIBE_MESSAGES, type SubscribeResult } from './newsletter';
import { lazyTurnstile } from './turnstile-client';

export function resultMessage(result: unknown, error?: unknown): string {
  if (error === 'turnstile') return 'Please complete the check, then subscribe again.';
  if (error === 'invalid') return 'Please check your email address.';
  const known = typeof result === 'string' && result in SUBSCRIBE_MESSAGES;
  return SUBSCRIBE_MESSAGES[known ? (result as SubscribeResult) : 'failed'];
}

function enhance(form: HTMLFormElement): void {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const status = form.querySelector<HTMLElement>('[data-newsletter-status]');
  const turnstile = lazyTurnstile(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button?.disabled) return;
    if (button) button.disabled = true;
    if (status) status.textContent = 'Subscribing…';
    let message: string;
    let done = false;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      const body = (await response.json().catch(() => ({}))) as { result?: string; error?: string };
      message = resultMessage(body.result, body.error);
      done = body.result === 'subscribed' || body.result === 'already';
    } catch {
      message = SUBSCRIBE_MESSAGES.failed;
    }
    if (status) status.textContent = message;
    if (done) {
      form.reset();
    } else {
      // A Turnstile token works once; get a fresh one for the next try.
      turnstile.reset();
    }
    if (button) button.disabled = false;
  });
}

export function enhanceNewsletterForms(forms: Iterable<HTMLFormElement>): void {
  for (const form of forms) enhance(form);
}
