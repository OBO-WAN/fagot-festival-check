# Bassoon Festival · pre-arrival check

An Angular draft for collecting students' accessory requests and bassoon problems before a festival. The public page is a single responsive form. Organizers review entries in Supabase Studio; there is no public list of submissions.

## Run the draft

Requires a current Node.js installation. Run `npm install` and `npm start`; Angular opens the local page in your browser. Without Supabase settings the form is a preview: it retains answers and explains why submission is unavailable.

## Remote preview with GitHub Pages

In this repository, open **Settings → Pages** and choose **GitHub Actions** under **Build and deployment → Source**. The [Pages workflow](.github/workflows/pages.yml) builds on pushes to `main` and can also be started manually from the Actions tab. It uses `/fagot-festival-check/` as the Angular base path. The hosted form is still a preview until Supabase is connected; answers are not saved.

## Connect Supabase

1. Create a Supabase project and run [supabase/schema.sql](supabase/schema.sql) in its SQL Editor.
2. Put the project URL and **publishable** key in [src/environments/environment.ts](src/environments/environment.ts). Those values are included in the browser build. Never put a secret or service-role key there.
3. Run `npm run build`. The production files are in `dist/fagot-festival-check/browser`. Host that directory as a static site, then connect `fagot.naranjo.io` in the host's custom-domain settings and DNS.
4. Submit a test response. Verify it appears in Supabase Studio, then verify a signed-out visitor cannot select, update, or delete responses through the API.

The SQL gives the unauthenticated role permission to insert only the form fields. Row Level Security has an insert policy and no public read policy. There is no organizer sign-in or dashboard in this draft.

## Before inviting students

- Confirm which accessories can actually be sold or loaned and adjust the labels accordingly.
- Finalize the festival's privacy notice, contact details, retention period, and any school requirements before collecting personal information.
- Public insert access can attract spam. Add rate limiting or a protected submission endpoint before wide distribution.
- Revisit the copy and language with the festival team. The date, location, festival name, and branding have deliberately been left generic.

## Structure

- `src/app/app.ts`: form model, validation, and Supabase submission.
- `src/app/app.html`, `src/app/app.css`: responsive student experience.
- `supabase/schema.sql`: table, grants, and Row Level Security.
