# Installing the email sender on a site

Step by step for adding `@local/email-sender` to a site in `websites/<domain>/`. Paths below are relative to that site folder unless they start with `packages/`. `websites/animalcitylebanon.com` is the first site that uses this package. Other sites still use their local `mailService.ts` until you replace them one by one.

## 1. Build the module into the site

Add this script to the site's `package.json`:

```json
"email-sender:build": "node ../../packages/email-sender/build.mjs --out src/vendor/email-sender"
```

From the site folder:

```bash
cd packages/email-sender && npm install && cd -
npm run email-sender:build
```

It writes `src/vendor/email-sender/createMailer.ts`. Commit that file. Never edit it by hand; change the package and rebuild.

Add `nodemailer` and `zod` to the site's dependencies if they are not already there, plus `@types/nodemailer` in devDependencies.

## 2. Wire a thin site adapter

Keep env parsing in the site. Map SMTP fields into `createMailer`:

```ts
import { createMailer } from '../vendor/email-sender/createMailer.js';
import { env } from '../config/env.js';

export const mailService = createMailer(
  env.SMTP_HOST.trim()
    ? {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        password: env.SMTP_PASS,
        from: env.MAIL_FROM || env.SMTP_USER,
        defaultTo: env.MAIL_TO || undefined
      }
    : null
);
```

Call `mailService.isConfigured()` before `send`. Catch `MailerError` (or any throw from `send`) in the contact service and return a clear error to the visitor. Do not log the message body or the SMTP password.

## 3. Env keys

Use the same names the brochure sites already use:

```
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
MAIL_TO=
```

`MAIL_TO` is the inbox for contact forms. Leave SMTP empty in development if you are not testing delivery; the form should then say email is not configured instead of pretending the message was sent.

## 4. Replacing a local mailService later

When you move another site onto this package:

1. Run `email-sender:build`.
2. Replace the body of `src/services/mailService.ts` with the adapter above (or delete it and import the vendor module from the contact service).
3. Keep the site's public `OutgoingMail` call sites the same (`to`, `replyTo`, `subject`, `text`).
4. Run `npm run typecheck`, `npm run lint`, and `npm run build` in that site.

Do not change several sites in one pass unless asked.

## 5. Verify

```bash
cd packages/email-sender && npm run check && npm test
cd websites/<domain> && npm run typecheck && npm run lint && npm run build
```
