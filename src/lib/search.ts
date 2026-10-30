// Site search (brief section 2): Pagefind's Component UI, loaded only when a visitor
// opens search, so content pages ship none of it. Every search control is a link to
// /writing/ marked data-search: without JavaScript, or if the index fails to load
// (as in `astro dev`, which builds no index), the link simply works (brief 12.4).

declare global {
  interface Window {
    PagefindComponents?: { configureInstance: (name: string, options: Record<string, unknown>) => void };
  }
}

interface PagefindModal extends HTMLElement {
  open: () => void;
  isOpen: boolean;
}

const BUNDLE = '/pagefind/';
let loading: Promise<PagefindModal> | undefined;

function load(): Promise<PagefindModal> {
  loading ??= new Promise<void>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${BUNDLE}pagefind-component-ui.css`;
    document.head.append(css);
    const script = document.createElement('script');
    script.type = 'module';
    script.src = `${BUNDLE}pagefind-component-ui.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Search failed to load'));
    document.head.append(script);
  }).then(async () => {
    // Search on the main thread: the index is small, and no worker means no worker-src in the CSP.
    // Must run before the modal connects, or the defaults win.
    window.PagefindComponents?.configureInstance('default', { noWorker: true });
    const modal = document.createElement('pagefind-modal') as PagefindModal;
    document.body.append(modal);
    await customElements.whenDefined('pagefind-modal');
    return modal;
  });
  return loading;
}

export function wireSearch(): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-search]')) {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        const modal = await load();
        modal.open();
      } catch {
        loading = undefined;
        window.location.href = link.href;
      }
    });
  }
}
