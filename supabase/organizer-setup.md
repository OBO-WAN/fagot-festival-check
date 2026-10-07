# Private organizer dashboard

The `/organizacion` page reads saved `festival_intake` responses after password sign-in. It displays full answers and accessory totals, and exports each view as CSV. Access belongs to exactly one Supabase Auth user ID. Creating another Auth account or knowing the page URL does not grant access.

## Enable your account

1. In Supabase **Authentication → Users**, create your own user with your chosen email and a private password. Confirm the email through the dashboard when creating this account. There is no public signup form on the organizer page. Never put your password, service-role key, or webhook secret in code or chat.
2. Run [organizer-access.sql](organizer-access.sql) in the Supabase SQL Editor. It keeps public response submission available, adds the private account binding, and permits only that account to read responses. It does not edit saved submissions or email webhooks. If it reports an unexpected existing policy, stop and review that policy before continuing. Do not add `festival_private` to the API's exposed schemas.
3. Copy the UUID of your user from Authentication → Users. Run the statement below in the SQL Editor, replacing the placeholder with that UUID. The foreign key requires the user to exist. The single-row constraint permits only one authorized account.

```sql
insert into festival_private.organizer_account (singleton, user_id)
values (true, 'YOUR-AUTH-USER-UUID'::uuid)
on conflict (singleton) do update set user_id = excluded.user_id;
```

4. After the frontend PR is merged and Cloudflare has deployed it, open `https://encuesta.festival-fagot.online/organizacion` and sign in with that email and password. No Resend email or SMTP configuration is needed for password sign-in after the account is confirmed.
5. Check that your responses load and that **Materiales** totals match a few known submissions. Open a separate signed-out browser session and verify it shows only the login screen. Run the database permission tests below before changing these access rules.

The auth session uses separate, tab-scoped storage from the public form. The dashboard has no advertisements. Signing out clears displayed records, and the data never enters prerendered pages. The database, rather than an email comparison in the browser, decides access. The organizer can read but cannot update or delete responses through the dashboard/API. The existing anonymous submission form remains anonymous and continues triggering its database email webhook.

## Totals and exports

- Each saved submission counts once, including repeated submissions by the same person. The dashboard does not silently deduplicate responses or remove test submissions.
- Purchase and loan totals sum quantities. Advice totals count requests. Unrecognized request types or invalid quantities appear as unclassified so they do not disappear from the summary.
- Data is fetched in 200-row pages with stable date/UUID cursors. Refresh retrieves a new snapshot; existing rows remain saved even if loading or export fails. Responses arriving after a refresh begins appear on the next refresh.
- The UTF-8 CSV exports quote commas/newlines and neutralize text that spreadsheet software could interpret as formulas. Answers are flattened into readable cells. Downloads contain personal data and should be stored with the same care as the organizer emails.

## Local verification

```sh
npm ci
npm test -- --watch=false
npm run test:db
npm run build -- --base-href /
```

The database tests run the actual schema and access migration in isolated PGlite PostgreSQL, with Supabase Auth roles and `auth.uid()` modeled locally. They exercise anonymous, authorized, and unrelated authenticated callers, plus account replacement and revoked access. They send no requests or emails to the production project. Browser auth and production policy setup still require the account/SQL steps above.

To revoke access immediately in Supabase:

```sql
delete from festival_private.organizer_account;
```

The next authenticated query is denied by RLS. Already downloaded files cannot be recalled; an already rendered snapshot remains visible until refresh/sign-out.

References: [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Function privileges](https://supabase.com/docs/guides/database/functions).
