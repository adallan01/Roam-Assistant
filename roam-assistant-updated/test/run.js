const { makeDom, say, lastBubbleText, allBotHtml, cartBadge } = require('./harness');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? '\n   -> ' + extra : ''); }
}

async function fresh() { return makeDom(); }

const tests = [];

// 1. Single part price lookup shows a card with all three figures
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is a brake pedal assembly?');
  const html = allBotHtml(w);
  check('1. brake pedal card shows name', html.includes('Brake Pedal Assembly'), html);
  check('1. brake pedal card shows part price', html.includes('1,508'));
  check('1. brake pedal card shows total', html.includes('1,608'));
  check('1. has add-to-cart button', html.includes('data-add-part='));
});

// 2. Add via typed command after a lookup
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is a brake pedal assembly?');
  say(w, 'Add it to my Roam Cart.');
  check('2. badge shows 1', cartBadge(w) === '1', cartBadge(w));
  check('2. confirmation text', lastBubbleText(w).includes('added to your Roam Cart'), lastBubbleText(w));
});

// 3. Quantity follow-up "I need three."
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is a brake pedal assembly?');
  say(w, 'Add it to my Roam Cart.');
  say(w, 'I need three.');
  check('3. badge shows 3', cartBadge(w) === '3', cartBadge(w));
});

// 4. Multi-part request -> checklist, then add selected
tests.push(async function () {
  const w = await fresh();
  say(w, 'I need a brake cable, a rear shock and a tyre.');
  let html = allBotHtml(w);
  check('4. checklist rendered', html.includes('data-checklist'), html);
  check('4. all three named', html.includes('Front Brake Cable Assy') && html.includes('Rear Shock Absorber') && html.includes('Front Tyre'));
  const btn = w.document.querySelector('[data-add-selected]');
  check('4. add-selected button exists', !!btn);
  if (btn) btn.click();
  check('4. badge shows 3 after adding selected', cartBadge(w) === '3', cartBadge(w));
});

// 5. Remove a named item from the cart
tests.push(async function () {
  const w = await fresh();
  say(w, 'I need a brake cable, a rear shock and a tyre.');
  w.document.querySelector('[data-add-selected]').click();
  say(w, 'Remove the tyre.');
  check('5. badge shows 2 after removal', cartBadge(w) === '2', cartBadge(w));
  check('5. removal confirmation', lastBubbleText(w).toLowerCase().includes('removed'), lastBubbleText(w));
});

// 6. Total / cart view
tests.push(async function () {
  const w = await fresh();
  say(w, 'Add a brake pedal.');
  say(w, 'How much is everything?');
  const html = allBotHtml(w);
  check('6. cart drawer with total shown', html.includes('rai-cart-totals') && html.includes('Total'), html);
});

// 7. Quote request shows cart + form fields
tests.push(async function () {
  const w = await fresh();
  say(w, 'Add a brake pedal.');
  say(w, 'Give me a quote.');
  const html = allBotHtml(w);
  check('7. quote form rendered', html.includes('rai-pq-name') && html.includes('rai-pq-phone') && html.includes('rai-pq-location'), html);
  check('7. cart drawer also shown with quote', html.includes('rai-cart-drawer'));
});

// 8. WhatsApp cart handoff link is generated with contents
tests.push(async function () {
  const w = await fresh();
  say(w, 'Add a brake pedal.');
  say(w, 'Show my cart.');
  const html = allBotHtml(w);
  check('8. whatsapp link present', /https:\/\/wa\.me\/254740666555\?text=/.test(html), html);
  check('8. whatsapp button label', html.includes('Send Roam Cart on WhatsApp'));
});

// 9. Part number lookup
tests.push(async function () {
  const w = await fresh();
  say(w, 'What is 10000333.A1?');
  const html = allBotHtml(w);
  check('9. part number resolves to Headlight Assembly', html.includes('Headlight Assembly'), html);
});

// 10. Unknown charger amperage is refused by name, not invented
tests.push(async function () {
  const w = await fresh();
  say(w, 'Do you have a 20A charger?');
  const t = lastBubbleText(w);
  check('10. refuses unknown amp', t.includes("don't do a 20A charger"), t);
  check('10. offers real options', t.includes('6 Amp') && t.includes('10 Amp'));
});

