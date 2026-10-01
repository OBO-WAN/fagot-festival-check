# Optional sponsorship exercise

The default configuration is **off**. The normal questionnaire and its submission flow do not load an ad. The panel is eligible to appear only after a successful save, or on the dedicated public verification view described below.

## Preview without an ad account

Run `npm ci` and `npm start`. Open `http://localhost:4200/?sponsor-preview=1`.

This view shows a labelled, dismissible sample in the festival's visual style. It does not submit a response, display a real advertiser, contact AADS, or earn sats. The preview query always selects the sample, even if the configured mode is live. Click **Ir al cuestionario** to return to the form.

To show this sample after real successful submissions, change `mode` to `preview` in `src/app/sponsor-config.ts`. Keep the default `off` if the exercise should be accessible only through the preview link.

## Observe behaviour

In the browser developer console, before closing the sample, run:

```js
window.addEventListener('festival:sponsor', ({ detail }) => console.log(detail));
```

The panel emits `panel_rendered`, `frame_loaded` (live only), and `panel_dismissed`, with its mode. To observe the initial render, attach the listener before mounting the panel, for example before submitting a test form in a separate test environment.

These are local DOM events, with no server endpoint, cookie, local storage, visitor identifier, or form data. They are not campaign-wide analytics. `panel_rendered` describes mounting, not visibility. An iframe load does not prove that an ad rendered successfully, was viewed, or earned money. Cross-origin ad clicks are not intercepted. AADS's own dashboard is the authority for impressions, earnings, and payouts.

Do not submit dummy responses to the production survey just to test this feature. Use the preview link or the mocked component tests instead.

## Before live activation

1. Confirm that the website is eligible with AADS, including its domain-age requirement. Create a publisher account yourself and review its terms. No account or ad unit is created by this change.
2. Obtain approval for the after-submission placement and dedicated verification view. AADS requires approval for non-standard locations. Its verification bot cannot complete this questionnaire to reach the success screen.
3. Configure a 300×250 ad unit, conservative content filters suitable for festival participants, and your Lightning payout destination in AADS. Never place payout secrets or API keys in this repository.
4. Set `mode: 'live'` and replace the empty `adUnitId` in `src/app/sponsor-config.ts` with your public, numeric ad-unit ID. Invalid or missing IDs fail closed and render no panel.
5. Build a review deployment. Register its `?sponsor-check=1` URL as the bot-accessible verification page. It has contextual festival information and displays the configured panel without pretending that a response was received or requiring a submission.
6. Verify the placement in AADS and test with its approved procedure. Check that its embed works with the iframe sandbox and no-referrer policy; request support if they interfere with verification or advertiser links rather than removing protections without review. No live delivery or earnings have been verified by this exercise.
7. Review the site's privacy notice for the live third-party connection, then publish only when the placement and content settings are ready.

The live iframe uses a fixed HTTPS AADS host and a validated numeric ID, is labelled as advertising, is dismissible, and has no timer, auto-refresh, forced redirect, or connection to social buttons. It sends no survey values to the provider. A live iframe still contacts a third party and exposes normal connection information such as the visitor's IP address to that provider; this is not a zero-risk experiment.

If no advertiser is available or an ad blocker prevents delivery, visitors can still leave or submit another response. Closing the panel never changes the saved submission.

## Small experiment and rollback

Keep a manual record of campaign dates, AADS counted impressions and earned sats, and the effort spent on setup. Use existing response totals to monitor survey completion; this change does not add a tracking system. With fewer than 1,000 visitors, results are exploratory and should not be treated as a reliable conversion experiment.

Stop if the content is unsuitable, the form experience degrades, or support costs outweigh what you want to learn. To stop external ad requests for new visits, set `mode: 'off'`, rebuild, and deploy. The next page load will contain no ad iframe. Already-open tabs must reload to receive the new configuration.

## Verification

```sh
npm run build
npm test -- --watch=false
```

Tests cover the default-off state, preview isolation, invalid live IDs, the bounded live URL, dismissal, and successful/failed survey saves using a mocked Supabase client.

## Provider references

- [Embedding and verification](https://help.aads.com/en/article/how-to-place-an-ad-unit-code-correctly-12n1ti5/)
- [Publisher terms and placement requirements](https://aads.com/terms-of-service/)

Provider policies may change; verify them again before activating the live mode.
