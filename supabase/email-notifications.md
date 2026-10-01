# Organizer email notifications

Each new `public.festival_intake` row can trigger an email containing every answer to `info@festival-fagot.online`. The sender is `Festival de Fagot <encuesta@festival-fagot.online>`. Replying uses the participant's email when it is valid. Participant confirmations are not enabled.

## Setup

1. Verify `festival-fagot.online` for sending in Resend. Keep receiving disabled; the existing IONOS inbox continues receiving mail through its current root-domain MX records. Resend's sending MX and SPF records belong on the `send` subdomain.
2. Create a Resend API key with Sending access restricted to this domain.
3. In Supabase Edge Functions → Secrets, save `RESEND_API_KEY`. Also save a separate `FESTIVAL_WEBHOOK_SECRET`: generate a fresh 64-character hexadecimal token using the SQL below and keep a private copy. Copy only the token value, without spaces, line breaks, or quotation marks. Never commit either value or put them in the Angular environment file.
4. Create an Edge Function named `notify-festival-submission` via the dashboard editor. Replace its `index.ts` with [the source](functions/notify-festival-submission/index.ts), deploy, and turn off **Verify JWT** in the function settings. The code checks `x-festival-webhook-secret` itself. For CLI deployment, `supabase/config.toml` configures the same setting.
5. Open Integrations → Database Webhooks. Install the integration if needed, then open the Webhooks tab and create an HTTP webhook named `festival-submission-email` for the `public.festival_intake` table's **INSERT** event only. Use POST to `https://aydxnaatgwgkfywfjtct.supabase.co/functions/v1/notify-festival-submission`. Add `Content-Type: application/json` and `x-festival-webhook-secret` with the same private value saved above. After saving, reopen the webhook and confirm that the custom header is present. Set the request timeout to **10000 milliseconds**, the maximum allowed by the dashboard form. No browser changes or public read grants are needed.
6. Submit a new dummy response through `https://encuesta.festival-fagot.online/`. Confirm the row appears in Supabase, then confirm the complete email reaches the organizer inbox. A successful provider response means the email was accepted, not necessarily delivered; check Resend Emails and the inbox/spam folder if needed.

The webhook runs asynchronously after the database insert commits. A failed email does not remove the saved response. Check function logs and Resend Emails for failures; this implementation does not add a retry queue. Resend's idempotency key avoids duplicate emails for the same row during its 24-hour deduplication window. Only new inserts trigger notifications; existing submissions are not emailed automatically.

## Private token generation

Run this in Supabase SQL Editor and copy the returned token privately:

```sql
select
  replace(gen_random_uuid()::text, '-', '') ||
  replace(gen_random_uuid()::text, '-', '')
  as new_webhook_secret;
```

Use the exact same result for the Edge Function secret `FESTIVAL_WEBHOOK_SECRET` and the webhook header `x-festival-webhook-secret`. This produces an ASCII-only token for the HTTP header. Do not share the result in screenshots, chat, or GitHub.

Live organizer delivery was confirmed on 2026-10-01 after replacing a token containing non-ASCII or control characters with this format. For a 401 response, verify that the header is present and that both stored values match before retrying; use the format above when rotating the token.

## Local checks

With Node.js 24 or newer:

```sh
node --test supabase/functions/notify-festival-submission/index.test.mjs
```

The tests mock the email provider and never send email. They cover private webhook authentication, the fixed recipient, all submission fields, HTML escaping, invalid events, unsafe Reply-To values, provider failures, and repeated requests using the same idempotency key.

References: [Supabase database webhooks](https://supabase.com/docs/guides/database/webhooks), [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets), [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email).
