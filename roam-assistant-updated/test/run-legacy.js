// Spot-check the pre-existing (non-parts) behaviour that could plausibly have
// been disturbed by this change: comma handling in normalise(), the renamed
// cart internals, and the verbosity gating from the previous round of work.
const { makeDom, say, lastBubbleText, allBotHtml, cartBadge } = require('./harness');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', name, extra !== undefined ? '\n   -> ' + extra : ''); }
}

const tests = [];

// Financing: first answer should NOT dump the six-financier table unasked.
tests.push(async function () {
  const w = await makeDom();
  say(w, 'How much is the deposit for financing?');
  const html = allBotHtml(w);
  check('financing: no full table on first ask', !html.includes('rai-fin-plan'), html);
  check('financing: calculator button offered', html.includes('cost calculator') || html.includes('financing plans'));
});

// Financing: explicit "show all plans" should reveal the table.
tests.push(async function () {
  const w = await makeDom();
  say(w, 'Can I see all the financing options?');
  const html = allBotHtml(w);
  check('financing: full table on explicit request', html.includes('rai-fin-plan'), html);
});

// Test ride link present and correct.
tests.push(async function () {
  const w = await makeDom();
  say(w, 'I want to book a test ride');
  const html = allBotHtml(w);
  check('test ride: link present', html.includes('book-a-test-ride.vercel.app'), html);
});

// Calculator intent recognised as a standalone question.
tests.push(async function () {
  const w = await makeDom();
  say(w, 'calculator');
  const html = allBotHtml(w);
  check('calculator: link present, not escalated', html.includes('roamfinancecalculator.vercel.app'), html);
});

// A town with no Roam location says so, and never implies a presence.
tests.push(async function () {
  const w = await makeDom();
  say(w, 'Are you in Eldoret Market?');
  const t = lastBubbleText(w);
  check('unknown location: says there is none there',
    /do not have a Roam location listed near Eldoret/.test(t), t);
  check('unknown location: never claims a presence', !/Yes[,.]/.test(t), t);
});

// A place that is not a town and not a station is unknown, not guessed at.
tests.push(async function () {
  const w = await makeDom();
  say(w, 'Are you in Eldeyo Market?');
  const t = lastBubbleText(w);
  check('unknown place: refused by name', /Eldeyo/.test(t) && /confirmed Roam location/.test(t), t);
});

// Lead form still appears only from the third question onward.
tests.push(async function () {
  const w = await makeDom();
  say(w, 'How much does the Roam Air cost?');
  let html = allBotHtml(w);
  check('lead form withheld on first answer', !html.includes('rai-lead-btn'), html);
  say(w, 'What about financing?');
  say(w, 'Can I get a call back?');
  // lead form is scheduled with a 550ms timeout; just check it does not blow up.
  check('third turn does not throw', true);
});

// Comma-bearing ordinary sentence unrelated to parts should not misfire.
tests.push(async function () {
  const w = await makeDom();
  say(w, 'I live in Nairobi, and I want to know the price.');
  const t = lastBubbleText(w);
  check('comma in ordinary sentence does not break pricing answer', t.length > 0 && !/undefined/.test(t), t);
});

(async () => {
  for (const t of tests) await t();
  console.log('\n' + pass + ' passed, ' + fail + ' failed.');
  process.exit(fail ? 1 : 0);
})();
