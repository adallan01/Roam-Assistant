// Home screen, browsable parts catalogue, and the human pacing of replies.
const { makeDom, say, lastBubbleText, allBotHtml, cartBadge, click, type, wait } = require('./harness');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? '\n   -> ' + extra : ''); }
}

const tests = [];
const fresh = (cfg) => makeDom(cfg);

// --- Home screen -----------------------------------------------------------

tests.push(async function () {
  const w = await fresh();
  const html = allBotHtml(w);
  check('home: greeting present', /Good (morning|afternoon|evening), karibu Roam\./.test(html), html);
  check('home: parts button', html.includes('data-open-catalogue') && html.includes('Roam Parts'));
  check('home: hub finder button', html.includes('data-open-hubs') && html.includes('Find a Roam Hub'));
  check('home: calculator button links out', html.includes('roamfinancecalculator.vercel.app'));
  check('home: test ride button links out', html.includes('book-a-test-ride.vercel.app'));
  check('home: part count is not a hard number', html.includes('Browse over 100 genuine parts'));
  check('home: suggestion chips still there', html.includes('rai-chip'));
});

// Tapping Roam Parts opens the catalogue in the chat.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  const html = allBotHtml(w);
  check('home: parts button opens catalogue', html.includes('data-catalogue'), html);
  check('home: catalogue has a search box', html.includes('rai-cat-q'));
});

// The home actions clear once the rider starts typing, so they do not linger.
tests.push(async function () {
  const w = await fresh();
  say(w, 'What does the Roam Air cost?');
  check('home: actions removed after first question',
    !w.document.querySelector('.rai-home'), allBotHtml(w).slice(0, 300));
});

// --- Catalogue -------------------------------------------------------------

tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  const groups = w.document.querySelectorAll('.rai-cat-group');
  const rows = w.document.querySelectorAll('.rai-cat-row');
  check('catalogue: every part listed', rows.length === 112, String(rows.length));
  check('catalogue: ten shelves', groups.length === 10, String(groups.length));
  check('catalogue: first shelf open by default', groups[0].classList.contains('open'));
  check('catalogue: later shelves closed', !groups[1].classList.contains('open'));
  check('catalogue: count line', allBotHtml(w).includes('Over 100 parts in the Roam catalogue'));
});

// Every catalogue row carries a working add button keyed to a real part.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  const adds = w.document.querySelectorAll('.rai-cat-row [data-add-part]');
  check('catalogue: every row has an add button', adds.length === 112, String(adds.length));
  const ids = Array.from(adds).map((b) => b.getAttribute('data-add-part'));
  check('catalogue: no blank part ids', ids.every((i) => i && i.length > 2));
  check('catalogue: ids unique', new Set(ids).size === ids.length);
});

// Shelf accordion opens and closes.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  const groups = w.document.querySelectorAll('.rai-cat-group');
  groups[1].querySelector('[data-cat-toggle]').click();
  check('catalogue: shelf opens on tap', groups[1].classList.contains('open'));
  groups[1].querySelector('[data-cat-toggle]').click();
  check('catalogue: shelf closes again', !groups[1].classList.contains('open'));
});

// Adding from the catalogue goes to the cart without spamming the thread.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  const before = w.document.querySelectorAll('#rai-messages .rai-row').length;
  w.document.querySelector('.rai-cat-row [data-add-part]').click();
  check('catalogue: badge increments', cartBadge(w) === '1', cartBadge(w));
  check('catalogue: button marks itself added',
    w.document.querySelector('.rai-cat-row [data-add-part]').classList.contains('added'));
  check('catalogue: thread not pushed down',
    w.document.querySelectorAll('#rai-messages .rai-row').length === before);
});

// Several parts added in a row all land in one cart.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  const adds = w.document.querySelectorAll('.rai-cat-row [data-add-part]');
  adds[0].click(); adds[1].click(); adds[2].click();
  check('catalogue: three adds give badge 3', cartBadge(w) === '3', cartBadge(w));
  say(w, 'Show my cart.');
  const html = allBotHtml(w);
  check('catalogue: all three in the cart drawer',
    (html.match(/data-cart-remove=/g) || []).length === 3, html.slice(-900));
});

// Search filters across shelves and keeps them open.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  type(w, '#rai-cat-q', 'brake');
  const rows = w.document.querySelectorAll('.rai-cat-row');
  check('search: narrows the list', rows.length > 0 && rows.length < 112, String(rows.length));
  const names = Array.from(rows).map((r) => r.textContent.toLowerCase());
  check('search: every hit matches', names.every((n) => n.includes('brake')));
  check('search: matching shelves open',
    Array.from(w.document.querySelectorAll('.rai-cat-group')).every((g) => g.classList.contains('open')));
  check('search: term kept in the box', w.document.querySelector('#rai-cat-q').value === 'brake');
});

