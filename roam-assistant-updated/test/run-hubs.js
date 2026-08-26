// The Roam Hub finder: the location database, the intent engine and the cards.
// Every case here comes from Roam's location brief.
const { makeDom, say, lastBubbleText, allBotHtml, click, type } = require('./harness');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? '\n   -> ' + extra : ''); }
}

const tests = [];
const fresh = () => makeDom();
const cards = (w) => Array.from(w.document.querySelectorAll('.rai-hub-card'));
// The finder shows four and offers the rest behind one tap.
const showAll = (w) => { const b = w.document.querySelector('[data-hub-more]'); if (b) b.click(); };
const names = (w) => cards(w).map((c) => c.querySelector('.rai-hub-name').textContent);

// --- the finder as an entry point ------------------------------------------

tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-hubs]');
  const html = allBotHtml(w);
  check('home: finder opens', html.includes('data-hubfinder'), html.slice(-400));
  check('finder: three region tabs plus all',
    ['near', 'nairobi', 'outside', 'all'].every((r) => html.includes('data-hub-region="' + r + '"')));
  check('finder: four service filters',
    ['ch', 're', 'as', 'sh'].every((k) => html.includes('data-hub-filter="' + k + '"')));
  check('finder: search box', html.includes('rai-hub-q'));
  check('finder: says how many locations', /1[0-9] Roam locations/.test(html), html.slice(-600));
  check('finder: caps the first view and offers the rest', html.includes('data-hub-more'));
});

// Every card is actionable: a real map link for the station's own coordinates.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-hubs]');
  const maps = Array.from(w.document.querySelectorAll('.rai-hub-act.map'));
  check('cards: every card has a maps link', maps.length === cards(w).length && maps.length > 0);
  check('cards: links are google maps queries',
    maps.every((a) => /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=-?\d/.test(a.href)),
    maps[0] && maps[0].href);
  check('cards: links are all different', new Set(maps.map((a) => a.href)).size === maps.length);
});

// Region tabs and service filters narrow the same panel in place.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-hubs]');
  const before = w.document.querySelectorAll('#rai-messages .rai-row').length;
  click(w, '[data-hub-region="outside"]');
  showAll(w);
  const outside = names(w);
  check('finder: outside Nairobi is five stations', outside.length === 5, outside.join(' | '));
  check('finder: Homabay is one of them', outside.some((n) => n.includes('Homabay')));
  check('finder: Kayole is not', !outside.some((n) => n.includes('Kayole')));
  check('finder: panel replaced, thread not pushed down',
    w.document.querySelectorAll('#rai-messages .rai-row').length === before);
  click(w, '[data-hub-filter="as"]');
  showAll(w);
  check('finder: after-sales filter narrows further',
    names(w).every((n) => /Thika Centre|Machakos Centre|Homabay/.test(n)), names(w).join(' | '));
});

// Search runs over station, area and partner.
tests.push(async function () {
  const w = await fresh();
  click(w, '[data-open-hubs]');
  type(w, '#rai-hub-q', 'total');
  check('finder search: partner name finds the TotalEnergies sites',
    w.document.querySelector('.rai-cat-count').textContent.includes('6 Roam locations'),
    w.document.querySelector('.rai-cat-count').textContent);
  type(w, '#rai-hub-q', 'kayole');
  check('finder search: station name finds one', names(w).length === 1 && names(w)[0].includes('Kayole'));
  type(w, '#rai-hub-q', 'zzz');
  check('finder search: empty state explains itself',
    allBotHtml(w).includes('No Roam location in my current data matches'));
});

// --- the brief's own test cases --------------------------------------------

// Basic: where can I charge?
tests.push(async function () {
  const w = await fresh();
  say(w, 'Where can I charge?');
  const html = allBotHtml(w);
  check('brief/basic: finder returned, not a paragraph', html.includes('data-hubfinder'), lastBubbleText(w));
  check('brief/basic: counts the charging locations',
    /16 Roam locations list charging/.test(lastBubbleText(w)), lastBubbleText(w));
  check('brief/basic: charging filter is on', html.includes('data-hub-filter="ch" class') ||
    /class="rai-hub-filt on" data-hub-filter="ch"/.test(html) || html.includes('rai-hub-filt on'));
});

// Specific: can I charge at Kayole?
tests.push(async function () {
  const w = await fresh();
  say(w, 'Can I charge at Kayole?');
  const t = lastBubbleText(w);
  check('brief/specific: answered from that station', /Yes\. Roam Hub – Kayole is listed as offering charging\./.test(t), t);
  check('brief/specific: one card, the right one', names(w).length === 1 && names(w)[0].includes('Kayole'), names(w).join());
});

