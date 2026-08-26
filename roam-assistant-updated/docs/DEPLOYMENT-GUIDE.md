# Roam Assistant: Deployment Guide

How to get the assistant live on roam-electric.com, capturing leads, and connected to an AI model.

**Files in this bundle**

| File | What it is |
|---|---|
| `roam-assistant.js` | The widget. The only file that goes on your site. |
| `google-apps-script.gs` | Lead capture → Google Sheet. |
| `ai-proxy-worker.js` | Connects to ChatGPT, Perplexity or Claude. |
| `roam-assistant-preview.html` | Local preview only. Not deployed. |
| `DEPLOYMENT-GUIDE.md` | This file. |

Three stages. **Stages 1 and 2 need no developer.** Stage 3 is a copy-paste deploy that someone comfortable with a dashboard can do in about 15 minutes.

---

## Why it isn't a copy-paste into Webflow

Webflow caps site-wide custom code at roughly **10,000 characters**. The widget is ~211 KB because Roam's photography and wordmark are embedded. So it has to be **hosted**, and Webflow gets a single `<script>` tag.

---

## Stage 1: Get the widget on the site

### 1a. Host `roam-assistant.js`

**Option A: GitHub + jsDelivr (recommended)**

1. Create a public GitHub repo, e.g. `adallan01/Roam-Assistant`.
2. Upload `roam-assistant.js`.
3. Your URL:
   ```
   https://cdn.jsdelivr.net/gh/adallan01/Roam-Assistant@main/roam-assistant.js
   ```
4. jsDelivr caches hard. On update, use a tagged version (`@v1.1`) or purge at `jsdelivr.com/tools/purge`.

**Option B: Netlify Drop (fastest, ~60 seconds)**
Drag a folder containing the file onto `app.netlify.com/drop`.

**Option C: Cloudflare Pages / your own server.** Any static HTTPS host works.

> ⚠️ Webflow's Asset Manager does **not** reliably host `.js`. Don't rely on it.

### 1b. Add the script tag

Webflow → **Project Settings → Custom Code → Footer Code**:

```html
<script>
  window.RoamAssistantConfig = {
    leadsEndpoint: "",   // stage 2
    apiEndpoint:   ""    // stage 3
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/adallan01/Roam-Assistant@main/roam-assistant.js" defer></script>
```

**Save → Publish.** The orange **Ask Roam** button appears bottom-right on every page and works immediately from its built-in knowledge.

### 1c. Open it from your own buttons

```html
<a href="#" onclick="RoamAssistant.open(); return false;">Chat to sales</a>
```

Worth adding to the financing and test-ride sections, where intent is highest.

---

## Stage 2: Lead capture

### 2a. Sheet and script

