# Real AADS sponsorship campaign

This integration loads a real AADS 300×250 iframe in a labelled, dismissible slot below the questionnaire. It appears on the public root page before or after submission, so the provider's verifier can reach it. Social buttons remain independent links; clicking them does not generate ad income.

**Activation is pending the owner's public AADS ad-unit ID.** The configuration has `enabled: true`, but an empty or invalid ID loads nothing. There is no sample banner, simulated earnings, or preview route.

## Activate real delivery

1. Use an AADS account that you control. Review the provider's site eligibility requirements, including domain age, and accept its terms yourself when creating the unit. This code does not create an account or ad unit.
2. Create a fixed-size **300×250** website unit for `https://encuesta.festival-fagot.online/`. Block Investments, Gambling, NSFW, and Risky projects. Use the footer placement rather than a popup or an ad gated behind the form.
3. Copy the public numeric ID from your generated embed code into `adUnitId` in `src/app/sponsor-config.ts`. Leave `enabled: true`. An ID identifies the account that receives earnings: never use a demo unit or somebody else's ID. Do not include API keys, login details, or wallet secrets in the repository.
4. Build and deploy the change. Confirm the live page contains exactly one `iframe[data-aa]` whose ID and provider URL match your unit. Check mobile layout, closing the banner, and survey submission independently. Do not send dummy answers to the production survey.
5. Use AADS's verification/status controls to confirm the public page is accessible, the unit is healthy, and real ads are being delivered. Check the generated embed against the fixed HTTPS URL in this component. If sandboxing or the no-referrer policy prevents delivery or verification, investigate with provider support before changing those protections. Passing the automated tests is not evidence of ad delivery.
6. Set up Lightning withdrawals in your AADS account using a receiving method you control. Funds are credited by AADS to your publisher balance; the website never handles funds or requests a payment from a participant. No payout destination has been configured by this code.

The banner includes a connection-data notice. A live ad request discloses normal network information, such as the visitor's IP, to AADS. No form values are passed to the ad URL. Verify the provider's content filters and privacy requirements before inviting participants.

## Measure the actual campaign

Record the campaign dates, AADS-counted impressions, publisher earnings, and any actual Lightning withdrawal. Use the provider's dashboard for these numbers. Record setup time too, so the exercise can be evaluated even if revenue is tiny or zero. Advertiser availability, eligibility, and traffic quality determine whether a request earns anything.

For local debugging only, the component emits `festival:sponsor` DOM events with `{ event, provider: 'aads' }`. Events are `panel_rendered`, `frame_loaded`, and `panel_dismissed`. They contain no survey data, visitor ID, cookie, or persistent storage. They are not campaign-wide analytics: mounting or loading the iframe does not prove an ad was visible or billable. Cross-origin ad clicks are not intercepted or simulated.

With fewer than 1,000 expected visitors, treat the result as a small operational experiment. Do not click your own ads, encourage artificial clicks, or refresh the banner to inflate impressions. More social-button clicks do not imply more publisher income.

## Disable and verify

Set `enabled: false` in `src/app/sponsor-config.ts`, rebuild, and deploy to stop ad requests on new page loads. Already-open pages receive the change after reloading. Dismissing the banner on a page does not change questionnaire answers or the saved confirmation.

```sh
npm run build
npm test -- --watch=false
```

Tests cover missing/invalid IDs, the disable switch, the fixed provider host and matching unit ID, dismissal, and the banner's independence from successful or failed survey saves. Supabase is mocked in automated tests, and numeric IDs used there are test fixtures only.

## Provider references

- [Create an ad unit](https://help.aads.com/en/article/how-to-create-an-ad-unit-1pqx5hd/)
- [Embedding and verification](https://help.aads.com/en/article/how-to-place-an-ad-unit-code-correctly-12n1ti5/)
- [Publisher terms](https://aads.com/terms-of-service/)
- [Lightning payments](https://aads.com/lightning/)