// A service the station does not list is refused, and never borrowed.
tests.push(async function () {
  const w = await fresh();
  say(w, 'Can I service my bike at Roysambu?');
  const t = lastBubbleText(w);
  check('station service: refused for that station',
    /after-sales is not listed for Roam Hub – Roysambu/i.test(t), t);
  check('station service: not borrowed from another hub', !/Yes/.test(t.split('.')[0]), t);
  check('station service: points at the closest one that does list it',
    /closest listed one is Roam Hub –/.test(t), t);
});

// Rental
tests.push(async function () {
  const w = await fresh();
  say(w, 'Where can I rent a battery?');
  check('brief/rental: rental locations listed', /Roam locations list battery rental/.test(lastBubbleText(w)), lastBubbleText(w));
  check('brief/rental: finder shown', allBotHtml(w).includes('data-hubfinder'));
});

// After-sales
tests.push(async function () {
  const w = await fresh();
  say(w, 'Where can I service my Roam?');
  const t = lastBubbleText(w);
  check('brief/after-sales: after-sales locations listed', /list.{0,3} after-sales/.test(t), t);
  check('brief/after-sales: nine of them', /^9 Roam locations/.test(t), t);
});

// Shop
tests.push(async function () {
  const w = await fresh();
  say(w, 'Where can I buy parts?');
  const t = lastBubbleText(w);
  check('brief/shop: shop locations listed', /a shop/.test(t), t);
  check('brief/shop: not answered with the parts catalogue', !allBotHtml(w).includes('data-catalogue'), t);
});

// Shop and after-sales are not the same field.
tests.push(async function () {
  const w = await fresh();
  say(w, 'Which hubs have a shop?');
  showAll(w);
  const shops = names(w);
  check('shop != after-sales: Wetu Homabay has a shop', shops.some((n) => n.includes('Homabay')), shops.join(' | '));
  check('shop != after-sales: Outering does not', !shops.some((n) => n.includes('Outering')), shops.join(' | '));
});

// Partner
tests.push(async function () {
  const w = await fresh();
  say(w, 'Which TotalEnergies stations have Roam?');
  const t = lastBubbleText(w);
  check('brief/partner: counted', /6 Roam locations hosted by TotalEnergies/.test(t), t);
  const got = names(w);
  check('brief/partner: all six shown', got.length === 6, got.join(' | '));
  check('brief/partner: only TotalEnergies sites',
    !got.some((n) => /Kayole|Roysambu|Forest Road|Ojijo|Langata/.test(n)), got.join(' | '));
});

// Phone
tests.push(async function () {
  const w = await fresh();
  say(w, "What's the number for Outering?");
  const t = lastBubbleText(w);
  check('brief/phone: the station\'s own number', t.includes('+254 723 655 007'), t);
  check('brief/phone: not another hub\'s', !t.includes('721 461 560'), t);
  check('brief/phone: tap to call', allBotHtml(w).includes('href="tel:+254723655007"'));
});

// A station with no number says so rather than substituting the support line.
tests.push(async function () {
  const w = await fresh();
  say(w, 'Give me the number for Langata.');
  const t = lastBubbleText(w);
  check('phone: missing number admitted', /do not have a confirmed phone number/.test(t), t);
  check('phone: support offered as the fallback, clearly labelled', /customer support is on/.test(t), t);
});

// Map
tests.push(async function () {
  const w = await fresh();
  say(w, 'Give me the location for Wayaki Way.');
  check('brief/map: the right station', names(w).length === 1 && names(w)[0].includes('Wayaki Way'), names(w).join());
  check('brief/map: its own coordinates',
    allBotHtml(w).includes('query=-1.25861,36.781386'), allBotHtml(w).slice(-500));
});

// Combination: charging AND rental
tests.push(async function () {
  const w = await fresh();
  say(w, 'Where can I charge and rent a battery?');
  const t = lastBubbleText(w);
  check('brief/combo: both services named', /charging and battery rental/.test(t), t);
  check('brief/combo: sixteen match', /^16 Roam locations/.test(t), t);
});

// Combination: charging AND after-sales
tests.push(async function () {
  const w = await fresh();
  say(w, 'Where can I charge and service my bike?');
  const t = lastBubbleText(w);
  check('brief/combo2: eight match', /^8 Roam locations/.test(t), t);
  showAll(w);
  check('brief/combo2: Homabay excluded, it lists no charging',
    !names(w).some((n) => n.includes('Homabay')), names(w).join(' | '));
});

