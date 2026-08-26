/**
 * ROAM ASSISTANT: LEAD CAPTURE BACKEND
 * Receives leads from the Roam Assistant widget and appends them to this sheet.
 *
 * ── SETUP (about 10 minutes, no server required) ──────────────────────────
 *  1. Create a new Google Sheet. Name it e.g. "Roam Assistant Leads".
 *  2. Extensions → Apps Script. Delete whatever is there and paste this file.
 *  3. Click Save.
 *  4. Run → select `setupSheet` → Run. Approve the permission prompt.
 *     (Google will warn the app is unverified: Advanced → Go to project → Allow.
 *      This is normal for your own scripts.)
 *  5. Deploy → New deployment → gear icon → Web app.
 *        Description:      Roam Assistant leads
 *        Execute as:       Me
 *        Who has access:   Anyone            ← must be "Anyone", not "Anyone with Google account"
 *  6. Deploy, then copy the Web app URL. It looks like:
 *        https://script.google.com/macros/s/AKfy..../exec
 *  7. Paste that URL as `leadsEndpoint` in the widget config (see the guide).
 *
 * ── IMPORTANT ─────────────────────────────────────────────────────────────
 *  Every time you EDIT this script you must Deploy → Manage deployments →
 *  edit (pencil) → Version: New version → Deploy. Otherwise the live URL
 *  keeps running the old code. This trips up almost everyone once.
 *
 *  "Who has access: Anyone" means anyone who knows the URL can POST to it.
 *  It cannot read your sheet, it can only append rows. Keep the URL private
 *  (it is visible in your site's JS, so treat it as public-ish) and see
 *  `SHARED_SECRET` below if you want to lock it down.
 * ───────────────────────────────────────────────────────────────────────── */

var SHEET_NAME = 'Leads';

/* Optional. Leave '' to accept any POST. If you set a value here, set the
   identical value as `leadsSecret` in the widget config and only requests
   carrying it will be accepted. Reduces spam if someone finds the URL. */
var SHARED_SECRET = '';

/* Optional. Email address to alert on every new lead. Leave '' for none. */
var NOTIFY_EMAIL = '';

var HEADERS = [
  'Received At', 'Name', 'Phone', 'Email', 'Interest',
  'UTM Source', 'UTM Medium', 'UTM Campaign',
  'Page', 'Referrer', 'Conversation', 'User Agent'
];

/** Run this once from the editor to create and format the sheet. */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  sh.clear();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  var head = sh.getRange(1, 1, 1, HEADERS.length);
  head.setFontWeight('bold')
      .setBackground('#14170F')
      .setFontColor('#ED7D31')
      .setVerticalAlignment('middle');
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(1);

  // Readable column widths
  var widths = [150, 150, 130, 200, 110, 110, 110, 120, 220, 180, 420, 220];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  sh.getRange(2, 1, sh.getMaxRows() - 1, HEADERS.length).setVerticalAlignment('top');

  SpreadsheetApp.getUi().alert(
    'Sheet ready.\n\nNext: Deploy → New deployment → Web app, ' +
    'with "Execute as: Me" and "Who has access: Anyone". ' +
    'Then copy the /exec URL into the widget config.'
  );
}

/** Endpoint the widget POSTs to. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    var raw = (e && e.postData && e.postData.contents) || '{}';
    var d = JSON.parse(raw);

    if (SHARED_SECRET && d.secret !== SHARED_SECRET) {
      return json({ ok: false, error: 'unauthorised' });
    }

    // Minimum viable lead
    if (!d.phone && !d.email) {
      return json({ ok: false, error: 'no contact details' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(SHEET_NAME);
      sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sh.setFrozenRows(1);
    }

    // Received At is stamped server-side so it cannot be spoofed or skewed
    // by the visitor's device clock. Africa/Nairobi.
    var received = Utilities.formatDate(new Date(), 'Africa/Nairobi', 'yyyy-MM-dd HH:mm:ss');

    sh.appendRow([
      received,
      d.name || '',
      // leading apostrophe keeps Sheets from mangling +254… into a formula
      d.phone ? "'" + d.phone : '',
      d.email || '',
      d.interest || 'Roam Air',
      d.utm_source || '',
      d.utm_medium || '',
      d.utm_campaign || '',
      d.page || '',
      d.referrer || '',
      d.transcript || '',
      d.userAgent || ''
    ]);

    if (NOTIFY_EMAIL) {
      try {
        MailApp.sendEmail({
          to: NOTIFY_EMAIL,
          subject: 'New Roam lead: ' + (d.name || 'Unknown') + ' ' + (d.phone || ''),
          body: [
            'Name:  ' + (d.name || 'Not provided'),
            'Phone: ' + (d.phone || 'Not provided'),
            'Email: ' + (d.email || 'Not provided'),
            'Page:  ' + (d.page || 'Not provided'),
            'Source:' + (d.utm_source || 'direct'),
            '',
            '--- Conversation ---',
            d.transcript || '(none)'
          ].join('\n')
        });
      } catch (mailErr) {
        // Never fail the lead because the notification failed
      }
    }

    return json({ ok: true });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

/** Lets you confirm the deployment is live by opening the URL in a browser. */
function doGet() {
  return json({ ok: true, service: 'Roam Assistant lead capture', ready: true });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Optional helper: run from the editor to confirm rows append correctly. */
function testAppend() {
  var res = doPost({
    postData: {
      contents: JSON.stringify({
        secret: SHARED_SECRET,
        name: 'Test Rider',
        phone: '+254712345678',
        email: 'test@example.com',
        interest: 'Roam Air',
        page: 'https://www.roam-electric.com/motorcycles',
        utm_source: 'test',
        transcript: 'Visitor: what are the financing options\nAssistant: Six financing partners…'
      })
    }
  });
  Logger.log(res.getContent());
}
