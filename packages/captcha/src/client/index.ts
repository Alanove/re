import { solveInSlices, type ChallengeData, type SolveResult } from './solver';

type CaptchaState = 'idle' | 'solving' | 'ready' | 'error';

interface FormCaptcha {
  form: HTMLFormElement;
  input: HTMLInputElement;
  status: HTMLElement;
  state: CaptchaState;
  token: string;
  expiresAt: number;
  solvedAt: number;
  pending: Promise<string> | null;
  generation: number;
}

export interface CaptchaStateDetail {
  state: CaptchaState;
  scope: string;
  ms?: number;
  attempts?: number;
  maxNumber?: number;
  error?: string;
}

const DEFAULT_TEXT = {
  idle: 'Spam protection is ready.',
  solving: 'Checking that you are human...',
  ready: 'Verified. You can send the form.',
  error: 'Verification failed.',
  retry: 'Try again'
};

const EXPIRY_MARGIN_MS = 30_000;
const SOLVE_TIMEOUT_MS = 60_000;
const PRESOLVE_DELAY_MS = 1_500;

const currentScript = document.currentScript as HTMLScriptElement | null;
const scriptSrc = currentScript?.src ?? '';
const workerUrl = scriptSrc ? scriptSrc.replace(/captcha(\.min)?\.js(\?.*)?$/, 'captcha-worker.js$2') : '';
const defaultChallengeUrl = currentScript?.dataset.captchaUrl || '/captcha/challenge';

const registry = new WeakMap<HTMLFormElement, FormCaptcha>();

