# @local/email-sender

Shared SMTP mailer for brochure CMS sites and thin static HTML apps. Config is passed in; the package never reads `process.env`.

```ts
import { createMailer } from './vendor/email-sender/createMailer.js';

const mailer = createMailer({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  user: env.SMTP_USER,
  password: env.SMTP_PASS,
  from: env.MAIL_FROM,
  defaultTo: env.MAIL_TO
});

if (mailer.isConfigured()) {
  await mailer.send({
    replyTo: visitorEmail,
    subject: 'Contact form',
    text: body
  });
}
```

Messages are plain text only. Addresses and subjects are Zod-checked and must not contain CR/LF. TLS certificate verification stays on.

```bash
npm install
npm run check
npm test
npm run build
```

To put the module on a site, see [INSTALL.md](INSTALL.md).
