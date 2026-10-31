// Browser side of the contact form (brief 12.4). Loads Turnstile on the first interaction,
// sends with fetch so a failure keeps everything typed, and disables the button while sending.

import { THANKS_PATHS, type Outcome } from './contact';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface Turnstile {
  render(container: HTMLElement, options: { sitekey: string }): string;
  reset(widgetId?: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

/** A mailto link carrying the message, so nothing is lost when sending fails (brief 12.4). */
export function mailtoFallback(email: string, fields: Record<string, string>): string {
  const body = [
    `Name: ${fields.name ?? ''}`,
    fields.organisation ? `Organisation: ${fields.organisation}` : '',
    fields.website ? `Website: ${fields.website}` : '',
    '',
    fields.message ?? '',
  ]
    .filter((line, index) => line || index === 3)
    .join('\n');
  // Mail clients cut very long links; keep the body to a safe size.
  const query = new URLSearchParams({ subject: 'Website enquiry', body: body.slice(0, 1800) });
  return `mailto:${email}?${query.toString().replaceAll('+', '%20')}`;
}

export function errorText(error: string | undefined): string {
  if (error === 'turnstile') return 'Please complete the check above the button, then send again.';
  if (error === 'invalid') return 'Some fields need another look. Please check them and send again.';
  return "Your message wasn't sent. Everything you typed is still here, so try again in a moment";
}

let scriptLoading: Promise<void> | undefined;
function loadTurnstile(): Promise<void> {
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.append(script);
  });
  return scriptLoading;
}

export function enhanceContactForm(form: HTMLFormElement): void {
  const container = form.querySelector<HTMLElement>('[data-turnstile]');
  const errorBox = form.querySelector<HTMLElement>('[data-form-error]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  let widgetId: string | undefined;

  const startTurnstile = async () => {
    if (!container?.dataset.sitekey || widgetId !== undefined) return;
    widgetId = '';
    try {
      await loadTurnstile();
      widgetId = window.turnstile?.render(container, { sitekey: container.dataset.sitekey });
    } catch {
      widgetId = undefined;
    }
  };
  form.addEventListener('focusin', startTurnstile, { once: true });
  form.addEventListener('pointerdown', startTurnstile, { once: true });

  const showError = (error: string | undefined) => {
    if (!errorBox) return;
    errorBox.textContent = errorText(error);
    const email = form.dataset.email;
    if (email && error !== 'turnstile' && error !== 'invalid') {
      const fields = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, String(value)]));
      const link = document.createElement('a');
      link.href = mailtoFallback(email, fields);
      link.textContent = 'email it to me instead';
      errorBox.append(', or ', link, '.');
    } else if (!errorBox.textContent.endsWith('.')) {
      errorBox.append('.');
    }
    errorBox.hidden = false;
    errorBox.focus();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button?.disabled) return;
    if (button) button.disabled = true;
    if (errorBox) errorBox.hidden = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; outcome?: string; error?: string };
      if (result.ok && result.outcome) {
        window.location.assign(THANKS_PATHS[result.outcome as Outcome] ?? THANKS_PATHS.thanks);
        return;
      }
      showError(result.error);
    } catch {
      showError(undefined);
    }
    // A Turnstile token works once; get a fresh one for the next try.
    if (widgetId) window.turnstile?.reset(widgetId);
    if (button) button.disabled = false;
  });
}
