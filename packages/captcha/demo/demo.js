(() => {
  const DIFFICULTIES = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000];

  const TEXT = {
    en: {
      idle: 'Spam protection is ready.',
      solving: 'Checking that you are human...',
      ready: 'Verified. You can send the form.',
      error: 'Verification failed.',
      retry: 'Try again'
    },
    ar: {
      idle: 'الحماية من الرسائل المزعجة جاهزة.',
      solving: 'جارٍ التحقق من أنك إنسان...',
      ready: 'تم التحقق. يمكنك إرسال النموذج.',
      error: 'فشل التحقق.',
      retry: 'حاول مرة أخرى'
    }
  };

  const $ = (selector) => document.querySelector(selector);
  const demoForms = ['#form-native', '#form-fetch', '#form-login'].map((id) => $(id));
  const helperForms = [$('#form-helper'), $('#form-helper-login')];
  const allForms = [...demoForms, ...helperForms];
  const log = $('#log');
  const difficulty = $('#difficulty');
  const ttl = $('#ttl');
  const nojs = $('#nojs');

  function challengeUrl() {
    const maxNumber = DIFFICULTIES[Number(difficulty.value)];
    const ttlSeconds = Math.min(3600, Math.max(5, Number(ttl.value) || 600));
    return `/captcha/challenge?maxNumber=${maxNumber}&ttl=${ttlSeconds * 1000}`;
  }

  function addLog(action, result) {
    const item = document.createElement('li');
    item.className = result.ok ? 'is-ok' : 'is-bad';
    const time = new Date().toLocaleTimeString();
    const verdict = result.ok ? 'ACCEPTED' : `REJECTED (${result.reason})`;
    const head = document.createElement('strong');
    head.textContent = `${time}  ${action}: ${verdict}`;
    const detail = document.createElement('span');
    detail.textContent = `${result.explanation || ''} Scope: ${result.scope}.${typeof result.verifyMs === 'number' ? ` Server check: ${result.verifyMs} ms.` : ''}`;
    item.append(head, detail);
    log.prepend(item);
  }

  async function post(scope, payload) {
    const response = await fetch(`/demo/submit?scope=${encodeURIComponent(scope)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    return response.json();
  }

  function decode(token) {
    return JSON.parse(atob(token.replace(/-/g, '+').replace(/_/g, '/')));
  }

  function encode(value) {
    return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function applySettings() {
    $('#difficulty-value').textContent = DIFFICULTIES[Number(difficulty.value)].toLocaleString('en-US');
    const url = challengeUrl();
    for (const form of allForms) {
      form.dataset.captchaUrl = url;
    }
    for (const form of demoForms) {
      if (!nojs.checked) {
        window.SiteCaptcha.reset(form).catch(() => undefined);
      }
    }
  }

  function applyLanguage() {
    const lang = $('#language').value;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    for (const status of document.querySelectorAll('[data-captcha-status]')) {
      for (const [key, value] of Object.entries(TEXT[lang])) {
        status.dataset[`text${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
      }
    }
    applySettings();
  }

  function applyNoJs() {
    const off = nojs.checked;
    for (const form of demoForms) {
      form.querySelector('[data-captcha-status]').hidden = off;
      form.querySelector('[data-demo-nojs]').hidden = !off;
      if (form.id !== 'form-fetch') {
        if (off) {
          form.dataset.captchaMode = 'manual';
        } else {
          delete form.dataset.captchaMode;
        }
      }
    }
    if (!off) {
      applySettings();
    }
  }

  for (const form of demoForms) {
    const readout = form.querySelector('[data-readout]');
    form.addEventListener('captcha:state', (event) => {
      const d = event.detail;
      if (d.state === 'solving') {
        readout.textContent = 'Solving...';
      } else if (d.state === 'ready') {
        readout.textContent = `Solved in ${d.ms} ms, ${d.attempts.toLocaleString('en-US')} hashes tried (max ${d.maxNumber.toLocaleString('en-US')}).`;
      } else if (d.state === 'error') {
        readout.textContent = `Error: ${d.error}`;
      }
    });
    if (form.id !== 'form-fetch') {
      form.addEventListener('submit', () => {
        if (nojs.checked) {
          form.querySelector('input[name="captcha"]').value = '';
        }
      });
    }
  }

  $('#form-fetch').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const captcha = nojs.checked ? '' : await window.SiteCaptcha.getToken(form);
      addLog('Fetch form', await post('contact', { ...fields, captcha }));
    } catch (error) {
      addLog('Fetch form', { ok: false, reason: 'client-error', explanation: String(error), scope: 'contact' });
    } finally {
      button.disabled = false;
    }
  });

  const attacks = {
    async missing() {
      return post('contact', { message: 'no token' });
    },
    async tamper() {
      const payload = decode(await window.SiteCaptcha.getToken(helperForms[0]));
      const last = payload.signature.slice(-1);
      payload.signature = payload.signature.slice(0, -1) + (last === '0' ? '1' : '0');
      return post('contact', { captcha: encode(payload) });
    },
    async answer() {
      const payload = decode(await window.SiteCaptcha.getToken(helperForms[0]));
      payload.number += 1;
      return post('contact', { captcha: encode(payload) });
    },
    async replay() {
      const token = await window.SiteCaptcha.getToken(helperForms[0]);
      addLog('Replay (first use)', await post('contact', { captcha: token }));
      return post('contact', { captcha: token });
    },
    async scope() {
      const token = await window.SiteCaptcha.getToken(helperForms[1]);
      return post('contact', { captcha: token });
    },
    async expired() {
      const form = helperForms[0];
      const saved = form.dataset.captchaUrl;
      form.dataset.captchaUrl = `/captcha/challenge?maxNumber=${DIFFICULTIES[0]}&ttl=2000`;
      try {
        await window.SiteCaptcha.reset(form);
        const token = await window.SiteCaptcha.getToken(form);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return await post('contact', { captcha: token });
      } finally {
        form.dataset.captchaUrl = saved;
      }
    }
  };

  for (const button of document.querySelectorAll('[data-attack]')) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        addLog(button.textContent, await attacks[button.dataset.attack]());
      } catch (error) {
        addLog(button.textContent, { ok: false, reason: 'client-error', explanation: String(error), scope: 'contact' });
      } finally {
        button.disabled = false;
      }
    });
  }

  $('#clear-log').addEventListener('click', () => {
    log.textContent = '';
  });
  difficulty.addEventListener('input', () => {
    $('#difficulty-value').textContent = DIFFICULTIES[Number(difficulty.value)].toLocaleString('en-US');
  });
  difficulty.addEventListener('change', applySettings);
  ttl.addEventListener('change', applySettings);
  $('#language').addEventListener('change', applyLanguage);
  nojs.addEventListener('change', applyNoJs);

  for (const form of allForms) {
    form.dataset.captchaUrl = challengeUrl();
  }
})();
