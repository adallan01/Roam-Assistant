// Minimal jsdom harness for exercising the Roam Assistant widget headlessly.
// Not part of the shipped product: a throwaway regression tool.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

function makeDom(config) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://example.com/',
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });
  const { window } = dom;

  // Stubs the widget expects but jsdom does not fully provide.
  window.fetch = () => Promise.reject(new Error('no network in test'));
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  window.visualViewport = undefined;
  window.navigator.sendBeacon = () => false;
  const store = {};
  window.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  // typingMs:0 removes the human typing pause so assertions can run straight
  // after say(). Pass a config to exercise the paced behaviour instead.
  window.RoamAssistantConfig = Object.assign({ typingMs: 0 }, config || {});

  const src = fs.readFileSync(path.join(__dirname, '..', 'roam-assistant.js'), 'utf8');

  return new Promise((resolve) => {
    window.document.addEventListener('DOMContentLoaded', function () {
      // readyState is no longer "loading" once this fires, so the widget's
      // own boot() call happens synchronously as soon as the script runs.
      const scriptEl = window.document.createElement('script');
      scriptEl.textContent = src;
      window.document.body.appendChild(scriptEl);
      window.RoamAssistant.open();
      resolve(window);
    });
  });
}

function lastBubbleText(win) {
  const rows = win.document.querySelectorAll('#rai-messages .rai-row.bot .rai-bubble');
  if (!rows.length) return '';
  return rows[rows.length - 1].textContent.trim();
}

function allBotHtml(win) {
  return Array.from(win.document.querySelectorAll('#rai-messages .rai-row.bot'))
    .map((r) => r.innerHTML).join('\n---\n');
}

function say(win, text) {
  const input = win.document.getElementById('rai-input');
  input.value = text;
  win.document.getElementById('rai-send').click();
}

function cartBadge(win) {
  return win.document.getElementById('rai-cart-badge').textContent.trim();
}

function click(win, selector) {
  const el = win.document.querySelector(selector);
  if (!el) throw new Error('no element matching ' + selector);
  el.click();
  return el;
}

function type(win, selector, value) {
  const el = win.document.querySelector(selector);
  if (!el) throw new Error('no element matching ' + selector);
  el.value = value;
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { makeDom, say, lastBubbleText, allBotHtml, cartBadge, click, type, wait };