// 11. Compatibility guard
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is a brake pedal assembly?');
  say(w, 'Will this fit my Gen 3?');
  const t = lastBubbleText(w);
  check('11. compatibility guard fires', t.includes("don't have verified compatibility"), t);
});

// 12. Stock guard
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is a brake pedal assembly?');
  say(w, 'Do you have this part in stock?');
  const t = lastBubbleText(w);
  check('12. stock guard fires', t.includes('Roam parts catalogue') && t.includes('confirmed by the Roam team'), t);
});

// 13. Ambiguous headlight complaint in mixed Sheng/English still offers choices, never guesses
tests.push(async function () {
  const w = await fresh();
  say(w, 'Headlight imeharibika, naeza pata mpya how much?');
  const t = lastBubbleText(w);
  check('13. lists options rather than guessing', t.includes('Which one'), t);
});

// 14. Swahili "Nataka brake cable mbili." (word-order quantity)
tests.push(async function () {
  const w = await fresh();
  say(w, 'Nataka brake cable mbili.');
  check('14. badge shows 2', cartBadge(w) === '2', cartBadge(w));
  check('14. confirms brake cable added', lastBubbleText(w).includes('Front Brake Cable'), lastBubbleText(w));
});

// 15. "Niongezee moja." adds one more of the last part discussed
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is a brake pedal assembly?');
  say(w, 'Niongezee moja.');
  check('15. badge shows 1', cartBadge(w) === '1', cartBadge(w));
});

// 16. Named-item quantity update: "Make the brake pedals three."
tests.push(async function () {
  const w = await fresh();
  say(w, 'Add a brake pedal.');
  say(w, 'Add a headlight assembly.');
  say(w, 'Make the brake pedals three.');
  check('16. update text confirms qty 3', lastBubbleText(w).includes('is now 3'), lastBubbleText(w));
  check('16. badge shows 4 total (3+1)', cartBadge(w) === '4', cartBadge(w));
});

// 17. Ambiguous "charger" price question lists both, does not guess
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is a charger?');
  const t = lastBubbleText(w);
  check('17. lists both chargers', t.includes('5,800') && t.includes('12,180'), t);
  check('17. asks which one', t.includes('Which one'));
});

// 18. Service price lookup
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is battery assessment?');
  const t = lastBubbleText(w);
  check('18. battery assessment price', t.includes('Battery Assessment') && t.includes('1,000'), t);
});

// 19. Generic "Roam Parts" entry point opens the browsable catalogue
tests.push(async function () {
  const w = await fresh();
  say(w, 'spare parts');
  const html = allBotHtml(w);
  check('19. roam parts intro shown', html.includes('Roam Parts'), html);
  check('19. catalogue panel rendered', html.includes('data-catalogue'));
  check('19. search box present', html.includes('rai-cat-q'));
  check('19. shelves present', html.includes('Brakes') && html.includes('Battery &amp; Charging'));
});

// 20. My Parts List: save then view
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much is a brake pedal assembly?');
  say(w, 'Save it for later.');
  check('20. save confirmation', lastBubbleText(w).includes('saved to your My Parts List'), lastBubbleText(w));
  say(w, 'Show my parts list.');
  check('20. saved item listed', lastBubbleText(w).includes('Brake Pedal Assembly'), lastBubbleText(w));
});

// 21. Vague braking complaint clarifies instead of guessing
tests.push(async function () {
  const w = await fresh();
  say(w, 'My bike doesn\'t stop well.');
  const t = lastBubbleText(w);
  check('21. asks front/rear/both', t.includes('front brake') && t.includes('rear brake'), t);
});

// 22. Cart persists across unrelated turns and totals correctly
tests.push(async function () {
  const w = await fresh();
  say(w, 'Add a brake pedal.');
  say(w, 'What about a new headlight?'); // ambiguous, should not silently add
  say(w, 'Add the headlight assembly.');
  check('22. badge shows 2', cartBadge(w) === '2', cartBadge(w));
});

// 23. Clear cart
tests.push(async function () {
  const w = await fresh();
  say(w, 'Add a brake pedal.');
  say(w, 'Clear my cart.');
  check('23. badge shows 0', cartBadge(w) === '0' || w.document.getElementById('rai-cart-badge').classList.contains('zero'), cartBadge(w));
});

(async () => {
  for (const t of tests) { await t(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