function text(entry: FormCaptcha, key: keyof typeof DEFAULT_TEXT): string {
  const attr = `text${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  return entry.status.dataset[attr] || entry.form.dataset[`captcha${attr.charAt(0).toUpperCase()}${attr.slice(1)}`] || DEFAULT_TEXT[key];
}

function scopeOf(form: HTMLFormElement): string {
  return form.dataset.captcha || 'default';
}

function emit(entry: FormCaptcha, detail: Omit<CaptchaStateDetail, 'scope'>): void {
  entry.form.dispatchEvent(new CustomEvent<CaptchaStateDetail>('captcha:state', { detail: { ...detail, scope: scopeOf(entry.form) } }));
}

function render(entry: FormCaptcha, state: CaptchaState): void {
  entry.state = state;
  entry.status.dataset.state = state;
  entry.status.textContent = '';
  const icon = document.createElement('span');
  icon.className = 'site-captcha__icon';
  icon.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'site-captcha__text';
  label.textContent = text(entry, state);
  entry.status.append(icon, label);
  if (state === 'error') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'site-captcha__retry';
    retry.textContent = text(entry, 'retry');
    retry.addEventListener('click', () => {
      void ensureToken(entry).catch(() => undefined);
    });
    entry.status.append(retry);
  }
}

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function expiryFromSalt(salt: string): number {
  const expiry = salt.split('.')[1];
  const parsed = expiry ? parseInt(expiry, 36) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function challengeUrl(form: HTMLFormElement): string {
  const base = form.dataset.captchaUrl || defaultChallengeUrl;
  const url = new URL(base, window.location.href);
  url.searchParams.set('scope', scopeOf(form));
  return url.toString();
}

async function fetchChallenge(form: HTMLFormElement): Promise<ChallengeData> {
  const response = await fetch(challengeUrl(form), {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`challenge-http-${response.status}`);
  }
  const data = (await response.json()) as ChallengeData;
  if (!data || typeof data.challenge !== 'string' || typeof data.salt !== 'string' || typeof data.maxNumber !== 'number') {
    throw new Error('challenge-invalid');
  }
  return data;
}

function solveInWorker(data: ChallengeData): Promise<SolveResult | null> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(workerUrl);
    } catch (error) {
      reject(error);
      return;
    }
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('solve-timeout'));
    }, SOLVE_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<{ number?: number; attempts?: number; error?: string }>) => {
      window.clearTimeout(timer);
      worker.terminate();
      const result = event.data;
      resolve(typeof result.number === 'number' ? { number: result.number, attempts: result.attempts ?? result.number + 1 } : null);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      window.clearTimeout(timer);
      worker.terminate();
      reject(new Error('worker-error'));
    };
    worker.postMessage(data);
  });
}

async function solve(data: ChallengeData): Promise<SolveResult | null> {
  if (workerUrl && typeof Worker !== 'undefined') {
    try {
      return await solveInWorker(data);
    } catch (error) {
      if (error instanceof Error && error.message === 'solve-timeout') {
        throw error;
      }
    }
  }
  return solveInSlices(data);
}

function hasValidToken(entry: FormCaptcha): boolean {
  const margin = Math.min(EXPIRY_MARGIN_MS, (entry.expiresAt - entry.solvedAt) / 4);
  return entry.state === 'ready' && entry.token !== '' && entry.expiresAt - margin > Date.now();
}

function ensureToken(entry: FormCaptcha): Promise<string> {
  if (hasValidToken(entry)) {
    return Promise.resolve(entry.token);
  }
  if (entry.pending) {
    return entry.pending;
  }
  const generation = ++entry.generation;
  entry.token = '';
  entry.input.value = '';
  render(entry, 'solving');
  emit(entry, { state: 'solving' });
  const started = performance.now();
  entry.pending = (async () => {
    try {
      const data = await fetchChallenge(entry.form);
      const result = await solve(data);
      if (!result) {
        throw new Error('not-found');
      }
      if (generation !== entry.generation) {
        throw new Error('superseded');
      }
      entry.token = base64Url(
        JSON.stringify({ algorithm: data.algorithm, challenge: data.challenge, number: result.number, salt: data.salt, signature: data.signature })
      );
      entry.expiresAt = expiryFromSalt(data.salt);
      entry.solvedAt = Date.now();
      entry.input.value = entry.token;
      render(entry, 'ready');
      emit(entry, { state: 'ready', ms: Math.round(performance.now() - started), attempts: result.attempts, maxNumber: data.maxNumber });
      return entry.token;
    } catch (error) {
      if (generation === entry.generation) {
        render(entry, 'error');
        emit(entry, { state: 'error', error: error instanceof Error ? error.message : String(error) });
      }
      throw error;
    } finally {
      if (generation === entry.generation) {
        entry.pending = null;
      }
    }
  })();
  return entry.pending;
}

/** Hands out the current token once; the next call solves a fresh challenge (tokens are single-use on the server). */
function consume(entry: FormCaptcha): string {
  const token = entry.token;
  entry.token = '';
  entry.state = 'idle';
  window.setTimeout(() => {
    if (!entry.token && !entry.pending && entry.form.isConnected) {
      void ensureToken(entry).catch(() => undefined);
    }
  }, PRESOLVE_DELAY_MS);
  return token;
}

function onSubmit(entry: FormCaptcha, event: SubmitEvent): void {
  if (entry.form.dataset.captchaMode === 'manual') {
    return;
  }
  if (hasValidToken(entry)) {
    entry.input.value = consume(entry);
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
  ensureToken(entry)
    .then(() => {
      if (submitter && 'form' in submitter && (submitter as HTMLButtonElement).form === entry.form) {
        entry.form.requestSubmit(submitter as HTMLButtonElement);
      } else {
        entry.form.requestSubmit();
      }
    })
    .catch(() => undefined);
}

function startWhenVisible(entry: FormCaptcha): void {
  const start = (): void => {
    void ensureToken(entry).catch(() => undefined);
  };
  if (entry.form.dataset.captchaStart === 'interact' || typeof IntersectionObserver === 'undefined') {
    const once = (): void => {
      entry.form.removeEventListener('focusin', once);
      entry.form.removeEventListener('pointerdown', once);
      start();
    };
    entry.form.addEventListener('focusin', once);
    entry.form.addEventListener('pointerdown', once);
    return;
  }
  const observer = new IntersectionObserver((records) => {
    if (records.some((record) => record.isIntersecting)) {
      observer.disconnect();
      start();
    }
  });
  observer.observe(entry.form);
}

function attach(form: HTMLFormElement): FormCaptcha {
  const existing = registry.get(form);
  if (existing) {
    return existing;
  }
  let input = form.querySelector<HTMLInputElement>('input[name="captcha"]');
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'captcha';
    form.append(input);
  }
  let status = form.querySelector<HTMLElement>('[data-captcha-status]');
  if (!status) {
    status = document.createElement('div');
    status.className = 'site-captcha';
    status.setAttribute('data-captcha-status', '');
    const anchor = form.querySelector('[type="submit"]');
    if (anchor?.parentElement) {
      anchor.parentElement.insertBefore(status, anchor);
    } else {
      form.append(status);
    }
  }
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.querySelectorAll('[data-captcha-noscript]').forEach((node) => node.remove());
  const entry: FormCaptcha = { form, input, status, state: 'idle', token: '', expiresAt: 0, solvedAt: 0, pending: null, generation: 0 };
  registry.set(form, entry);
  render(entry, 'idle');
  form.addEventListener('submit', (event) => onSubmit(entry, event as SubmitEvent), true);
  startWhenVisible(entry);
  return entry;
}

function resolveForm(target: HTMLFormElement | string): FormCaptcha {
  const form = typeof target === 'string' ? document.querySelector<HTMLFormElement>(target) : target;
  if (!form) {
    throw new Error('SiteCaptcha: form not found');
  }
  return attach(form);
}

function init(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>('form[data-captcha]').forEach((form) => {
    attach(form);
  });
}

const api = {
  init,
  /** Waits for a solved token, puts it in the hidden field and returns it. Each token works once. */
  async getToken(target: HTMLFormElement | string): Promise<string> {
    const entry = resolveForm(target);
    await ensureToken(entry);
    const token = consume(entry);
    entry.input.value = token;
    return token;
  },
  /** Drops the current token and solves a new challenge (for example after changing data-captcha-url). */
  reset(target: HTMLFormElement | string): Promise<string> {
    const entry = resolveForm(target);
    entry.generation++;
    entry.pending = null;
    entry.token = '';
    entry.input.value = '';
    return ensureToken(entry);
  },
  state(target: HTMLFormElement | string): CaptchaState {
    return resolveForm(target).state;
  }
};

declare global {
  interface Window {
    SiteCaptcha: typeof api;
  }
}

window.SiteCaptcha = api;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}
