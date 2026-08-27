/**
 * ROAM ASSISTANT: AI PROXY (Cloudflare Worker)
 * ============================================================================
 * Connects the widget to one or more large language models: OpenAI (ChatGPT),
 * Perplexity and Anthropic (Claude).
 *
 * WHY THIS EXISTS
 * The API key must never sit in the widget. Anything in browser JavaScript is
 * public: someone can read the key from your page source and spend your credit.
 * This Worker holds the keys server-side and is the only thing that talks to
 * the model providers.
 *
 * ── SIMPLEST SETUP: ONE PROVIDER ────────────────────────────────────────────
 *  1. Create a free account at dash.cloudflare.com
 *  2. Workers & Pages → Create → Worker → name it "roam-assistant-ai" → Deploy
 *  3. Edit code → paste this whole file → Deploy
 *  4. Settings → Variables and Secrets:
 *
 *       PROVIDER          openai          (or: perplexity | anthropic)   [Text]
 *       API_KEY           sk-...          your provider key              [Secret]
 *       ALLOWED_ORIGINS   https://www.roam-electric.com,https://roam-electric.com
 *
 *     Optional:
 *       MODEL             override the default model for your provider   [Text]
 *
 *  5. Copy the Worker URL, e.g. https://roam-assistant-ai.<you>.workers.dev
 *  6. Put it in the widget config as `apiEndpoint`.
 *
 * ── LINKED TO ALL THREE (recommended): PROVIDER_CHAIN ───────────────────────
 *  So a gap in one model's knowledge never dead-ends a visitor, the Worker can
 *  try several providers in order and use the first one that actually answers.
 *  Set these instead of PROVIDER / API_KEY:
 *
 *       PROVIDER_CHAIN     openai,perplexity,anthropic   (any order)   [Text]
 *       OPENAI_API_KEY     sk-...                                      [Secret]
 *       PERPLEXITY_API_KEY pplx-...                                    [Secret]
 *       ANTHROPIC_API_KEY  sk-ant-...                                  [Secret]
 *       ALLOWED_ORIGINS    https://www.roam-electric.com,https://roam-electric.com
 *
 *     Optional per-provider model override:
 *       OPENAI_MODEL / PERPLEXITY_MODEL / ANTHROPIC_MODEL              [Text]
 *
 *  Only set keys for providers you actually want in the chain. A provider
 *  with no key configured is skipped rather than treated as an error. If
 *  every provider in the chain fails or is unconfigured, the Worker returns
 *  502 and the widget falls back to its own built-in knowledge, so it is
 *  never worse than not having AI enabled at all.
 *
 *  Recommended order: put `perplexity` last, since it is the only one of the
 *  three with live web search, so it acts as the final safety net for
 *  questions the built-in Roam facts do not cover. See the warning below
 *  before relying on it for anything price-related.
 *
 * ── HOW THE WIDGET USES THIS ────────────────────────────────────────────────
 *  The widget no longer sends only the questions its own knowledge could not
 *  answer. It classifies the question, answers locations, parts and live panel
 *  actions itself, and sends everything else here along with a `context` block
 *  holding Roam's approved answer for that question and the nearest related
 *  material. The model writes the reply from that. The widget then verifies
 *  what comes back against the approved figures, places and partners, and
 *  discards any reply that fails, falling back to its own answer.
 *
 *  That means model quality now shows up directly in answer quality. The
 *  cheapest tier of each provider is enough for phrasing, but a mid tier model
 *  is noticeably better at the questions this was built for: working out a
 *  rider's savings from what they spend today, comparing two financing plans,
 *  and knowing when it has not been given enough to answer. Set OPENAI_MODEL /
 *  ANTHROPIC_MODEL accordingly if the default feels thin.
 *
 * ── WHICH PROVIDER? ─────────────────────────────────────────────────────────
 *  openai      ChatGPT models. Strong conversational sales tone. No live web
 *              access, answers only from the Roam knowledge in the prompt.
 *              Cheapest of the three at gpt-4o-mini.
 *
 *  perplexity  Has LIVE WEB SEARCH built in. It can answer things absent from
 *              the knowledge base by searching the web, including your own
 *              site. Best coverage, but see the warning below.
 *
 *  anthropic   Claude. Strong instruction-following, tends to be the most
 *              reliable at refusing to invent figures.
 *
 * ⚠️ WARNING ABOUT WEB SEARCH (Perplexity)
 *  A model that searches the web can pull in outdated articles, competitor
 *  pages, or old pricing, and state them as fact on your own sales site. The
 *  system prompt below tells it to trust the supplied Roam facts over anything
 *  it finds, and never to quote prices from the web, but the risk is not zero.
 *  If accuracy on price matters more than breadth of coverage, use openai or
 *  anthropic only, or keep perplexity last in the chain so the more careful
 *  models answer first. You can also restrict Perplexity to your own domain
 *  by uncommenting `search_domain_filter` below.
 *
 * ── COST ────────────────────────────────────────────────────────────────────
 *  Rough order of magnitude at ~1,500 tokens per exchange:
 *    gpt-4o-mini            fractions of a cent per conversation
 *    sonar (Perplexity)     around a cent per conversation
 *    claude-haiku           fractions of a cent per conversation
 *  A few thousand conversations a month is typically a few dollars per
 *  provider. Set a spending cap in each provider's dashboard regardless. A
 *  PROVIDER_CHAIN only calls a second or third provider when an earlier one
 *  fails, so normal use costs about the same as a single provider.
 * ========================================================================== */

