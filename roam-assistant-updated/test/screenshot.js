// Drives the built preview page in a real browser and captures the key
// screens, on desktop and on a phone-sized viewport.
const { chromium } = require('playwright');
const path = require('path');

const PAGE = 'file://' + path.join(__dirname, '..', 'roam-assistant-preview.html');
const OUT = process.env.SHOT_DIR || '/tmp';

async function session(browser, width, height, tag) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(PAGE);
  await page.click('#rai-launch');
  await page.waitForTimeout(1100);   // let the paced home screen finish landing
  return {
    page,
    shot: async (name, full) => page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: !!full }),
    ask: async (text) => {
      await page.fill('#rai-input', text);
      await page.click('#rai-send');
      await page.waitForTimeout(2200);
    }
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // ---- desktop ----
  let s = await session(browser, 520, 860, 'desk');
  await s.shot('1-home');

  await s.page.click('[data-open-catalogue]');
  await s.page.waitForTimeout(700);
  await s.shot('2-catalogue');

  await s.page.fill('#rai-cat-q', 'brake');
  await s.page.waitForTimeout(400);
  await s.shot('3-catalogue-search');

  const adds = await s.page.$$('.rai-cat-row [data-add-part]');
  await adds[0].click();
  await adds[1].click();
  await s.page.waitForTimeout(300);
  await s.shot('4-catalogue-added');

  await s.page.click('#rai-cart-btn');
  await s.page.waitForTimeout(600);
  await s.shot('5-cart');
  await s.page.close();

  // ---- a conversation, to show the pacing and tone ----
  s = await session(browser, 520, 860, 'desk');
  await s.ask('Habari, my rear shock imeharibika. Bei ngapi?');
  await s.shot('6-conversation');
  await s.page.close();

  // ---- mobile ----
  s = await session(browser, 390, 780, 'mob');
  await s.shot('1-home');
  await s.page.click('[data-open-catalogue]');
  await s.page.waitForTimeout(700);
  await s.shot('2-catalogue');
  await s.page.close();

  await browser.close();
  console.log('screenshots written to ' + OUT);
})();
