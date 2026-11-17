# @local/captcha

Self-hosted spam check for the CMS forms. No Google or Cloudflare account, no keys to request, no usage limits. Visitors see a small "Verified" line under the form; nobody clicks traffic lights.

Used today on the admin login and every public form of: belfaystudios.com, bypec-lb.com, feed-lb.org, jahidawehbe.com (login only), re-petroleum.com, thronetrading.com, zadwbarakat.com, bluefieldco, capitalprogroup.ca, emdc.group (login only), emdcconsult (login only) and solutec-lb.com. Sites that already run Turnstile or reCAPTCHA (antonioscouture.com, guerrasports, santamariabouar.com) keep them.

## How it works

1. When a protected form scrolls into view (or is first touched), the widget asks the site for a challenge: `GET /captcha/challenge?scope=contact`.
2. The server picks a secret number up to `CAPTCHA_DIFFICULTY` (default 100 000), hashes it with a random salt and signs the result with `CAPTCHA_SECRET` (HMAC-SHA-256). The salt carries the form scope and an expiry (10 minutes).
3. A Web Worker in the browser tries numbers until the SHA-256 matches. That costs a real browser well under a second, but makes mass spam expensive.
4. The answer travels in a hidden `captcha` field. The server checks the signature, the scope, the expiry and the answer, and accepts each token once (in-memory replay store).

Bots that skip JavaScript never get a token. Bots that run it pay CPU time for every message. A token for one form (say `admin-login`) is refused by another (`contact`).

## Try it

```
npm install
npm run demo        # http://localhost:4510
```

The demo page has three forms (plain post, fetch, admin-login style), a difficulty slider, an English/Arabic switch, a "JavaScript off" view, attack buttons (missing, tampered, wrong answer, replayed, wrong form, expired) and a live server log.

## API

Server (`src/server/captcha.ts`, copied into each site as `src/vendor/captcha/captcha.ts`):

| Export | Purpose |
| --- | --- |
| `createChallenge({ secret, scope, maxNumber?, ttlMs? })` | Challenge JSON for the browser. |
| `verifyCaptcha(token, { secret, scope, replayStore? })` | `{ ok: true, scope }` or `{ ok: false, reason }`. Reasons: `missing`, `malformed`, `bad-signature`, `expired`, `wrong-scope`, `wrong-answer`, `replayed`. |
| `MemoryReplayStore` | Single-use token store for one Node process. |
| `isValidScope`, `assertCaptchaSecret` | Input checks (scope `^[a-z0-9][a-z0-9-]{0,39}$`, secret at least 32 characters). |

Browser (`captcha.js`, exposes `window.SiteCaptcha`):

- `form[data-captcha="<scope>"]` is protected automatically: the submit waits for a token, then continues.
- `data-captcha-mode="manual"` for forms whose own script posts with `fetch` before the widget sees the submit; call `await SiteCaptcha.getToken(form)` and send the token as `captcha`.
- `data-captcha-start="interact"` starts solving on first focus instead of on scroll.
- `[data-captcha-status]` shows the state; its `data-text-idle|solving|ready|error|retry` attributes set the wording (translate them per site).
- `SiteCaptcha.reset(form)`, `SiteCaptcha.state(form)`, and a `captcha:state` event on the form.

## Commands

```
npm run build   # dist/browser (captcha.js, captcha-worker.js, captcha.css) and dist/server (captcha.ts)
npm run check   # tsc for browser and server code
npm test        # server and client tests
npm run demo    # build, then the demo server on port 4510
```

To add it to a site, follow [INSTALL.md](INSTALL.md). After changing this package, run `npm run captcha:build` in every site listed above and run that site's build gates.