const PROVIDERS = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    build: (model, system, messages) => ({
      model,
      max_tokens: 700,
      temperature: 0.3,
      messages: [{ role: 'system', content: system }, ...messages]
    }),
    auth: key => ({ Authorization: `Bearer ${key}` }),
    extract: d => d?.choices?.[0]?.message?.content
  },

  perplexity: {
    url: 'https://api.perplexity.ai/chat/completions',
    defaultModel: 'sonar',
    build: (model, system, messages) => ({
      model,
      max_tokens: 700,
      temperature: 0.2,
      messages: [{ role: 'system', content: system }, ...messages]
      // Restrict web search to Roam's own site (recommended for a sales bot):
      // search_domain_filter: ['roam-electric.com']
    }),
    auth: key => ({ Authorization: `Bearer ${key}` }),
    extract: d => d?.choices?.[0]?.message?.content
  },

  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-6',
    build: (model, system, messages) => ({
      model,
      max_tokens: 700,
      system,
      messages
    }),
    auth: key => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    extract: d => d?.content?.[0]?.text
  }
};

/* Appended to the widget's system prompt. Guards against the two failure modes
   that actually cost Roam money: invented figures, and dead-end replies. */
const GUARDRAILS = `

CRITICAL OVERRIDES (these take precedence over anything else):
1. The Roam facts supplied above are the single source of truth. If a web search
   result disagrees with them, the supplied facts win. Never quote a Roam price,
   specification or availability date found on the web, only those listed above.
2. Never mention, compare against or recommend a competitor.
3. Never end a reply with only "I don't know". Always give related information
   you do have, then offer WhatsApp, phone or a call back.
4. If asked something unrelated to Roam, mobility or the purchase decision,
   answer briefly and steer back to how you can help with Roam Air.
5. Do not use the em dash character (—) in any reply. Use a comma, colon, or a
   full stop and a new sentence instead.

YOU ARE WRITING THE ANSWER, NOT LOOKING ONE UP. The widget in front of you
already handles locations, the parts catalogue and the calculator on its own.
What it cannot do is think, and that is why you are here. So:
- Reason across the facts you have been given. Combine them, do the arithmetic,
  compare the options, and explain the trade-off the customer is actually
  weighing up. That is worth far more than repeating a fact back at them.
- Answer the question in front of you, in the language it was asked in, at the
  length it deserves. A yes-or-no question gets a short answer.
- Reaching for "please contact the team" when you were given enough to answer is
  a failure, not caution. Escalate only when the answer would need a number, a
  place or a policy that nobody has given you.
- Every figure you state must be one you were given, or one you worked out from
  figures you were given and showed the working for. There is a verifier on the
  other end of this call that drops your entire reply if you invent one, so a
  guessed number does not reach the customer, it just wastes their turn.`;

/* Grounding for the current question, supplied by the widget: the subject it
   classified the question into, Roam's own approved answer where one exists,
   the nearest related material, and what the model may do with it. Sent as its
   own field so the standing prompt above stays byte-identical between turns,
   which is what keeps it cacheable at the provider. */
