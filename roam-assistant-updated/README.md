# Roam Assistant

Sales assistant widget for [roam-electric.com](https://www.roam-electric.com), answering questions about Roam Air, charging and financing, and capturing leads for the sales team.

Self-contained, no build step required to deploy, no dependencies.

---

## Quick start

Add this to **Webflow → Project Settings → Custom Code → Footer Code**:

```html
<script>
  window.RoamAssistantConfig = {
    leadsEndpoint: "",   // Google Apps Script /exec URL
    apiEndpoint:   "",   // AI proxy URL
    testRideUrl:   "",   // optional: override the default Book a Test Ride form link
    testRideFields: {    // optional: carry chat details into the booking form
      name: "", phone: "", email: ""   // e.g. "entry.1234567890"
    }
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/adallan01/Roam-Assistant@main/roam-assistant.js" defer></script>
```

All three are optional. With `leadsEndpoint` and `apiEndpoint` unset, the assistant still answers from its built-in knowledge base and routes people to WhatsApp or phone. `testRideUrl` defaults to Roam's live "Book a Free Test Ride" Google Form, so it only needs setting if that form ever moves.

Full instructions: **[docs/DEPLOYMENT-GUIDE.md](docs/DEPLOYMENT-GUIDE.md)**

---

## What's here

```
roam-assistant.js              ← the widget (deploy this)
roam-assistant-preview.html    ← open in a browser to try it
src/roam-assistant.src.js      ← editable source
src/build.py                   ← embeds brand assets → roam-assistant.js
backend/ai-proxy-worker.js     ← Cloudflare Worker → ChatGPT / Perplexity / Claude
backend/google-apps-script.gs  ← lead capture → Google Sheet
brand/                         ← wordmark and product photography (build inputs)
docs/DEPLOYMENT-GUIDE.md       ← setup, maintenance, troubleshooting
```

---

## Features

**Answers the question actually asked.** Every question is classified into a category first, then answered only from that category. A question about whether Roam has a shop in a particular town can never be answered with a fact about battery durability, and a place that is not in the approved location list returns "I don't have that confirmed" rather than an inferred answer. Relevance is treated as more important than completeness.

**Refuses to invent.** Prices, deposits, rates, colours, opening hours, battery capacity, service pricing, warranty outcomes and financing decisions are all treated as controlled data. Anything not explicitly approved is escalated to the sales line instead of being answered from general knowledge. These guardrails run before the AI model is called, so no model can talk its way around them.

**Answers from verified knowledge.** Roam Air specs, all 13 financing plans across five partners, charging, savings maths, servicing, insurance, upcountry use and more, checked against roam-electric.com and Roam's own financing calculator.

**Never dead-ends.** When it can't answer, it doesn't stop at "I don't know." It offers what related information it has, then three one-tap routes: WhatsApp (with the question pre-written), Call, and *Get me an answer*, which captures the lead **with the unanswered question attached**, so the rep knows exactly what to come back on.

**Captures leads.** Intent-triggered, once per session. Name and phone required, email optional. Kenyan phone numbers normalised to `+2547…`. Writes name, phone, email, UTM attribution, page, the full conversation transcript and any unanswered question straight to a Google Sheet.

**Model-agnostic.** One environment variable switches the proxy between OpenAI, Perplexity and Anthropic. If the provider is down or over quota, the widget falls back to its built-in knowledge: enabling AI cannot take the assistant offline.

**Built for phones.** Full-screen sheet under 600px, 16px inputs (so iOS doesn't force-zoom), `dvh` sizing, safe-area insets, on-screen-keyboard tracking, scroll lock, 44px tap targets.

**On brand.** Palette sampled from Roam's actual wordmark (`#ED7D31`), Montserrat, the eyebrow rule motif from their production CSS, and real Roam product photography.

---

## Editing the knowledge base

Edit `src/roam-assistant.src.js`, then rebuild:

```bash
python3 src/build.py
```

| To change | Edit |
|---|---|
| Financing plans and rates | `FINANCING_DATA` |
| Cash prices | `CASH` |
| FAQ | `FAQ` |
| Story cards | `MEDIA` |
| Offline topic answers | `TOPICS` |
| AI knowledge and behaviour | `SYSTEM_PROMPT` |
| Lead-form trigger words | `INTENT` |
| Starter chips | `SUGGESTIONS` |
| Test-ride booking link | `TEST_RIDE_URL` |
| Approved shop and hub locations | `PLACES` |
| Countries that are not active markets | `OTHER_COUNTRY` |
| Which category a question belongs to | `INTENTS` |
| Wording used when an answer is not verified | `FALLBACK` |
| Questions that must always be escalated | `NOT_APPROVED` |

You *can* edit `roam-assistant.js` directly for a quick fix, but it will be overwritten on the next build, so put lasting changes in `src/`.

### Keep current

- **Financing rates**: verify against the financing calculator each quarter.
- **Buses**: Roam Move and Roam Rapid are currently marked *on hold*. When sales resume, update the bus entry in `TOPICS` and the BUSES paragraph in `SYSTEM_PROMPT`.
- **The leads sheet**: the *unanswered question* column is a free list of what the knowledge base is missing. Recurring entries should become new `TOPICS` or `FAQ` entries.

---

## Notes

No API keys live in this repository, and none should. The widget holds no credentials; the AI proxy reads its key from a Cloudflare environment secret, and the lead endpoint is a public Apps Script URL with an optional shared secret.

If you serve this over jsDelivr, note that it caches aggressively, so use a tagged release (`@v1.1`) or purge at [jsdelivr.com/tools/purge](https://www.jsdelivr.com/tools/purge) after updating.

Brand assets in `brand/` are Roam Electric property and are included as build inputs for this widget.
