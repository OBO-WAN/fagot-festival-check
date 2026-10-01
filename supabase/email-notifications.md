# Festival submission emails

Each new `public.festival_intake` row can trigger an email containing every answer to `info@festival-fagot.online`. The sender is `Festival de Fagot <encuesta@festival-fagot.online>`. Replying uses the participant's email when it is valid. A separate Spanish receipt goes to the single valid email address entered in the saved submission. Replies to that receipt go to the organizer inbox.

## Setup

1. Verify `festival-fagot.online` for sending in Resend. Keep receiving disabled; the existing IONOS inbox continues receiving mail through its current root-domain MX records. Resend's sending MX and SPF records belong on the `send` subdomain.
2. Create a Resend API key with Sending access restricted to this domain.
3. In Supabase Edge Functions → Secrets, save `RESEND_API_KEY`. Also save a separate `FESTIVAL_WEBHOOK_SECRET`: generate a fresh 64-character hexadecimal token using the SQL below and keep a private copy. Copy only the token value, without spaces, line breaks, or quotation marks. Never commit either value or put them in the Angular environment file.
4. Create an Edge Function named `notify-festival-submission` via the dashboard editor. Replace its `index.ts` with [the source](functions/notify-festival-submission/index.ts), deploy, and turn off **Verify JWT** in the function settings. The code checks `x-festival-webhook-secret` itself. For CLI deployment, `supabase/config.toml` configures the same setting.
5. Open Integrations → Database Webhooks. Install the integration if needed, then open the Webhooks tab and create an HTTP webhook named `festival-submission-email` for the `public.festival_intake` table's **INSERT** event only. Use POST to `https://aydxnaatgwgkfywfjtct.supabase.co/functions/v1/notify-festival-submission`. Add `Content-Type: application/json` and `x-festival-webhook-secret` with the same private value saved above. After saving, reopen the webhook and confirm that the custom header is present. Set the request timeout to **10000 milliseconds**, the maximum allowed by the dashboard form. No browser changes or public read grants are needed.
6. Submit a new dummy response through `https://encuesta.festival-fagot.online/`. Confirm the row appears in Supabase, then confirm the complete email reaches the organizer inbox and the receipt reaches the participant address. Use an address you control for the participant test. A successful provider response means the email was accepted, not necessarily delivered; check Resend Emails and the inbox/spam folder if needed.

The webhook runs asynchronously after the database insert commits. A failed email does not remove the saved response. Check function logs and Resend Emails for failures; this implementation does not add a retry queue. Each valid submission sends two emails. Organizer and participant messages have separate stable Resend idempotency keys to avoid duplicate accepted messages when retrying the same row during the provider's 24-hour deduplication window. The two requests run concurrently with a shared 8-second deadline so they fit within the 10-second webhook timeout. A partial provider failure returns HTTP 502 with individual results; the accepted message can be deduplicated on a manual retry. Invalid or multiple participant addresses are skipped while the organizer is still notified. Only new inserts trigger notifications; existing submissions are not emailed automatically.

## Participant receipt

Subject: **Hemos recibido su respuesta · Festival de Fagot**

> Gracias por completar el cuestionario del Festival de Fagot.
>
> Hemos recibido su respuesta correctamente.
>
> Si tiene alguna pregunta, puede responder a este correo.
>
> Festival de Fagot

The receipt contains a short acknowledgement. The complete answers go to the organizer. The participant address comes only from `record.email`; additional payload fields cannot change the organizer or confirmation recipients.

To enable the receipt in an existing setup, replace the deployed function's `index.ts` with the updated source and deploy the update. Then test a new submission. The existing sending domain, API key, ASCII webhook token, and webhook header are used for both messages.

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

The tests mock the email provider and never send email. They cover private webhook authentication, the fixed recipient, all submission fields, HTML escaping, invalid events, unsafe Reply-To values, provider failures, participant address isolation, the Spanish receipt, partial delivery failure, and repeated requests using separate stable idempotency keys.

References: [Supabase database webhooks](https://supabase.com/docs/guides/database/webhooks), [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets), [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email).