const MAX_CONTEXT_CHARS = 8000;

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 24;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    // With no allowlist configured, fall back to '*' so first-time setup works.
    // Set ALLOWED_ORIGINS in production or anyone can spend your API credit.
    const allowOrigin = allowed.length === 0
      ? '*'
      : (allowed.includes(origin) ? origin : null);

    const cors = {
      'Access-Control-Allow-Origin': allowOrigin || 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const chain = resolveChain(env);

    if (request.method === 'GET') {
      return json({ ok: true, service: 'Roam Assistant AI proxy', providers: chain }, 200, cors);
    }

    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

    if (allowed.length && !allowed.includes(origin)) {
      return json({ error: 'origin not allowed' }, 403, cors);
    }

    if (!chain.length) return json({ error: 'no PROVIDER or PROVIDER_CHAIN configured' }, 500, cors);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'invalid JSON' }, 400, cors); }

    const context = String(body.context || '').slice(0, MAX_CONTEXT_CHARS);
    const system = String(body.system || '') + GUARDRAILS +
                   (context ? '\n\n' + context : '');
    let messages = Array.isArray(body.messages) ? body.messages : [];

    // Basic abuse limits: cap history length and per-message size so nobody
    // can use this endpoint to run long jobs on your account.
    messages = messages
      .slice(-MAX_HISTORY)
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));

    if (!messages.length) return json({ error: 'no messages' }, 400, cors);

    // Try each provider in the chain in order. The first one that returns a
    // real answer wins. A provider that errors, times out, or has no key
    // configured is skipped rather than failing the whole request, so a gap
    // in one model's knowledge (or an outage) never dead-ends the visitor.
    const attempts = [];
    for (const name of chain) {
      const provider = PROVIDERS[name];
      if (!provider) { attempts.push({ name, error: 'unknown provider' }); continue; }

      const key = keyFor(name, env);
      if (!key) { attempts.push({ name, error: 'no API key configured' }); continue; }

      const model = modelFor(name, env, chain.length, provider.defaultModel);

      try {
        const upstream = await fetch(provider.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...provider.auth(key) },
          body: JSON.stringify(provider.build(model, system, messages))
        });

        if (!upstream.ok) {
          const detail = await upstream.text();
          console.error('provider error', name, upstream.status, detail.slice(0, 400));
          attempts.push({ name, error: `status ${upstream.status}` });
          continue;
        }

        const data = await upstream.json();
        const reply = provider.extract(data);
        if (!reply) { attempts.push({ name, error: 'empty reply' }); continue; }

        return json({ reply: reply.trim(), provider: name }, 200, cors);

      } catch (err) {
        console.error('proxy failure', name, err);
        attempts.push({ name, error: 'upstream failure' });
      }
    }

    // Every provider in the chain failed or was unconfigured. Non-2xx makes
    // the widget fall back to its own built-in knowledge, so this is never
    // worse than having AI turned off.
    return json({ error: 'all providers failed', attempts }, 502, cors);
  }
};

// Ordered list of provider names to try. PROVIDER_CHAIN (comma-separated)
// takes priority; falls back to the single legacy PROVIDER for anyone still
// using the original one-provider setup.
function resolveChain(env) {
  if (env.PROVIDER_CHAIN) {
    return env.PROVIDER_CHAIN.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  return env.PROVIDER ? [env.PROVIDER.toLowerCase()] : ['openai'];
}

// Prefers a provider-specific key (OPENAI_API_KEY, PERPLEXITY_API_KEY,
// ANTHROPIC_API_KEY) so a PROVIDER_CHAIN can hold one key per provider, but
// still honours a single API_KEY for anyone using the legacy one-provider setup.
function keyFor(name, env) {
  return env[name.toUpperCase() + '_API_KEY'] || env.API_KEY || '';
}

// Prefers a provider-specific model override, falls back to the legacy MODEL
// variable only when there is just one provider configured (a global MODEL
// name is not valid across different providers), then the provider's default.
function modelFor(name, env, chainLength, defaultModel) {
  return env[name.toUpperCase() + '_MODEL'] || (chainLength === 1 ? env.MODEL : '') || defaultModel;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}