1. New Google Sheet → **Extensions → Apps Script**.
2. Paste `google-apps-script.gs`, Save.
3. **Run → `setupSheet`**, approve the permission prompt. (Google warns it's unverified, which is normal for your own scripts. Advanced → Go to project → Allow.)
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** ← not "Anyone with a Google account"
5. Copy the `/exec` URL.

**Verify:** open that URL in a browser. You should see
`{"ok":true,"service":"Roam Assistant lead capture","ready":true}`.

### 2b. Connect it

```html
<script>
  window.RoamAssistantConfig = {
    leadsEndpoint: "https://script.google.com/macros/s/AKfy..../exec",
    apiEndpoint:   ""
  };
</script>
```

### 2c. What you get per lead

Timestamp (server-side, Nairobi), name, phone (normalised to `+2547…`), email, interest, UTM source/medium/campaign, page, referrer, **full conversation transcript**, and **the unanswered question** if they came via *Get me an answer*.

The transcript is the one that matters. A rep can see the person asked about 24-month M-KOPA terms before dialling.

### 2d. Optional

- **Email alerts:** set `NOTIFY_EMAIL` in the Apps Script.
- **Anti-spam:** set `SHARED_SECRET` in the script and the same string as `leadsSecret` in the widget config.

> **Remember:** after *any* Apps Script edit you must
> **Deploy → Manage deployments → pencil → Version: New version → Deploy.**

---

## Stage 3: Connect ChatGPT, Perplexity and Claude

### Can it link to these? Yes, all three at once.

The widget sends `{ system, messages }` to whatever `apiEndpoint` you configure. `ai-proxy-worker.js` is a Cloudflare Worker that receives that, adds your API key, and forwards it to the provider (or providers) of your choice.

You can run **one provider** (simplest) or a **chain of all three** (recommended, so a gap in one model's knowledge never leaves a visitor unanswered): the Worker tries each provider in order and uses the first one that actually replies. If every provider in the chain fails, the widget quietly falls back to its own built-in knowledge, exactly as if no AI were connected at all.

### Choosing providers

| | Live web search | Best for | Rough cost |
|---|---|---|---|
| **OpenAI (ChatGPT)** `gpt-4o-mini` | No | Natural sales conversation, cheapest | fractions of a cent per chat |
| **Perplexity** `sonar` | **Yes** | Widest coverage, can answer things absent from the knowledge base | ~1 cent per chat |
| **Anthropic (Claude)** | No | Most reliable at refusing to invent figures | fractions of a cent per chat |

**A word on Perplexity.** Live web search is genuinely appealing: it means almost nothing goes unanswered. But a searching model can surface an outdated article, a competitor's page, or old pricing and state it as fact *on your own sales site*. The proxy's guardrails tell it to trust your supplied facts over anything it finds and never to quote web pricing, and you can lock it to your own domain with `search_domain_filter`. The risk isn't zero though. If you run the chain, put `perplexity` last so the more careful models get first chance to answer, and it only kicks in as a safety net.

### Deploy

1. `dash.cloudflare.com` → **Workers & Pages → Create → Worker** → name it → Deploy.
2. **Edit code**, paste `ai-proxy-worker.js`, Deploy.
3. **Settings → Variables and Secrets** — pick one setup:

   **Simplest, one provider:**

   | Name | Value | Type |
   |---|---|---|
   | `PROVIDER` | `openai`, `perplexity` or `anthropic` | Text |
   | `API_KEY` | your provider key | **Secret** |
   | `ALLOWED_ORIGINS` | `https://www.roam-electric.com,https://roam-electric.com` | Text |
   | `MODEL` | *(optional)* override the default | Text |

   **Recommended, linked to all three (falls through until one answers):**

   | Name | Value | Type |
   |---|---|---|
   | `PROVIDER_CHAIN` | `openai,anthropic,perplexity` (any order; leave `perplexity` last) | Text |
   | `OPENAI_API_KEY` | your OpenAI key | **Secret** |
   | `ANTHROPIC_API_KEY` | your Anthropic key | **Secret** |
   | `PERPLEXITY_API_KEY` | your Perplexity key | **Secret** |
   | `ALLOWED_ORIGINS` | `https://www.roam-electric.com,https://roam-electric.com` | Text |

   Only set keys for the providers you actually want in the chain; a provider with no key is skipped rather than treated as an error, so you can start with one or two and add more later without changing anything else.

4. Copy the Worker URL into the widget config:

```html
<script>
  window.RoamAssistantConfig = {
    leadsEndpoint: "https://script.google.com/macros/s/AKfy..../exec",
    apiEndpoint:   "https://roam-assistant-ai.YOURNAME.workers.dev"
  };
</script>
```

**Set `ALLOWED_ORIGINS`.** Without it, anyone who finds the URL can spend your API credit. Also set a spending cap in each provider's dashboard.

**If a provider is ever down, over quota, or (in chain mode) every provider fails, the widget silently falls back to its built-in knowledge.** Turning this on cannot take the assistant offline.

---

## No dead ends

The assistant never replies with a bare "I don't have that information." When it can't answer:

1. It says it wants to get it right rather than guess.
2. It gives whatever related information it does have.
3. It shows three one-tap actions:
   - **WhatsApp us**: opens WhatsApp with their question already written into the message
   - **Call**: dials on mobile
   - **Get me an answer**: takes their number, with the question attached

That third one is the important one commercially: an unanswerable question becomes a lead, and the rep already knows exactly what to answer.

The same rule is written into the AI system prompt, so it applies whether the answer comes from the built-in knowledge or a live model.

---

## Phone and desktop

- **Under 600px** the widget becomes a full-screen sheet rather than a floating card.
- Inputs are **16px on mobile**, which stops iOS Safari force-zooming the page when someone taps the box.
- Uses **`dvh`** and **safe-area insets**, so nothing hides behind the browser bar or a notch.
- **On-screen keyboard** is tracked via `visualViewport`, so the composer stays visible while typing.
- The page behind the sheet is **scroll-locked** and restores position on close.
- All tap targets are **at least 44px**.
- Autofocus is **disabled on touch devices**: otherwise opening the chat immediately covers it with the keyboard.
- Landscape phones hide the status and footer lines to reclaim height.
- Honours `prefers-reduced-motion`.

Verified at 320, 360, 390, 768 and 1440px: panel fits, no horizontal scroll, no iOS zoom.

---

## Maintenance

| To change | Edit in `roam-assistant.js` |
|---|---|
| Financing plans and rates | `FINANCING_DATA` |
| Cash prices | `CASH` |
| FAQ | `FAQ` |
| Story cards | `MEDIA` |
| Offline answers (15 topics) | `TOPICS` |
| AI knowledge and behaviour | `SYSTEM_PROMPT` |
| Lead-form trigger words | `INTENT` |
| Starter chips | `SUGGESTIONS` |
| Test-ride booking link | `TEST_RIDE_URL` |
| Approved shop and hub locations | `PLACES` |
| Question categories | `INTENTS` |
| Wording for unverified answers | `FALLBACK` |
| Questions that must be escalated | `NOT_APPROVED` |

### Adding a new location

When a new Roam shop or hub opens, add it to `PLACES` in `src/roam-assistant.src.js` and to the approved location list in `SYSTEM_PROMPT`. Until it is in both, the assistant will correctly say it cannot confirm Roam is there. This is deliberate: it is what stops the assistant inventing a presence in a town where Roam has none.

### Pre-filling the booking form

The test-ride button opens Roam's "Book a Free Test Ride" Google Form. If you want it to open with the visitor's name and phone already filled in, get the field ids once:

1. Open the form, click the three dots, choose **Get pre-filled link**.
2. Type `NAME` in Full Name, `PHONE` in Phone Number, `EMAIL` in Email Address. Submit, then copy the link.
3. The link contains `entry.1234567890=NAME` and so on. Put those `entry.` ids into `testRideFields` in the widget config.

Two things go stale fastest:

1. **Financing rates**: check against the calculator each quarter.
2. **Buses**: currently marked *on hold*. When sales resume, update the bus entry in `TOPICS` and the BUSES paragraph in `SYSTEM_PROMPT`.

**Watch the leads sheet.** The *unanswered question* column is a free list of what your knowledge base is missing. Anything appearing repeatedly should become a new `TOPICS` entry or FAQ.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Button doesn't appear | Script URL wrong, or code went in Header not Footer. Check the browser console. |
| Leads not reaching the sheet | Access isn't "Anyone", or the script was edited without deploying a **new version**. |
| "Could not reach our server" | Endpoint URL wrong. The lead is queued and retried, but check it. |
| AI replies generic | `apiEndpoint` empty or the Worker is erroring. Open the Worker URL in a browser, it should return JSON. |
| Worker returns 403 | Your site's origin isn't in `ALLOWED_ORIGINS`. Include both www and non-www. |
| Page zooms when typing on iPhone | An older cached copy. Purge the CDN. |
| Old version still loading | jsDelivr cache. Purge, or use a versioned tag. |
| Two chat buttons | Script included twice. It self-guards, but remove the duplicate. |

---

## Privacy

You're storing names, phone numbers and conversation history. Kenya's **Data Protection Act 2019** requires a lawful basis for collecting personal data and grants people the right to request deletion. Worth a check with whoever handles compliance, and link your privacy policy in the `rai-lead-privacy` block of the widget.

If you enable a third-party model, visitor questions are sent to that provider. Check their data-retention terms and reflect it in your privacy policy. OpenAI and Anthropic both offer no-training-on-API-data by default; confirm the current position for whichever you pick.
