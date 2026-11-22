# Installing the captcha on a site

Step by step, for someone adding the captcha to a site in `websites/<domain>/`. Paths below are relative to that site folder unless they start with `packages/` or `scripts/`. `websites/re-petroleum.com` (new CMS) and `websites/bluefieldco` (older CMS) are complete examples to copy from.

## 1. Try the demo first

```
cd packages/captcha
npm install
npm run demo
```

Open http://localhost:4510, send the forms, move the difficulty slider and press the attack buttons to see what the server refuses and why. Stop it with Ctrl+C.

## 2. Build the files into the site

Add this script to the site's `package.json`:

```json
"captcha:build": "node ../../packages/captcha/esbuild.config.mjs --public public/captcha --server src/vendor/captcha"
```

Run `npm run captcha:build` inside the site. It writes:

- `public/captcha/captcha.js`, `captcha-worker.js`, `captcha.css` (served as `/captcha/...`)
- `src/vendor/captcha/captcha.ts` (TypeScript; the site's own `tsc` compiles it to ESM or CommonJS, whichever the site uses)

Commit both folders. Never edit them by hand; change the package and rebuild.

## 3. Add the secret

From the repo root:

```
node scripts/captcha/add-secret.mjs websites/<domain>
```

It appends a random `CAPTCHA_SECRET` and `CAPTCHA_DIFFICULTY=100000` to every existing `.env`, `.env.development`, `.env.production` and `.env.testing` (and a placeholder to `.env.example`), and skips files that already have one. It does not create missing files: create an empty `.env` / `.env.production` first if the site has none. Both files are committed on purpose (see `.cursor/rules/node-backend.mdc`).

A secret by hand: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

`CAPTCHA_DIFFICULTY` is the largest secret number. 100 000 takes a typical phone well under a second. Raise it if spam gets through, lower it if old phones are slow.

## 4. Server wiring

### New CMS (ESM, Zod, `HttpError`; example: re-petroleum.com)

1. `src/config/env.ts`: add
   ```ts
   CAPTCHA_SECRET: z.string().min(32, 'CAPTCHA_SECRET must be at least 32 characters'),
   CAPTCHA_DIFFICULTY: z.coerce.number().int().min(1_000).max(10_000_000).default(100_000),
   ```
2. `src/schemas/captchaSchemas.ts`: list the site's form scopes (`admin-login` plus one per public form) and export `captchaField = z.string().max(2000).optional().default('')`. Add `captcha: captchaField` to every form schema.
3. Copy `src/services/captchaService.ts` and `src/controllers/captchaController.ts` from re-petroleum.com. `captchaService.verify(token, scope, ip)` throws a 400 `HttpError` with a `captcha` field error, so existing `catch (error instanceof HttpError && error.fields)` blocks show it next to the form.
4. Route, before `siteLocals` and the catch-all page route:
   ```ts
   router.get('/captcha/challenge', captchaChallengeRateLimit, CaptchaController.challenge);
   ```
   `captchaChallengeRateLimit` lives in `src/middleware/security.ts` (30 per minute per IP).
5. In each POST handler, call `captchaService.verify(parsed.data.captcha, '<scope>', req.ip ?? '')` after the Zod parse and before the service that saves or emails anything. For the admin login, make the `catch` also render the login page for `error.fields?.captcha`.

### Older CMS (CommonJS, no Zod; example: bluefieldco)

1. Copy `src/services/captchaService.ts`, `src/controllers/captchaController.ts` and `src/middleware/rateLimit.ts` from bluefieldco and set `CAPTCHA_SCOPES`.
2. Make sure the site loads its env files (`src/loadEnv.ts` imported first in `src/app.ts`).
3. Route in `src/app.ts`:
   ```ts
   app.get('/captcha/challenge', createRateLimit({ windowMs: 60_000, limit: 30, message: 'Too many requests. Please wait a minute and try again.' }), CaptchaController.challenge);
   ```
4. In each handler: `if (!captchaService.isValid(req.body.captcha, '<scope>', req.ip ?? '')) return jsonError(res, 400, CAPTCHA_FAILED_MESSAGE);`. For file uploads the check runs after multer has parsed the body, so delete the uploaded file when it fails.

## 5. View wiring

1. Layout: load `/captcha/captcha.css` in the head and `<script src="/captcha/captcha.js" defer data-captcha-url="/captcha/challenge"></script>` before the site script. Admin login pages load the same two files.
2. Forms: add `data-captcha="<scope>"` to the `<form>` and put the partial before the submit button (`views/partials/captcha.ejs` on the new CMS):
   ```html
   <input type="hidden" name="captcha" value="" />
   <div class="site-captcha" data-captcha-status
     data-text-idle="Spam protection is ready."
     data-text-solving="Checking that you are human..."
     data-text-ready="Verified. You can send the form."
     data-text-error="The spam check could not finish."
     data-text-retry="Try again"></div>
   <noscript><p class="site-captcha-noscript">Please turn on JavaScript to send this form. It runs a quick spam check.</p></noscript>
   ```
   Translate the `data-text-*` values for non-English sites (zadwbarakat.com has the Arabic set). The widget layout is flex with symmetric spacing, so it follows `dir="rtl"` without extra CSS.
3. Fetch forms that read `new FormData(form)` inside a normal `submit` listener need nothing more: the widget's capture listener runs first and fills the hidden field. Scripts that build their own JSON body or catch `submit` on `document` before the form sees it must use manual mode: `data-captcha-mode="manual"` and `payload.captcha = await SiteCaptcha.getToken(form)` (see bluefieldco `public/js/forms.js`).
4. Buttons that call `form.submit()` (for example the dev-login button) skip submit events and the captcha. Use `form.requestSubmit()`.
5. Dark backgrounds: the styles switch automatically under `[data-bs-theme='dark']`; elsewhere add `site-captcha--on-dark`.

## 6. CSP and checks

- Helmet sites: add `workerSrc: ["'self'"]` to the CSP directives (the worker is a same-origin file, no third-party origins are needed).
- Add `'/captcha/captcha'` to any static-path list used to skip middleware.
- Run `npm run typecheck`, `npm run lint` and `npm run build` (older CMS: `npm run build`).
- Browser checklist: protected forms submit successfully with no visible status line (add `?captchaDebug=1` to see idle/solving/ready text); errors still show; a tampered token is refused; the admin login signs in with the right password and still says "Invalid email or password" with a wrong one.

## 7. Troubleshooting

- **"The spam check did not complete"**: the token was missing, expired (older than 10 minutes), reused, or issued for another form. The server logs `Captcha rejected` with the reason. Check that the form's `data-captcha` scope matches the scope in the controller.
- **Challenge returns 503**: `CAPTCHA_SECRET` is missing or shorter than 32 characters in the env file the server actually loads.
- **Slow on old phones**: lower `CAPTCHA_DIFFICULTY`. The widget starts solving when the form scrolls into view, so most visitors never wait.
- **More than one Node process per site**: `MemoryReplayStore` is per process, so a token could be replayed once against each process. Our sites run one process each; a cluster would need a shared store implementing `claim(key, expiresAt)`.
- **Updating**: after changing `packages/captcha`, run `npm test` and `npm run check` in the package, then `npm run captcha:build` and the build gates in every site that uses it.