// Area-based
tests.push(async function () {
  const w = await fresh();
  say(w, "I'm in Ruiru. Where can I charge?");
  const t = lastBubbleText(w);
  check('brief/area: ranked from Ruiru', /^Closest to Ruiru for charging: Roam Hub –/.test(t), t);
  check('brief/area: distances shown on the cards',
    w.document.querySelectorAll('.rai-hub-km').length > 0, allBotHtml(w).slice(-400));
});

// Natural Kenyan phrasing
tests.push(async function () {
  const w = await fresh();
  say(w, 'Niko Kayole, naeza charge wapi?');
  const t = lastBubbleText(w);
  check('brief/sheng: resolved to Kayole', /Roam Hub – Kayole is listed as offering charging/.test(t), t);
});

tests.push(async function () {
  const w = await fresh();
  say(w, 'Roam hub iko wapi?');
  check('swahili: hub location question reaches the finder',
    allBotHtml(w).includes('data-hubfinder'), lastBubbleText(w));
});

tests.push(async function () {
  const w = await fresh();
  say(w, 'Nipe location ya Thika Centre.');
  check('swahili: named station returned', names(w).some((n) => n.includes('Thika Centre')), names(w).join());
});

tests.push(async function () {
  const w = await fresh();
  say(w, 'Battery rental inapatikana wapi?');
  check('swahili: rental question routes to rental locations',
    /battery rental/.test(lastBubbleText(w)), lastBubbleText(w));
});