// Search by part number.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  type(w, '#rai-cat-q', '10000333');
  const rows = w.document.querySelectorAll('.rai-cat-row');
  check('search: part number finds one row', rows.length === 1, String(rows.length));
  check('search: it is the headlight', rows[0] && rows[0].textContent.includes('Headlight Assembly'));
});

// A search with no hits explains itself rather than showing an empty panel.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  type(w, '#rai-cat-q', 'windscreen wiper');
  check('search: empty state shown', allBotHtml(w).includes('Nothing in the catalogue matches'),
    allBotHtml(w).slice(-400));
  check('search: no rows', w.document.querySelectorAll('.rai-cat-row').length === 0);
});

// Adding from a filtered catalogue still resolves the right part.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  type(w, '#rai-cat-q', '10000333');
  w.document.querySelector('.rai-cat-row [data-add-part]').click();
  say(w, 'Show my cart.');
  check('search: filtered add lands in cart', allBotHtml(w).includes('Headlight Assembly'), cartBadge(w));
  check('search: badge is 1', cartBadge(w) === '1', cartBadge(w));
});

// The one catalogue row with no part number is still usable.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  type(w, '#rai-cat-q', 'shaft replacement');
  const row = w.document.querySelector('.rai-cat-row');
  check('numberless part: listed', !!row && row.textContent.includes('Shaft Replacement'));
  check('numberless part: labelled, not blank', !!row && row.textContent.includes('No part number'));
  row.querySelector('[data-add-part]').click();
  check('numberless part: adds to cart', cartBadge(w) === '1', cartBadge(w));
  say(w, 'Give me a quote.');
  check('numberless part: quote has no empty brackets', !lastBubbleText(w).includes('()'), lastBubbleText(w));
});

// --- Human pacing ----------------------------------------------------------

// With pacing on, the answer arrives behind typing dots rather than instantly.
tests.push(async function () {
  const w = await fresh({ typingMs: 120 });
  say(w, 'How much is a brake pedal assembly?');
  check('pacing: typing dots shown first', !!w.document.querySelector('.rai-typing'), allBotHtml(w));
  check('pacing: answer withheld', !allBotHtml(w).includes('rai-part-card'));
  await wait(400);
  check('pacing: dots cleared', !w.document.querySelector('.rai-typing'));
  check('pacing: answer arrives', allBotHtml(w).includes('rai-part-card'), allBotHtml(w).slice(-400));
});

// Cards follow the words rather than landing ahead of them.
tests.push(async function () {
  const w = await fresh({ typingMs: 60 });
  say(w, 'How much is a brake pedal assembly?');
  await wait(300);
  const rows = Array.from(w.document.querySelectorAll('#rai-messages .rai-row'));
  const bubbleAt = rows.findIndex((r) => r.querySelector('.rai-bubble') && r.classList.contains('bot')
    && r.textContent.includes('Here is the one you want'));
  const cardAt = rows.findIndex((r) => r.querySelector('.rai-part-card'));
  check('pacing: words before the card', bubbleAt > -1 && cardAt > bubbleAt, bubbleAt + ' / ' + cardAt);
});

// Confirmations vary instead of repeating one canned receipt.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-catalogue]');
  // Part cards (not catalogue rows) carry the spoken confirmation.
  say(w, 'How much is a brake pedal assembly?');
  w.document.querySelector('.rai-part-card [data-add-part]').click();
  const first = lastBubbleText(w);
  say(w, 'How much is a headlight assembly?');
  w.document.querySelectorAll('.rai-part-card [data-add-part]')[1].click();
  const second = lastBubbleText(w);
  check('pacing: confirmations differ', first.split(' ')[0] !== second.split(' ')[0], first + ' | ' + second);
  check('pacing: both confirm the cart',
    first.includes('Roam Cart') && second.includes('Roam Cart'), first + ' | ' + second);
});

// --- Tone -----------------------------------------------------------------

// A price question gets a plain answer, not a compliance sentence.
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is a brake pedal assembly?');
  const t = lastBubbleText(w);
  check('tone: leads with the price, plainly', /Here is the one you want/.test(t), t);
  check('tone: no catalogue-period disclaimer', !/Q3 to Q4 2025/.test(t), t);
  check('tone: no draft-estimate hedging', !/draft estimate/i.test(t), t);
});

// A rider who says something is broken gets a word of sympathy first.
tests.push(async function () {
  const w = await fresh();
  say(w, 'My rear shock imeharibika, how much?');
  check('tone: sympathy on a breakage', lastBubbleText(w).startsWith('Pole about that.'), lastBubbleText(w));
});

// Nothing anywhere still carries the disclaimer the brief ruled out.
tests.push(async function () {
  const w = await fresh();
  for (const q of ['How much is a headlight assembly?', 'Add a brake pedal assembly.',
                   'How much is battery assessment?', 'Give me a quote.']) {
    say(w, q);
    const t = lastBubbleText(w);
    check('tone: clean answer for "' + q + '"', !/Q3 to Q4 2025|draft estimate/i.test(t), t);
  }
});

(async () => {
  for (const t of tests) await t();
  console.log('\n' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
