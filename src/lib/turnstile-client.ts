// Browser side of Turnstile (BR-12), shared by the contact and newsletter forms. The script
// loads on the first interaction with a form, never on page load (brief section 7).

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface Turnstile {
  render(container: HTMLElement, options: { sitekey: string; size?: 'normal' | 'flexible' | 'compact' }): string;
  reset(widgetId?: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let scriptLoading: Promise<void> | undefined;
function loadTurnstile(): Promise<void> {
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = undefined;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.append(script);
  });
  return scriptLoading;
}

/**
 * Renders the widget into the form's `[data-turnstile]` container on first focus or tap.
 * Returns `reset`, to call after each send: a token can be verified only once.
 */
export function lazyTurnstile(form: HTMLFormElement): { reset(): void } {
  const container = form.querySelector<HTMLElement>('[data-turnstile]');
  let widgetId: string | undefined;
  let started = false;

  const start = async () => {
    if (started || !container?.dataset.sitekey) return;
    started = true;
    try {
      await loadTurnstile();
      widgetId = window.turnstile?.render(container, { sitekey: container.dataset.sitekey, size: 'flexible' });
    } catch {
      started = false;
    }
  };
  form.addEventListener('focusin', start);
  form.addEventListener('pointerdown', start);

  return {
    reset() {
      if (widgetId) window.turnstile?.reset(widgetId);
    },
  };
}