// Unknown
tests.push(async function () {
  const w = await fresh();
  say(w, 'Are you in Eldeyo Market?');
  const t = lastBubbleText(w);
  check('brief/unknown: refused by name',
    /(don't|do not) have a confirmed Roam location at Eldeyo/i.test(t), t);
  check('brief/unknown: no product fact', !/80 km|range|Roam Air is/.test(t), t);
  check('brief/unknown: asks for an area instead', /nearest area or town/.test(t), t);
});

// Spelling variation
tests.push(async function () {
  for (const q of ['Where is Waiyaki Way Roam Hub?', 'Where is Wayaki Way Roam Hub?']) {
    const w = await fresh();
    say(w, q);
    check('brief/spelling: "' + q + '" resolves to one station',
      names(w).length === 1 && names(w)[0].includes('Wayaki Way'), names(w).join());
  }
  const w = await fresh();
  say(w, "Where is Adam's Minimall hub?");
  check('brief/spelling: apostrophes survive', names(w).some((n) => n.includes("Adam's")), names(w).join());
});

// Multiple results
tests.push(async function () {
  const w = await fresh();
  say(w, 'List all Roam charging hubs.');
  showAll(w);
  check('brief/list: sixteen charging locations', names(w).length === 16, String(names(w).length));
  check('brief/list: Roam Park excluded, it lists no charging',
    !names(w).some((n) => n.includes('Roam Park')), names(w).join(' | '));
});

// Two stations answer to "Machakos", and the specific wording picks one.
tests.push(async function () {
  let w = await fresh();
  say(w, 'Is there a Roam hub in Machakos?');
  check('ambiguous town: both listed', names(w).length === 2, names(w).join(' | '));
  w = await fresh();
  say(w, 'Can I service my bike at Machakos Centre?');
  check('ambiguous town: the specific one wins',
    /Yes\. Roam Hub – Machakos Centre/.test(lastBubbleText(w)), lastBubbleText(w));
});

// Launch date, straight from the record.
tests.push(async function () {
  const w = await fresh();
  say(w, 'When did the Roam Hub at Outering launch?');
  check('launch: read from the record', /launched on 16 January 2025/.test(lastBubbleText(w)), lastBubbleText(w));
});

// --- guardrails -------------------------------------------------------------

// No live status is ever implied.
tests.push(async function () {
  const w = await fresh();
  say(w, 'Is the charger at Kayole free right now?');
  const t = lastBubbleText(w);
  check('guardrail: says listed, not available now', /is listed as offering/.test(t), t);
  check('guardrail: no live claim', !/right now|currently available|open now/i.test(t), t);
});

// A location question is never answered with a product fact.
tests.push(async function () {
  for (const q of ['Where is the nearest Roam Hub?', 'Where are your hubs?', 'Naeza charge wapi?']) {
    const w = await fresh();
    say(w, q);
    const t = lastBubbleText(w);
    check('guardrail: no product answer for "' + q + '"',
      !/80 km|range of|payload|3,000W|Eco, Standard/.test(t), t);
    check('guardrail: "' + q + '" reaches the location data',
      allBotHtml(w).includes('data-hubfinder') || allBotHtml(w).includes('rai-hub-card'), t);
  }
});

// "Nearest" with nothing to measure from asks, rather than picking one.
tests.push(async function () {
  const w = await fresh();
  say(w, 'Which charging station is closest to me?');
  const t = lastBubbleText(w);
  check('guardrail: asks for the area', /what area are you in/i.test(t), t);
  check('guardrail: never names one as nearest', !/closest is|nearest is/i.test(t), t);
});

// A town far from every station is told the truth about the distance.
tests.push(async function () {
  const w = await fresh();
  say(w, "I'm in Mombasa, where can I charge?");
  const t = lastBubbleText(w);
  check('far town: no location claimed', /do not have a Roam location listed near Mombasa/.test(t), t);
  check('far town: distance stated honestly', /roughly \d{3} km away/.test(t), t);
});

// Container is operational data, not volunteered.
tests.push(async function () {
  const w = await fresh();
  say(w, 'Can I charge at Outering?');
  check('container: not volunteered', !/[Cc]ontainer/.test(allBotHtml(w)), lastBubbleText(w));
  const w2 = await fresh();
  say(w2, 'Is Outering a container site?');
  check('container: answered when asked', /container site/.test(lastBubbleText(w2)), lastBubbleText(w2));
});

// Charging cost and home charging are still charging questions, not locations.
tests.push(async function () {
  const w = await fresh();
  say(w, 'How much does charging cost?');
  check('boundary: cost question not hijacked', !allBotHtml(w).includes('data-hubfinder'), lastBubbleText(w));
  const w2 = await fresh();
  say(w2, 'Can I charge at home?');
  check('boundary: home charging not hijacked', !allBotHtml(w2).includes('data-hubfinder'), lastBubbleText(w2));
  const w3 = await fresh();
  say(w3, 'Where can I buy a Roam Air?');
  check('boundary: buying a bike is not a parts shop',
    !allBotHtml(w3).includes('data-hubfinder'), lastBubbleText(w3));
  const w4 = await fresh();
  say(w4, 'How much is a brake pedal assembly?');
  check('boundary: part price still a part price',
    allBotHtml(w4).includes('rai-part-card'), lastBubbleText(w4));
});

// --- "do you have X?" ------------------------------------------------------
// A plain yes-or-no about a service, with no place in it. This used to fall
// through to the escalation even though the answer is an unambiguous yes.

tests.push(async function () {
  const w = await fresh();
  for (const q of ['are you having aftersales', 'do you have after sales?',
                   'Do you offer servicing?', 'do you do repairs?',
                   'Mna after sales?', 'Do you service Roam Air?']) {
    const x = await fresh();
    say(x, q);
    const t = lastBubbleText(x);
    check('offer: "' + q + '" answers yes', t.startsWith('Yes, Roam has after-sales.'), t);
    check('offer: "' + q + '" shows where', cards(x).length > 0, t);
    check('offer: "' + q + '" never escalates', !/don't have a confirmed|WhatsApp or call/i.test(t), t);
  }
});

tests.push(async function () {
  for (const [q, phrase] of [['do you have charging?', 'charging'],
                             ['Kuna charging?', 'charging'],
                             ['Is there battery rental?', 'battery rental'],
                             ['Do you have shops?', 'parts shops']]) {
    const x = await fresh();
    say(x, q);
    check('offer: "' + q + '" names the service',
      lastBubbleText(x).startsWith('Yes, Roam has ' + phrase + '.'), lastBubbleText(x));
    check('offer: "' + q + '" shows cards', cards(x).length > 0);
  }
});

// The yes-or-no branch must not swallow product questions that happen to
// start "do you have".
tests.push(async function () {
  const w = await fresh();
  say(w, 'Do you have a 20A charger?');
  check('offer: unstocked charger still refused by name',
    lastBubbleText(w).includes("don't do a 20A charger"), lastBubbleText(w));
  const w2 = await fresh();
  say(w2, 'How much is a brake pedal assembly?');
  say(w2, 'Do you have this part in stock?');
  check('offer: stock guard still fires',
    lastBubbleText(w2).includes('confirmed by the Roam team'), lastBubbleText(w2));
  const w3 = await fresh();
  say(w3, 'Do you have financing?');
  check('offer: financing is not a location answer',
    !allBotHtml(w3).includes('data-hubfinder'), lastBubbleText(w3));
});

(async () => {
  for (const t of tests) await t();
  console.log('\n' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
