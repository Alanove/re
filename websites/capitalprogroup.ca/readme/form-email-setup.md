# Contact and careers form email

Public forms submit to the site email configured in **Admin → Site Settings**:

- **Contact / Submit Inquiry** → `contactEmail` (`beirut.office@bluefieldco.com` by default)
- **Careers (with CV)** → `careersEmail` if set, otherwise `contactEmail`

## SMTP environment variables

Set these on the server (see `.env.production`). For local dev, use **`.env.development`** (or `.env`):

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | Mail server hostname |
| `SMTP_PORT` | Usually `587` (TLS) or `465` (SSL) |
| `SMTP_SECURE` | `true` for port 465 |
| `SMTP_USER` | SMTP username (if required) |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From address (defaults to `SMTP_USER`) |

If `SMTP_HOST` is not set, the API returns an error and the form shows a failure message (no “success” without delivery). For local dev, fill in SMTP in `.env.development` (template in `.env.example`) and restart `npm run dev`.

## Endpoints

- `POST /api/forms/contact` — JSON: `name` or `fname`/`lname`, `email`, `phone`, `message`
- `POST /api/forms/careers` — `multipart/form-data`: `fname`, `lname`, `email`, `your-file` (PDF/TXT, max 5 MB)

Frontend handling lives in `public/js/forms.js` (bundled into `public/js/script.js` via `npm run js:build`).
