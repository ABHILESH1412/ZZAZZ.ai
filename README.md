# Folio Rights Studio

Folio is a rights studio for independent journalists. The workspace opens with Mara Vale, a fictional reporter, and her story about a night tram in the fictional city of Bellhaven. All reporting, buyers, usage records, prices, payments and disputes are simulated. The story cover is an AI-generated illustration.

## Run locally

Use Node.js 20.19+ or 22.12+ and a compatible npm version.

```sh
npm ci
npm run dev
```

Open the local URL Vite prints. Run `npm run check` for type checking or `npm run build` to build the static site into `dist/`. Run `npm run preview` to inspect that build.

## Enable AI editorial suggestions

Copy `.env.example` to `.env.local`, set `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/api-keys), and restart Vite. `GEMINI_MODEL` is optional and defaults to `gemini-3.8-flash`, which Google lists on its [free tier](https://aistudio.google.com/docs/pricing#gemini-3.8-flash). The key is read only on the server, and Git ignores `.env.local`. Both `npm run dev` and `npm run preview` serve the same-origin API via Vite. The built static assets alone support the rest of the workspace. Keep the API on a local or access-controlled server because requests use your account.

On **Write & value**, select **Get AI suggestions**. Folio sends the title, topic, and up to 12,000 characters of body text to the [Gemini Developer API](https://aistudio.google.com/api-reference/generate-content). Editing and importing are local, and the valuation formula works offline with or without a key. API feedback is held in the editor view and refreshed manually after the draft changes.

## Hosted reviewer demo

The GitHub Pages frontend can use the Cloudflare Worker when the build sets `VITE_FOLIO_SUGGESTIONS_URL` to the Worker’s full `/api/editorial-suggestions` URL. Build the hosted frontend with `VITE_STATIC_DEMO=1` and Vite’s `--base /ZZAZZ.ai/`. Without a Worker URL, that static build shows the local setup note. `npm run check:worker` type-checks the Worker.

The hosted demo uses Gemini 3.1 Flash-Lite. Set `GEMINI_API_KEY` as a Worker secret. Anyone visiting the demo can request suggestions. The Worker reserves up to eight generation requests per UTC day across the entire demo. Opening the page does not send a draft. The site sends draft text to Gemini when a visitor requests suggestions.

## Explore the workspace

1. Change the story or topic on **Write & value**. Replace the body with a few repeated words to see the estimate and confidence fall.
2. Open **Licence builder** and change a price or permission. The English summary and JSON update from the same rules. Select **Publish version**.
3. On **Public work page**, check the byline, disclosure, snapshot integrity, and current usage terms. Switch to **AI system** for the preview, licence, and example quotation record.
4. Open **Usage & earnings**. Filter by audience and licence, and compare the earnings curve, derivatives, and buyer report. The October sample remains associated with version 1 after publishing a new version.

5. Open **Back catalogue**, upload or paste a CSV or JSON list, then use **Ready to price** to filter priority pieces.
6. Open **Derivative map** and select the original or a derivative to inspect the source, gross proceeds, licence minimum, and credited amount.

Version 1 is already published when the workspace first opens. Edits, licence choices and the latest publication are saved per browser origin under the `folio-studio-v1` local storage key. Clearing that key restores the sample. If saving is unavailable, the app works for the current session. The public page is a local preview.

## Back catalogue imports

Import CSV with a header, or a JSON array of objects. `title` is required. Use `text` for the story or a detailed description, `topic` for one of the four studio topics, and `published_at` for a date in YYYY-MM-DD format. Folio infers a topic when omitted. For CSV, quote fields containing commas or newlines and escape a quote inside a field with a second quote.

```csv
title,text,topic,published_at
Harbor notes,"A profile of the people who run the repair café.",Culture & community,2025-07-08
```

The catalogue is saved on this browser under `folio-catalogue-v1`. Re-importing a title and date updates the matching record. Past dates reduce only the timeliness contribution by `max(0.2, 365 / (365 + age in days))`. Missing dates use a multiplier of 0.65. Folio recommends **Price now** when the upper estimate reaches $2, originality plus depth reaches 115, topic demand reaches 50, and confidence is at least 45. Thinner entries ask for more text. Other pieces get a refresh recommendation.

## Derivative lineage

The map reads the same transaction ledger as **Usage & earnings**. The original branches into a translation, a summary, and an audio clip. A syndicated copy descends from the translation. Each record credits the original with the greater of its 25% share of gross proceeds or its $45 licence minimum. The root total counts each payment once, including nested works.

## Valuation model

The estimate is a suggested USD price for one reader, independent of the creator's chosen price. It reacts to story text and topic. The model uses reporting signals and a fixed mock demand index. Confidence measures the amount and variety of evidence in the draft, rather than the probability of a sale or the accuracy of its reporting.

- **Coverage** is unique tokens divided by 100, capped at 1. The **quality multiplier** is the unique-token ratio divided by 0.43 (capped at 1), multiplied by the share of unique sentence fragments.
- **Originality** starts with 28 × coverage and adds 16 for each distinct signal category, such as firsthand observations, interviews, records, and quotations.
- **Timeliness** starts with 39 × coverage and adds 12 for each distinct timing category, such as a recent event, an upcoming decision, or a date.
- **Depth** uses 43 × coverage, 6 points per distinct numeric detail (up to five), and 4 points per reporting signal.
- **Topic demand** uses the topic's fixed demand index (61–86), scaled by coverage and the share of four distinct relevant words found in the draft.
- Each component is multiplied by quality, rounded, and capped at 100. The combined score weights originality, timeliness, depth, and demand at 34%, 16%, 32%, and 18%. The midpoint in dollars is `coverage × (1.05 × score + score² / 54) / 100`. The spread on each side is `25% + (100 − confidence) / 175` of the midpoint, rounded outward to the nearest quarter dollar.
- Confidence is `64 × coverage + 6 × reporting signals − 30 × (1 − quality)`, rounded and bounded to 0–100. Repeated tokens, sentences and keywords add little or nothing. Diverse fabricated details can still score well, so the explanation uses signals and Folio does not fact-check or establish originality.

## Product decisions and edge cases

- **Can I trust a low estimate?** The value explains what signals are missing and offers a next edit. It stays advisory so a creator can charge more or less. The starting $4 price illustrates that choice.
- **How do I grant permission quickly?** Four rows each offer Allow, Ask first, or Prohibit. $0 means no charge. Prohibited uses have no effective price and export a JSON null. A previously entered amount is retained in case the creator re-enables the use. Changing draft terms leaves the public snapshot in place until the next publish.
- **Why charge more for training?** The starting terms charge $4 for an individual's reading, $1.50 for a single attributed AI answer, and proposes $350 for model training after approval. Training can support many future outputs and is harder to reverse. The example assumes a separate approval for this one use. The UI does not enforce off-platform permissions.
- **What can buyers verify?** SHA-256 covers the version, byline, time, title, full text, topic, disclosure, and stored terms. The app recomputes it against the snapshot. It detects a changed payload when the saved fingerprint is intact. There is no shared registry, signature, or independent identity check. The AI record is an example attached to the licence, with no simulated authorization for quotation if that use is prohibited or pending approval.
- **What if a derivative earns little?** The sample uses a negotiated $45 minimum against a 25% share of gross proceeds. The dashboard displays the derivative type, source ID, gross, percentage and payout. For the expanded summary, 25% of $132 is $33, so the $45 minimum applies. These are simulated deal terms.
- **What if a buyer disputes my story?** The sample holds only the disputed transaction. Other earnings clear normally. The proposed workflow gives the creator a chance to respond before a reviewer releases the hold or refunds the buyer. Review and payment flows are illustrated with a sample status.
- **What happens when I update the public work?** Publishing increments the version and replaces the locally displayed public snapshot. The dashboard keeps seeded transactions tied to the terms they were transacted under. Folio shows the latest publication snapshot. The back catalogue is a separate import of past work.

The October activity is deterministic. A repeating daily volume pattern produces one to five base transactions per day across human reading and AI quotation. Four approved derivative deals and one approved training transaction add irregular events. Cleared totals exclude the single disputed transaction. The chart sums cleared cents through each day, and derivative payouts are included in cleared earnings.

## Libraries and assets

SolidJS, Vite, TypeScript, GSAP, Lucide, Noble Hashes, and Fontsource variable fonts (Manrope and Newsreader). GSAP animates view changes only when the browser permits motion. The tram illustration is bundled locally. The valuation, licences, catalogue and earnings use local data. Editorial suggestions use the optional Google Gemini connection.
