/*! ============================================================================
 *  ROAM ASSISTANT  ·  roam-electric.com
 *  Self-injecting sales assistant widget with lead capture.
 *
 *  INSTALL (Webflow → Project Settings → Custom Code → Footer Code):
 *
 *    <script>
 *      window.RoamAssistantConfig = {
 *        apiEndpoint:   "https://YOUR-PROXY/api/roam-assistant",
 *        leadsEndpoint: "https://script.google.com/macros/s/XXXX/exec"
 *      };
 *    </script>
 *    <script src="https://cdn.jsdelivr.net/gh/adallan01/Roam-Assistant@main/roam-assistant.js" defer></script>
 *
 *  Both endpoints are optional. With no apiEndpoint the assistant answers
 *  from its built-in knowledge base. With no leadsEndpoint the lead form
 *  falls back to WhatsApp so no enquiry is ever lost.
 *
 *  Knowledge verified against roam-electric.com, August 2026.
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__roamAssistantLoaded) return;
  window.__roamAssistantLoaded = true;

  var CFG            = window.RoamAssistantConfig || {};
  var API_ENDPOINT   = CFG.apiEndpoint   || '';
  var LEADS_ENDPOINT = CFG.leadsEndpoint || '';
  var LEADS_SECRET   = CFG.leadsSecret   || '';   // must match SHARED_SECRET in the Apps Script
  var WHATSAPP       = CFG.whatsapp      || '254740666555';
  var PHONE          = '+254 740 666 555';
  // Book a Free Test Ride form: responses are recorded straight into Roam's lead sheet.
  // This is the published /d/e/ link from Roam's own FAQ pack, not the /d/ editor link.
  /* Roam's own Book a Free Test Ride page. It walks the rider through county,
     area, date and time slot, shows their savings, and posts straight into the
     test-ride Google Form's responses sheet. Point this at the Webflow page
     once it is live; the default is the copy published beside this widget. */
  var TEST_RIDE_URL  = CFG.testRideUrl   ||
    'https://book-a-test-ride.vercel.app/';

  /* Roam's cost, financing, total-cost-of-ownership and fleet calculators.
     Cost questions are answered in chat and this is offered as the deeper
     breakdown, so nobody has to leave the chat to get a number. */
  var CALCULATOR_URL = CFG.calculatorUrl ||
    'https://roamfinancecalculator.vercel.app/';

  /* Optional: carry what the visitor already typed in the chat into the booking
     form, so they land on it with their details filled in and only have to pick
     a county and a date. Set the three Google Form field ids here, taken from
     the form's own "Get pre-filled link". Leave blank and the form simply opens
     empty, exactly as before. */
  var TEST_RIDE_FIELDS = CFG.testRideFields || {
    name:  '',   // e.g. 'entry.1234567890'
    phone: '',
    email: ''
  };

  /* Details the visitor has given us during this conversation. */
  var known = { name: '', phone: '', email: '' };

  function testRideLink() {
    var parts = [], k;
    for (k in TEST_RIDE_FIELDS) {
      if (TEST_RIDE_FIELDS[k] && known[k]) {
        parts.push(encodeURIComponent(TEST_RIDE_FIELDS[k]) + '=' + encodeURIComponent(known[k]));
      }
    }
    if (!parts.length) return TEST_RIDE_URL;
    return TEST_RIDE_URL + (TEST_RIDE_URL.indexOf('?') === -1 ? '?' : '&') +
           'usp=pp_url&' + parts.join('&');
  }

  /* ==========================================================================
     BRAND ASSETS  (extracted from Roam's own production creative)
     ========================================================================== */
  var WORDMARK = '__WORDMARK__';
  var IMG = {
    gen3:    '__IMG_GEN3__',
    charger: '__IMG_CHARGER__',
    road:    '__IMG_ROAD__',
    street:  '__IMG_STREET__',
    rider:   '__IMG_RIDER__',
    riders:  '__IMG_RIDERS__'
  };

  /* ==========================================================================
     DATA
     ========================================================================== */

  // Verified against Roam's live financing calculator, updated Aug 2026.
  // Mogo removed (no longer a partner). M-KOPA + Bolt deposits raised to
  // 15,000/20,000 and M-KOPA Roam 2-battery 24mo raised to 970, both
  // confirmed by the Roam team. Order matches the partner sheet.
  var FINANCING_DATA = {
    'M-KOPA · Roam + Bolt': [
      { battery: '1 Battery',   down: '15,000', p12: null,    p18: null,    p24: '540' },
      { battery: '2 Batteries', down: '20,000', p12: null,    p18: null,    p24: '860' }
    ],
    'Fortune Credit · B2C': [
      { battery: '1 Battery',   down: '15,000', p12: null,    p18: '645',   p24: '544' },
      { battery: '2 Batteries', down: '20,000', p12: null,    p18: '955',   p24: '823' }
    ],
    'M-KOPA · Roam': [
      { battery: '1 Battery',    down: '20,000', p12: '1,050', p18: '800',   p24: '650' },
      { battery: '2 Batteries',  down: '25,000', p12: '1,475', p18: '1,125', p24: '970' },
      { battery: 'Battery only', down: '5,000',  p12: '425',   p18: '325',   p24: '275' }
    ],
    'Platinum Credit · Roam': [
      { battery: '1 Battery',   down: '19,500', p12: '1,066', p18: '830',   p24: '711' },
      { battery: '2 Batteries', down: '29,010', p12: '1,465', p18: '1,133', p24: '967' }
    ],
    'Watu · Roam': [
      { battery: '1 Battery',              down: '30,000', p12: null, p18: '700',   p24: null },
      { battery: '2 Batteries + Chargers', down: '35,000', p12: null, p18: '1,091', p24: null }
    ],
    'Rafiki Bank · Roam': [
      { battery: '1 Battery',   down: '50,000', p12: null, p18: null, p24: '533' },
      { battery: '2 Batteries', down: '64,425', p12: null, p18: null, p24: '747' }
    ]
  };

  var CASH = { single: '296,000', dual: '430,000' };

  var MEDIA = {
    'solar expedition': {
      eyebrow: 'Air on the Move',
      title: '6,000 km Solar-Powered Expedition',
      desc: "Roam Air completed Africa's first solar-powered 6,000 km journey from Nairobi to Stellenbosch, South Africa, proving sustainable long-distance EV travel across the continent's toughest terrain.",
      img: IMG.road,
      link: 'https://www.roam-electric.com/newsletter-south-africa-expedition'
    },
    'roam park': {
      eyebrow: 'Made in Africa',
      title: 'Roam Park Manufacturing',
      desc: "East Africa's largest EV assembly plant at over 10,000 m², with capacity for 50,000 motorcycles a year and 98% robotic welding. Inaugurated by Kenya's President in July 2023.",
      img: IMG.gen3,
      link: 'https://www.roam-electric.com/story'
    },
    'border to border': {
      eyebrow: 'Air on the Move',
      title: '900 km Kenya Border-to-Border',
      desc: 'The first boda boda rider to cross Kenya end to end on an electric motorcycle, carrying nothing but a portable charger.',
      img: IMG.rider,
      link: 'https://www.roam-electric.com/newsletter-border-to-border'
    },
    'nairobi addis': {
      eyebrow: 'Air on the Move',
      title: '1,600 km Nairobi–Addis Ride',
      desc: 'Roam Air rode to Africa E-Mobility Week in Addis Ababa, showcasing regional expansion and portable charging on a single continuous route.',
      img: IMG.road,
      link: 'https://www.roam-electric.com/roam-expands-regional-electric-mobility-footprint-with-1-600-km-nairobi-addis-ride-to-africa-e-mobility-week'
    },
    'gen 2': {
      eyebrow: 'Motorcycles',
      title: 'Roam Air Gen 2',
      desc: 'The second-generation Roam Air, co-designed with working boda boda riders for durability and comfort, part of the push that lifted local production to 36%.',
      img: IMG.riders,
      link: 'https://www.roam-electric.com/newsletter-roam-launch-roam-air-gen-2'
    },
    'fast charging battery': {
      eyebrow: 'Charge Anywhere',
      title: "Africa's First Fast-Charging Battery",
      desc: 'Adds more than 1 km of range per minute at a Roam Point, backed by a 100,000 km guarantee, a first for the continent.',
      img: IMG.charger,
      link: 'https://www.roam-electric.com/africas-first-fast-charging-battery-adding-more-than-1-km-per-minute-with-a-100-000-km-guarantee'
    },
    'truck test': {
      eyebrow: 'Built Tough',
      title: 'Survived an 18-Tonne Truck',
      desc: "The Gen 3 battery pack is the world's first to survive being run over by an 18-tonne truck, proof of its structural safety in daily commercial use.",
      img: IMG.charger,
      link: 'https://www.roam-electric.com/worlds-first-battery-to-survive-18-tonne-truck-run-over'
    },
    'roam explorer': {
      eyebrow: 'Fleet',
      title: 'Roam Explorer: AI Fleet Monitoring',
      desc: "Africa's first AI-enabled real-time monitoring platform for electric fleets, tracking battery health, location and performance across every vehicle.",
      img: IMG.street,
      link: 'https://www.roam-electric.com/www-roam-electric-com-launch-of-first-ai-enabled-real-time-monitoring-of-electric-fleets-across-africa'
    },
    'service center': {
      eyebrow: 'After-Sales',
      title: 'Ride-In, Ride-Out Service Centre',
      desc: "Kenya's first dedicated Roam service centre in Nairobi, with capacity for 150 motorcycles a day, serving 3,500 riders every month.",
      img: IMG.street,
      link: 'https://www.roam-electric.com/press-releases'
    },
    'charging': {
      eyebrow: 'Charge Anywhere',
      title: 'Charge at Home, Point or Hub',
      desc: 'Charge overnight at home with the included portable charger, top up at a 24/7 Roam Point, or use a full-service Roam Hub, with nine of them across Nairobi.',
      img: IMG.street,
      link: 'https://www.roam-electric.com/charging'
    }
  };

  /* Every FAQ entry carries a category. Retrieval is constrained to the
     category the question was classified into, so a question about one topic
     can never be answered with a fact from another. */
  var FAQ = [
    { c:'home_charging',   q: 'Can I charge at home?',            a: "Yes. The Roam Air's removable battery plugs into any standard home outlet using the included portable charger, just like charging a phone." },
    { c:'charging_where',  q: 'Where can I charge?',              a: 'At home with the portable charger, at a 24/7 self-service Roam Point, or at a full-service Roam Hub. Roam Hubs are located across Nairobi.' },
    { c:'charging_cost',   q: 'How much does charging cost?',     a: 'About KES 1 per kilometre at home. That is roughly KES 80 to fill one battery for about 80 km, or KES 160 for two batteries and a full 160 km day. Your exact cost depends on your electricity tariff and how you ride.' },
    { c:'charging_cost',   q: 'What does a Roam Point cost?',     a: 'Fast charging at a Roam Point is charged per unit of electricity: KSh 40 per kWh during the day and a discounted KSh 25 per kWh off-peak and overnight. Battery rental at a Roam Hub is KES 20 an hour.' },
    { c:'charging_time',   q: 'How long does a full charge take?',a: 'About 3 to 4 hours for a full charge from a standard wall outlet using the 10A portable charger. At a Roam Point or Roam Hub, fast charging adds over 1 km of range per minute and takes 20 to 80 percent in under 45 minutes.' },
    { c:'range',           q: 'How far can it go on one charge?', a: 'Up to 80 km on one battery and up to 160 km on two, which is about the distance from Nairobi to Nakuru. Real range depends on load, terrain, speed and riding style.' },
    { c:'battery_owner',   q: 'Do I own the battery?',            a: 'Yes. Once your financing is complete you own the motorcycle and the battery outright. No swapping, no waiting, no fees that never end.' },
    { c:'battery_specs',   q: 'How heavy is the battery?',        a: 'About 20 kg, roughly the same as the 20-litre jerrican most homes use for water. It lifts out so you can carry it inside to charge.' },
    { c:'battery_specs',   q: 'What kind of battery is it?',      a: 'A removable 72V lithium-ion battery in an industrial-grade aluminium casing, sealed to IP67 against dust and water, with built-in GPS tracking and smart telemetry.' },
    { c:'battery_specs',   q: 'Is the battery waterproof?',       a: 'The battery is sealed to IP67, which protects it against dust and water in normal riding, including rain and wet roads. Avoid deep standing water, as with any motorcycle.' },
    { c:'durability',      q: 'Is the bike waterproof?',          a: 'The battery is sealed to IP67 against dust and water, and the bike is built for rain and wet roads. Avoid deep standing water, as with any motorcycle.' },
    { c:'country',         q: 'Is Roam available outside Kenya?', a: 'Not yet. Roam currently sells, services, charges and finances in Kenya only. We plan to expand across East Africa and then wider into Africa, but nothing is confirmed for other countries yet.' },
    { c:'solar',           q: 'Can I charge using solar?',        a: 'Yes. A Roam Air rode 6,000 km from Nairobi to South Africa powered entirely by solar. For home solar, the system needs to be sized correctly for the charger, so talk to us or your installer first.' },
    { c:'financing',       q: 'Can I finance a Roam Air?',        a: 'Yes, up to 97% asset financing through M-KOPA, Fortune Credit, Platinum Credit, Watu or Rafiki Bank, with deposits from KES 15,000 and terms of 12, 18 or 24 months. Once the loan is paid off you own both the bike and the battery.' },
    { c:'savings',         q: 'How much can I save?',             a: 'At 160 km/day most riders save around KES 577 a day versus a petrol motorcycle and KES 213 a day versus a battery-swapping motorcycle, over KES 100,000 a year.' },
    { c:'pricing',         q: "What's the cash price?",           a: 'KES 296,000 for a single battery plus one charger, or KES 430,000 for dual batteries plus two chargers.' },
    { c:'manufacturing',   q: 'Where are Roam vehicles made?',    a: 'Designed, engineered and assembled in Kenya at Roam Park, a 10,000 sqm facility in Nairobi with eventual capacity for 50,000 motorcycles a year.' },
    { c:'warranty',        q: "What's the warranty?",             a: 'Roam Air carries a 2-year commercial warranty, and the Gen 3 battery is guaranteed for 100,000 km.' },
    { c:'test_ride',       q: 'Can I book a test ride?',          a: 'Yes, free and with no commitment. Use the booking button above to pick a date, or call ' + PHONE + ', Mon–Fri 9am–5pm.' },
    { c:'b2b',             q: 'Do you offer fleet deals?',        a: 'Yes, for operators running multiple bikes, with Roam Explorer fleet monitoring included. Contact sales@roam-electric.com.' },
    { c:'theft',           q: 'What if my battery is stolen?',    a: 'Every battery is GPS-tracked in real time through the Roam App, with live health monitoring and anti-theft alerts. Report a theft to the team on ' + PHONE + ' straight away.' },
    { c:'performance',     q: 'How powerful is it?',              a: 'A 3,000W mid-drive motor producing 55 Nm of torque, with three riding modes: Eco, Standard and Power. Top speed is 90 km/h and 0 to 60 km/h takes 6.9 seconds.' }
  ];

  var SUGGESTIONS = ['Roam Air specs', 'Financing options', 'Where can I charge?', 'How much will I save?', 'Book a test ride'];

  var SYSTEM_PROMPT = [
    'You are Roam Assistant, representing Roam Electric: "The Standard of Electric Mobility in Africa." You are warm, knowledgeable and passionate about Roam\'s impact on African mobility. Your purpose is to help people choose and buy a Roam Air.',
    '',
    'GOLDEN RULE, ABOVE EVERYTHING ELSE:',
    'A correct "I do not have confirmed information on that" is always better than an irrelevant, inferred or invented answer.',
    'RELEVANCE MATTERS MORE THAN COMPLETENESS. Never answer a question just because you hold some Roam information that sounds related.',
    '',
    'ANSWER THE EXACT QUESTION ASKED. Do not answer a related question, a broader question, a nearby topic, or what you think they "probably meant".',
    'Before you answer, check: does the information below directly answer THIS question, in the same subject area? If not, do not use it. Say you do not have it confirmed and give the escalation instead.',
    'Worked example of the failure to avoid. Asked "Are you in Eldeyo Market?" the subject is location availability, not durability. Answering "Roam Air is built for Kenyan roads" is WRONG. The correct reply is that you do not have confirmed availability for that place and they should call ' + PHONE + '.',
    '',
    'THE OPPOSITE MISTAKE IS ALSO WRONG. Do not say you cannot confirm something just because the customer worded it differently from the notes below. Understand intent, not wording. "Can I buy a Roam?", "Where do I get one?", "Nataka Roam" and "Naeza nunua Roam?" are all the same purchase question, and all deserve a real answer. Only fall back when the information is genuinely missing, not when the phrasing is unfamiliar.',
    '',
    'CUSTOMERS WRITE IN KENYAN ENGLISH, SWAHILI AND SHENG. Understand and reply helpfully to short messages, typos and mixed language. Reply in the language they used. Common terms: naeza/naweza = can I, nataka = I want, nunua = buy, napata/pata = get, wapi = where, iko = is, ngapi = how much, bei = price, nyumbani = at home, betri = battery, pikipiki = motorcycle, duka = shop, moja = one, mbili = two, gharama = cost, lini = when.',
    '',
    'IF TWO READINGS ARE GENUINELY PLAUSIBLE, ask one short clarifying question. Do not ask for clarification when the question is already clear, and do not use a clarification as a way to avoid answering.',
    '',
    'USE THE CONVERSATION. A short follow-up like "and if I want two batteries?" continues the previous subject. Do not treat it as a brand new question.',
    '',
    'NEVER INVENT: shops, dealers, charging stations, service centres, countries of operation, prices, deposits, rates, promotions, stock levels, colours, warranty outcomes, or financing approvals. If it is not written below, it is unknown.',
    'NEVER CLAIM LIVE INFORMATION. You cannot see stock, an account, a financing decision, or the nearest Roam Point. Do not say you checked anything.',
    '',
    'IF TWO FACTS BELOW CONFLICT, do not quietly pick one. Say the team will confirm the exact figure and give the phone number.',
    'DO NOT OVER-ANSWER. Answer the question asked in one to four sentences, then optionally offer ONE useful follow-up. Do not empty the whole knowledge base into every reply.',
    '',
    'ESCALATION WORDING, use the one that fits:',
    '- Unknown place: "I don\'t have confirmed Roam availability for [place] in my current information. Please WhatsApp or call Roam on ' + PHONE + ' and we\'ll confirm it for you."',
    '- Unknown country: "Roam is currently available in Kenya. I don\'t have confirmed commercial availability for [country] at this time. Please contact Roam for the latest update."',
    '- Unknown price: "I don\'t have a confirmed current price for that configuration. Please contact Roam on ' + PHONE + ' for the latest price."',
    '- Unknown financing: "Financing depends on the financier and package. I don\'t have enough verified information to confirm that specific option. Please contact Roam on ' + PHONE + '."',
    '- Unknown technical: "I don\'t have a verified answer to that technical question in my current knowledge base. Please contact the Roam team on ' + PHONE + ' for confirmation."',
    '- Unknown promotion: "I don\'t have a confirmed current promotion for that offer. Please contact Roam on ' + PHONE + ' for the latest information."',
    '',
    'RESPONSE FORMAT (CRITICAL):',
    '- Open with one short sentence, then bullets, then one closing line',
    '- Never write long paragraphs. Use "•" to start each bullet',
    '- Keep each bullet under 12 words; max 5 bullets. No emoji.',
    '- Never use the em dash character. Use a comma, colon, or a full stop instead.',
    '',
    'EXAMPLE:',
    'Q: "Tell me about Roam Air Gen 3"',
    'A: Roam Air Gen 3 is our latest motorcycle, built for African roads.',
    '• 160 km range on dual batteries, 90 km/h top speed',
    '• Fast charging adds 1 km of range per minute',
    '• Battery guaranteed for 100,000 km',
    '• 2-year commercial warranty',
    'Ready for a free test ride?',
    '',
    'COMPANY (founded 2017 as Opibus, rebranded Roam April 2022):',
    'Mission: affordable, reliable, clean transport built for emerging markets: "Made in Africa, for Africa." 250+ staff. HQ Nairobi. Taglines: "The Standard of Electric Mobility in Africa" and "Ride Everywhere, Charge Anywhere."',
    '',
    'ROAM AIR GEN 3 (electric motorcycle). This is the product you are selling:',
    '• Range up to 80 km on one battery, up to 160 km on two (about Nairobi to Nakuru)',
    '• Top speed 90 km/h; 0–60 km/h in 6.9 seconds',
    '• 72V dual-battery system, 3,000W rated power, 55 Nm peak torque',
    '• Weight 129–149 kg; max payload 250 kg',
    '• About 3 to 4 hours for a full charge from a standard wall outlet with the 10A portable charger',
    '• At a Roam Point the fast-charging battery adds over 1 km of range per minute',
    '• Battery: removable 72V lithium-ion, about 20 kg, IP67 sealed, industrial-grade aluminium casing',
    '• Battery guaranteed 100,000 km; GPS tracking and smart telemetry built in',
    '• 3,000W mid-drive motor, 55 Nm of torque',
    '• Three riding modes: Eco, Standard and Power',
    '• Reinforced chassis rated 200,000+ vibration cycles; 2-year commercial warranty',
    '• Built to handle rain, dust and everyday riding on tough African roads',
    '• Cash price: KES 296,000 (single battery + 1 charger) or KES 430,000 (dual battery + 2 chargers)',
    'GEN 2: co-designed with boda boda riders, launched June 2025; lifted local production to 36%.',
    '',
    'CURRENT CAMPAIGN MESSAGING (use this language naturally, it is how Roam is talking to customers right now):',
    '• "Ride Everywhere. Charge Anywhere." and "Own Your Power. Trust Every Mile."',
    '• "Charge at home, just like your phone."',
    '• Two batteries give up to 160 km, the same distance as Nairobi to Nakuru',
    '• Save up to 40% a day versus fuel',
    '• Up to 97% asset financing, own yours today',
    '• Full freedom with battery ownership: you own your battery, no swapping, no waiting',
    '• "Made for African terrain. Built for your hustle."',
    '• The value chain in one line: buy it, charge cheaply, spend less, keep more, earn more',
    '• On test rides: "Feel it before you decide." "Experience it. Feel the difference."',
    '',
    'BUSES (IMPORTANT): Roam Move and Roam Rapid are NOT currently available to order. Bus sales are on hold. If someone asks about buses, tell them warmly that buses are not available for order at the moment, offer to take their details so the team can contact them when that changes, and steer the conversation to Roam Air if relevant. Do NOT quote bus specifications, prices or availability dates.',
    '',
    'ROAM EXPLORER (March 2026): Africa\'s first AI-enabled real-time fleet monitoring platform: battery health, location, performance and usage. Works across 2G, 3G and 4G, so it functions in areas with limited connectivity. Supports anti-theft and GPS tracking.',
    '',
    'ROAM CANOPY: Roam\'s fleet-management platform for businesses, fleet operators, logistics companies and financiers. It lets them monitor, manage and act on connected fleet information, and gives financiers visibility into the assets they have financed. Explorer is the vehicle intelligence, Canopy is the management platform on top of it.',
    '',
    'BATTERY DETAIL: about 20 kg, roughly a 20-litre jerrican, and removable so it can be carried indoors to charge. IP67-rated against dust and water. Industrial-grade die-cast aluminium casing. GPS-tracked with anti-theft. Guaranteed 100,000 km. Up to 80 km per battery, 160 km on two. A battery can be bought on its own, and can be financed separately from the motorcycle.',
    '',
    'AVAILABILITY (do not speculate beyond this table):',
    '• Kenya: sales YES, service YES, charging YES, financing YES. ACTIVE.',
    '• Uganda: NO. Rwanda: NO. Tanzania: NO. All other countries: NO.',
    'Never speculate about Roam\'s expansion plans, market availability, dealerships, charging infrastructure or financing in any country that is not marked ACTIVE above. If asked, say Roam is Kenya-only today, that expansion across East Africa and then wider Africa is the intention, that nothing else is confirmed, and offer to take their details so the team can contact them when it changes. A bike can physically be ridden across a border, but registration, warranty, servicing, spare parts and charging access outside Kenya must be confirmed with Roam first.',
    '',
    'APPROVED LOCATION DATABASE (Roam Operational Locations, August 2026). This is the complete list of Roam locations. A place that is not on it is UNKNOWN, and unknown means escalate. Each entry is followed by the services that station itself lists: C charging, R battery rental, A after-sales, S shop.',
    '• Roam Hub – Outering (TotalEnergies): C R A',
    '• Roam Hub – Wayaki Way (TotalEnergies): C R A',
    '• Roam Hub – Kayole (Sahara Energy): C R A',
    '• Roam Hub – Lusaka Road (TotalEnergies): C R A',
    '• Roam Hub – Roysambu (Quickmart): C R',
    '• Roam Hub – Sabaki (TotalEnergies): C R',
    '• Roam Hub – Forest Road (Shell): C R',
    '• Roam Hub – Karambee (TotalEnergies): C R',
    '• Roam Hub – Machakos Town (Stanchard): C R',
    '• Roam Hub – Ojijo (Rubis): C R',
    '• Roam Hub – Roam Park: no rider services listed',
    '• Roam Hub – Suguta: C R S',
    '• Roam Hub – Thika Centre: C R A S',
    '• Roam Hub – Machakos Centre (TotalEnergies): C R A S',
    '• Roam Hub – Nairobi Regional Office: C R A S',
    "• Roam Hub – Adam's Minimall: C R A S",
    '• Roam Hub – Langata: C R S',
    '• Roam Hub – Wetu Hub Homabay: A S',
    'Plus Roam Points, self-service fast charging.',
    'NEVER transfer a service from one station to another: answer from the station\'s own row above. Never invent a station, a phone number or a map link. Never call a station "nearest" unless the rider has told you where they are. Never claim a charger is free or a station is open right now, since there is no live availability data: say the station is LISTED as offering that service. If someone names any other town, market, estate, road or neighbourhood, you do NOT have confirmed availability there. Do not answer with a nearby town, do not answer with a product fact, and do not imply a presence. Say you have no confirmed Roam location there, ask for the nearest area or town, and offer ' + PHONE + '. The widget answers location questions itself from this database, with map links and station phone numbers, so you will rarely need to.',
    '',
    'COLOURS: not confirmed in this knowledge base. If asked what colours are available, say you do not have confirmed current colour options and give the phone number.',
    '',
    'SERVICING: an electric motorcycle still needs regular maintenance, but there are NO oil changes and NO spark plugs because there is no combustion engine. Servicing covers tyres, brakes, chain, suspension, electrical systems and other wear components. Genuine parts are available through the Roam service network.',
    '',
    'CHARGING:',
    'CHARGING COSTS (approved figures, quote these and nothing else):',
    '• Home charging works out at about KES 1 per kilometre',
    '• About KES 80 to fully charge one battery, which gives about 80 km',
    '• About KES 160 to charge two batteries, which gives about 160 km',
    '• Roam Point fast charging: KSh 40 per kWh daytime, KSh 25 per kWh off-peak and overnight',
    '• Roam Hub charging tariff and battery rental: KES 20 per hour',
    '• Always add that the exact cost depends on their electricity tariff and how they ride',
    '',
    'DO THE MATH FOR THEM. If someone tells you what they currently spend on petrol, or how many km they ride a day, calculate their electric cost at KES 1/km, the daily saving, and the monthly saving (daily x 30). Show the arithmetic simply. Always close by saying actual savings depend on distance, load, riding style and electricity tariff. This is the single most persuasive thing you can do, so do it whenever you have the numbers, and ask for the numbers when you do not.',
    '',
    '• Roam Hub, full-service solar-powered stations: fast charging, battery rental (KES 20/hour, under a minute), maintenance and genuine parts. Which services a given hub offers varies, so read them off the location database above rather than assuming.',
    '• Roam Point, 24/7 self-service fast charging, mobile payment or Roam App.',
    '• Home, included 10A portable charger, about KES 1/km, roughly 3 to 4 hours for a full charge, safe to charge overnight.',
    '',
    "MANUFACTURING (ROAM PARK): East Africa's largest EV assembly plant, 10,000+ m², up to 50,000 motorcycles/year, 98% robotic welding, inaugurated by Kenya's President July 2023, US university partnership for low-cost robotic welding. Roam has built more than 7,000 motorcycles to date. Designed, built and assembled in Africa, which is why the bike suits African roads, payloads and conditions, and why it builds local jobs, skills and supplier networks.",
    '',
    'REAL RIDER PROOF: Amos Kyalo, a Roam rider, spends about KES 100 to ride roughly 100 km, and reports saving money compared with the petrol motorcycle he rode before. Riders have completed long-distance journeys across Kenya on portable charging and dual batteries, including a 900 km ride from Malaba to Mombasa. Use real rider experience in preference to generic claims wherever it fits.',
    '',
    "INNOVATIONS: Africa's first fast-charging battery, 1 km/min, 100,000 km guarantee (Apr 2026) · World's first battery to survive an 18-tonne truck run-over (Apr 2026) · Roam Explorer AI fleet monitoring (Mar 2026) · Africa's first low-cost robotic welding for e-motorcycles (Jan 2026) · First universal fast charging for light EVs in Africa (Nov 2025) · Kenya's first ride-in, ride-out service centre, 150 bikes/day and 3,500 riders/month (Nov 2025).",
    '',
    "EXPEDITIONS: 6,000 km solar-powered Nairobi–Stellenbosch (Sept–Oct 2024), Africa's first · 1,600 km Nairobi–Addis to Africa E-Mobility Week (Oct 2025) · 900 km Kenya border-to-border on a portable charger (Jan 2025).",
    '',
    'FINANCING: up to 97% asset financing across five partners, deposits from KES 15,000 for a bike (KES 5,000 for a battery only), terms of 12/18/24 months: M-KOPA (two programmes, one of them with Bolt), Fortune Credit, Platinum Credit, Watu, Rafiki Bank. Mogo is NO LONGER a financing partner, never mention them. Key selling point: when the loan ends the rider owns BOTH bike and battery, unlike battery swapping, where the battery is never owned and swap fees continue forever. Exact per-plan pricing is shown in the financing card in this chat.',
    '',
    'SAVINGS at 160 km/day (the average boda rider\'s distance): riders save up to 40% a day versus fuel. Roam Air about KES 160/day to charge, versus about KES 897/day petrol and about KES 533/day battery swapping. Riders typically save KES 500–580/day vs petrol and about KES 213/day vs swap, over KES 100,000 a year. Annual maintenance: petrol about KES 24,000, swap about KES 8,400, Roam Air about KES 7,200.',
    '',
    "AWARDS: Financial Times, naming Roam Africa's fastest-growing EV company and Kenya's fastest-growing company (2025) · TIME100 Most Influential Companies · Earthshot Prize finalist · Norrsken Top 100 Impact · SET Awards 2024 winner, Mobility & Transportation. Covered by BBC, CNN, TechCrunch, Bloomberg, CIO Africa, LA Times.",
    '',
    'CAREERS: values are Dignity, Discovery, Drive, Delivery. Open roles: Mechanical Engineer (Vehicle Systems), Battery Systems Technician, Manufacturing Operations Coordinator, Field Technician (After-Sales), Marketing Content Strategist, UX Researcher. Apply at roam-electric.com/careers.',
    '',
    'CONTACT: ' + PHONE + ' (Mon–Fri, 9am–5pm) · info@roam-electric.com · sales@roam-electric.com · WhatsApp wa.me/' + WHATSAPP + ' · Book a free test ride: ' + TEST_RIDE_URL,
    '',
    'RULES ON ACCURACY: Only state figures given above. Never invent prices, specs, dates or availability. If you do not know an exact number, do not guess it.',
    '',
    'AFTER-SALES PARTS. The widget holds Roam\'s parts catalogue for Q3 to Q4 2025, with part numbers, part prices, repair prices and totals, all VAT inclusive. It handles part searches, the Roam Cart and draft quotes itself, so you will rarely need to. If you do discuss parts: never invent a part, a part number or a price; never claim something is in stock, since the catalogue is a price list and not an inventory; never confirm that a part fits a particular Roam Air version, say the service team will confirm fitment; never invent delivery fees, timelines or courier details; and always call a total a draft estimate subject to Roam confirming current price, availability and compatibility. Service charges: Simple Assessment free, In-Depth Troubleshooting KES 300, Battery Assessment KES 1,000, Accident Assessment KES 1,000.',
    'PRICE DATE. The parts catalogue is dated Q3 to Q4 2025. Do not call those prices current. Say the catalogue lists the part at that price including VAT, and recommend confirming the current price with Roam before ordering.',
    '',
    'RIDER CARE AND BEST PRACTICE (Roam Rider Best Practice Guide, August 2026):',
    '• More range: steady moderate speed, smooth acceleration, lighter load, Eco mode, use regenerative braking, avoid bulky add-ons that catch the wind.',
    '• Riding modes: Eco for efficiency, Standard for everyday, Power for heavy loads and steep hills but it uses more battery.',
    '• Regenerative braking: light braking engages it, mechanical brakes take over when braking harder. It does not operate at 100 percent charge and resumes below 90 percent.',
    '• Charging care: approved portable charger from a standard socket, safe to leave charging overnight, never charge near water, keep the connector clean and dry, do not cover the charger, confirm it is actually charging before leaving it.',
    '• Maintenance: tyre pressure 28 PSI front and 32 PSI rear, check chain slack every 500 km at about 20 mm of movement, lubricate the chain after every wash, check for loose bolts, visit a Roam service location for brake adjustment.',
    '• Washing: remove the battery first, keep water off throttle controls and battery connectors, no high-pressure washer, check for loose bolts afterwards, lubricate the chain.',
    '• Safety: helmet with the chin strap fastened, gloves, closed shoes, jacket, bright or reflective clothing, daytime running lights, check tyres brakes and lights before every ride, both hands on the bars, no phone, never ride impaired, slow down in rain dust or wind.',
    '• Dashboard: motor fault means do not keep riding; throttle fault means stop safely and get service help; the spanner means a powertrain maintenance issue. Battery bar, charge indicator, power meter, beam and turn indicators are status only.',
    '• Roam Hub battery rental is KES 20 an hour, maximum 48 hours, return it so other riders can use it.',
    '• Service centre: Roam Nairobi Ride-In Ride-Out Service Centre on Lusaka Road. Support hours 8:30am to 5:00pm.',
    'SAFETY-FIRST ESCALATION: any fault involving brakes, throttle, motor, battery, overheating or electrical systems means tell them to stop safely and contact Roam. Never improvise a troubleshooting procedure.',
    '',
    'NOT YET APPROVED, so never answer these from your own knowledge. Say the team will confirm the exact figure, and offer WhatsApp, phone or a call back: exact battery capacity in kWh, units of electricity per full charge, charger AC input rating, number of charging cycles, battery degradation behaviour, what happens after 100,000 km, replacement battery price, routine servicing price, service intervals, detailed warranty terms and exclusions, financing eligibility requirements, early settlement, additional fees, exact insurance and health cover included by each financier, exact Canopy and Explorer feature lists, theft-alert specifics, offline and SMS behaviour, and data privacy terms.',
    '',
    'RULES ON NEVER DEAD-ENDING (IMPORTANT): You must never end a reply with only "I do not know" or "I do not have that information." That is useless to someone trying to buy. Whenever you cannot answer fully:',
    '1. Say briefly that you want to get it exactly right rather than guess.',
    '2. Give whatever related information you DO have, since something adjacent is better than nothing.',
    '3. Always offer a concrete route to a person: WhatsApp wa.me/' + WHATSAPP + ' (fastest), ' + PHONE + ' Mon–Fri 9am–5pm, sales@roam-electric.com, or offer to take their number for a call back.',
    '4. End by inviting the next question.',
    'Treat every question you cannot answer as a chance to connect the person with sales, not as a full stop.',
    '',
    'When someone shows buying intent, encourage them to leave their contact details so a sales rep can call back.'
  ].join('\n');

  // Offline answers for the main sales themes (used when no apiEndpoint is set)
  /* ==========================================================================
     APPROVED LOCATION DATABASE
     Only places listed here may ever be described as having a Roam presence.
     Anything else is unknown and must be escalated, never inferred.
     ========================================================================== */
  var PLACES = [
    { k: /\bnairobi\b/,  a: 'Yes. Roam is based in Nairobi. Our service centre is here and there are Roam Hubs across the city for charging and after-sales.' },
    { k: /\bthika\b/,    a: 'Yes. Roam Shop Thika serves that area.' },
    { k: /\bmachakos\b/, a: 'Yes. Roam Shop Machakos serves that area.' }
  ];

  /* Words that follow "in / at / near" but are not places. */
  var NOT_A_PLACE = /^(stock|business|charge|touch|person|store|the|a|an|my|your|our|this|that|it|kenya|there|here|town|area|county|counties|general|total|fact|order|time|need|use|mind|control|africa|east)$/;

  /* ==========================================================================
     ROAM OPERATIONAL LOCATIONS
     Source: Roam Assistant Operational Locations (Final), August 2026.

     This table is the only source for hub, charging, battery-rental,
     after-sales, shop and station-contact questions. Every service flag is
     per station. A service is never borrowed from a neighbouring hub, a
     station that is not in this table does not exist as far as the assistant
     is concerned, and no phone number or map link is ever improvised.

       s   site / station name          pa  partner
       ph  station phone, '' if none    lat/lng  from the supplied map link
       ch  charging   re  battery rental   as  after-sales
       sh  shop       co  container (internal, not volunteered to riders)
       ld  launch date, '' if none      rg  nairobi | outside
       k   everyday wording, including the spellings riders actually use
       kx  the more specific wording, when two stations share a town name
     ========================================================================== */
  var HUBS = [
    { s:'Outering',                 pa:'TotalEnergies',   ph:'+254 723 655 007',
      lat:-1.26955,  lng:36.88024,  ch:1, re:1, as:1, sh:0, co:1,
      ld:'16 January 2025',  rg:'nairobi',  k:/\bout ?ering\b|\bouterring\b/ },
    { s:'Wayaki Way',               pa:'TotalEnergies',   ph:'+254 727 204 078',
      lat:-1.25861,  lng:36.781386, ch:1, re:1, as:1, sh:0, co:1,
      ld:'1 May 2023',       rg:'nairobi',  k:/\bwa[iy]{0,2}aki\b/ },
    { s:'Kayole',                   pa:'Sahara Energy',   ph:'+254 721 461 560',
      lat:-1.28173,  lng:36.9052,   ch:1, re:1, as:1, sh:0, co:1,
      ld:'1 May 2024',       rg:'nairobi',  k:/\bkayole\b/ },
    { s:'Lusaka Road',              pa:'TotalEnergies',   ph:'+254 724 051 752',
      lat:-1.301257, lng:36.833013, ch:1, re:1, as:1, sh:0, co:1,
      ld:'1 March 2023',     rg:'nairobi',  k:/\blusaka\b/ },
    { s:'Roysambu',                 pa:'Quickmart',       ph:'+254 700 838 383',
      lat:-1.21521,  lng:36.89175,  ch:1, re:1, as:0, sh:0, co:1,
      ld:'1 December 2023',  rg:'nairobi',  k:/\broysambu\b|\broysabu\b|\brosysambu\b/ },
    { s:'Sabaki',                   pa:'TotalEnergies',   ph:'+254 114 930 589',
      lat:-1.41952,  lng:36.95438,  ch:1, re:1, as:0, sh:0, co:1,
      ld:'10 August 2024',   rg:'outside',  k:/\bsabaki\b/ },
    { s:'Forest Road',              pa:'Shell',           ph:'+254 722 528 051',
      lat:-1.26773,  lng:36.83114,  ch:1, re:1, as:0, sh:0, co:1,
      ld:'1 September 2024', rg:'nairobi',  k:/\bforest ?road\b|\bforest\b/ },
    { s:'Karambee',                 pa:'TotalEnergies',   ph:'+254 117 473 213',
      lat:-1.26673,  lng:36.84522,  ch:1, re:1, as:0, sh:0, co:1,
      ld:'3 January 2025',   rg:'nairobi',  k:/\bkarambee?\b|\bkarambe\b/ },
    { s:'Machakos Town',            pa:'Stanchard',       ph:'',
      lat:-1.51997,  lng:37.26909,  ch:1, re:1, as:0, sh:0, co:1,
      ld:'',                 rg:'outside',  k:/\bmachakos\b/, kx:/\bmachakos town\b/ },
    { s:'Ojijo',                    pa:'Rubis',           ph:'',
      lat:-1.2671,   lng:36.81175,  ch:1, re:1, as:0, sh:0, co:1,
      ld:'15 November 2025', rg:'nairobi',  k:/\bojijo\b/ },
    { s:'Roam Park',                pa:'Roam',            ph:'',
      lat:-1.33688,  lng:36.8646,   ch:0, re:0, as:0, sh:0, co:1,
      ld:'17 February 2025', rg:'nairobi',  k:/\broam park\b/ },
    { s:'Suguta',                   pa:'Roam',            ph:'+254 724 148 162',
      lat:-1.28777,  lng:36.77884,  ch:1, re:1, as:0, sh:1, co:0,
      ld:'28 November 2024', rg:'nairobi',  k:/\bsuguta\b/ },
    { s:'Thika Centre',             pa:'Roam',            ph:'+254 704 269 168',
      lat:-1.03381,  lng:37.07543,  ch:1, re:1, as:1, sh:1, co:0,
      ld:'8 November 2024',  rg:'outside',  k:/\bthika\b/, kx:/\bthika cent(re|er)\b/ },
    { s:'Machakos Centre',          pa:'TotalEnergies',   ph:'+254 116 879 836',
      lat:-1.52782,  lng:37.20929,  ch:1, re:1, as:1, sh:1, co:0,
      ld:'30 April 2025',    rg:'outside',  k:/\bmachakos\b/, kx:/\bmachakos cent(re|er)\b/ },
    { s:'Nairobi Regional Office',  pa:'Roam',            ph:'',
      lat:-1.30187,  lng:36.8332,   ch:1, re:1, as:1, sh:1, co:0,
      ld:'15 July 2025',     rg:'nairobi',  k:/\b(nairobi|narobi) regional\b|\bregional office\b/ },
    { s:"Adam's Minimall",          pa:"Adam's Minimall", ph:'',
      lat:-1.30085,  lng:36.77946,  ch:1, re:1, as:1, sh:1, co:0,
      ld:'11 August 2025',   rg:'nairobi',  k:/\badams?'?s?\b|\bmini ?mall\b/ },
    { s:'Langata',                  pa:'Roam',            ph:'',
      lat:-1.34207,  lng:36.7639,   ch:1, re:1, as:0, sh:1, co:0,
      ld:'4 January 2026',   rg:'nairobi',  k:/\blang'?ata\b/ },
    { s:'Wetu Hub Homabay',         pa:'Wetu',            ph:'',
      lat:-0.54971,  lng:34.45358,  ch:0, re:0, as:1, sh:1, co:0,
      ld:'',                 rg:'outside',  k:/\bhoma ?bay\b|\bwetu\b/ }
  ];

  /* Everywhere a rider might say they are. Only used to work out which listed
     station is closest to them: none of these is claimed as a Roam location,
     and a town with no station within 60 km is told so plainly. */
  var AREAS = [
    { n:'Nairobi CBD',   k:/\b(nairobi cbd|town cent(re|er)|cbd)\b/,        lat:-1.2864, lng:36.8172 },
    { n:'Westlands',     k:/\bwestlands\b/,                                 lat:-1.2649, lng:36.8021 },
    { n:'Parklands',     k:/\bparklands\b/,                                 lat:-1.2620, lng:36.8195 },
    { n:'Kilimani',      k:/\bkilimani\b/,                                  lat:-1.2900, lng:36.7850 },
    { n:'Kileleshwa',    k:/\bkileleshwa\b/,                                lat:-1.2795, lng:36.7793 },
    { n:'Lavington',     k:/\blavington\b/,                                 lat:-1.2790, lng:36.7660 },
    { n:'Karen',         k:/\bkaren\b/,                                     lat:-1.3197, lng:36.7075 },
    { n:'Ongata Rongai', k:/\brongai\b/,                                    lat:-1.3960, lng:36.7440 },
    { n:'Ngong',         k:/\bngong\b/,                                     lat:-1.3536, lng:36.6553 },
    { n:'Kikuyu',        k:/\bkikuyu\b/,                                    lat:-1.2460, lng:36.6630 },
    { n:'Kiambu',        k:/\bkiambu\b/,                                    lat:-1.1714, lng:36.8356 },
    { n:'Ruiru',         k:/\bruiru\b/,                                     lat:-1.1450, lng:36.9580 },
    { n:'Juja',          k:/\bjuja\b/,                                      lat:-1.1036, lng:37.0144 },
    { n:'Githurai',      k:/\bgithurai\b/,                                  lat:-1.1930, lng:36.9210 },
    { n:'Kahawa',        k:/\bkahawa\b/,                                    lat:-1.1830, lng:36.9250 },
    { n:'Kasarani',      k:/\bkasarani\b/,                                  lat:-1.2230, lng:36.8990 },
    { n:'Ruaraka',       k:/\bruaraka\b/,                                   lat:-1.2400, lng:36.8720 },
    { n:'Zimmerman',     k:/\bzimmerman\b/,                                 lat:-1.2100, lng:36.8900 },
    { n:'Eastleigh',     k:/\beastleigh\b/,                                 lat:-1.2740, lng:36.8480 },
    { n:'Buruburu',      k:/\bburu ?buru\b/,                                lat:-1.2870, lng:36.8790 },
    { n:'Donholm',       k:/\bdonholm\b|\bdonholme\b/,                      lat:-1.2950, lng:36.8870 },
    { n:'Umoja',         k:/\bumoja\b/,                                     lat:-1.2810, lng:36.8930 },
    { n:'Kariobangi',    k:/\bkariobangi\b/,                                lat:-1.2560, lng:36.8830 },
    { n:'Dandora',       k:/\bdandora\b/,                                   lat:-1.2560, lng:36.9010 },
    { n:'Embakasi',      k:/\bembakasi\b/,                                  lat:-1.3120, lng:36.9060 },
    { n:'Pipeline',      k:/\bpipeline\b/,                                  lat:-1.3130, lng:36.8940 },
    { n:'Utawala',       k:/\butawala\b/,                                   lat:-1.2860, lng:36.9540 },
    { n:'Ruai',          k:/\bruai\b/,                                      lat:-1.2680, lng:37.0000 },
    { n:'Syokimau',      k:/\bsyokimau\b/,                                  lat:-1.3630, lng:36.9450 },
    { n:'Mlolongo',      k:/\bmlolongo\b/,                                  lat:-1.3880, lng:36.9350 },
    { n:'Athi River',    k:/\bathi ?river\b/,                               lat:-1.4560, lng:36.9780 },
    { n:'Kitengela',     k:/\bkitengela\b/,                                 lat:-1.4780, lng:36.9600 },
    { n:'South B',       k:/\bsouth b\b/,                                   lat:-1.3080, lng:36.8340 },
    { n:'South C',       k:/\bsouth c\b/,                                   lat:-1.3200, lng:36.8290 },
    { n:'Nairobi West',  k:/\bnairobi west\b/,                              lat:-1.3150, lng:36.8180 },
    { n:'Madaraka',      k:/\bmadaraka\b/,                                  lat:-1.3050, lng:36.8250 },
    { n:'Kibera',        k:/\bkibera\b/,                                    lat:-1.3130, lng:36.7860 },
    { n:'Dagoretti',     k:/\bdagoretti\b/,                                 lat:-1.2930, lng:36.7300 },
    { n:'Kawangware',    k:/\bkawangware\b/,                                lat:-1.2830, lng:36.7440 },
    { n:'Kangemi',       k:/\bkangemi\b/,                                   lat:-1.2670, lng:36.7440 },
    { n:'Uthiru',        k:/\buthiru\b/,                                    lat:-1.2680, lng:36.7200 },
    { n:'Gigiri',        k:/\bgigiri\b/,                                    lat:-1.2340, lng:36.8100 },
    { n:'Runda',         k:/\brunda\b/,                                     lat:-1.2170, lng:36.8180 },
    { n:'Muthaiga',      k:/\bmuthaiga\b/,                                  lat:-1.2490, lng:36.8330 },
    { n:'Limuru',        k:/\blimuru\b/,                                    lat:-1.1120, lng:36.6420 },
    { n:'Kangundo',      k:/\bkangundo\b/,                                  lat:-1.2980, lng:37.3480 },
    { n:'Kitui',         k:/\bkitui\b/,                                     lat:-1.3670, lng:38.0100 },
    { n:'Naivasha',      k:/\bnaivasha\b/,                                  lat:-0.7170, lng:36.4310 },
    { n:'Nakuru',        k:/\bnakuru\b/,                                    lat:-0.3030, lng:36.0800 },
    { n:'Eldoret',       k:/\beldoret\b/,                                   lat: 0.5140, lng:35.2700 },
    { n:'Kisumu',        k:/\bkisumu\b/,                                    lat:-0.0917, lng:34.7680 },
    { n:'Kisii',         k:/\bkisii\b/,                                     lat:-0.6810, lng:34.7670 },
    { n:'Migori',        k:/\bmigori\b/,                                    lat:-1.0630, lng:34.4730 },
    { n:'Kakamega',      k:/\bkakamega\b/,                                  lat: 0.2827, lng:34.7519 },
    { n:'Bungoma',       k:/\bbungoma\b/,                                   lat: 0.5630, lng:34.5600 },
    { n:'Kericho',       k:/\bkericho\b/,                                   lat:-0.3670, lng:35.2830 },
    { n:'Nyeri',         k:/\bnyeri\b/,                                     lat:-0.4200, lng:36.9480 },
    { n:'Nanyuki',       k:/\bnanyuki\b/,                                   lat: 0.0170, lng:37.0730 },
    { n:'Meru',          k:/\bmeru\b/,                                      lat: 0.0470, lng:37.6500 },
    { n:'Embu',          k:/\bembu\b/,                                      lat:-0.5310, lng:37.4500 },
    { n:"Murang'a",      k:/\bmurang'?a\b/,                                 lat:-0.7210, lng:37.1520 },
    { n:'Nyahururu',     k:/\bnyahururu\b/,                                 lat: 0.0360, lng:36.3630 },
    { n:'Mombasa',       k:/\bmombasa\b/,                                   lat:-4.0435, lng:39.6682 },
    { n:'Malindi',       k:/\bmalindi\b/,                                   lat:-3.2180, lng:40.1170 },
    { n:'Kilifi',        k:/\bkilifi\b/,                                    lat:-3.6300, lng:39.8500 },
    { n:'Voi',           k:/\bvoi\b/,                                       lat:-3.3960, lng:38.5560 },
    { n:'Garissa',       k:/\bgarissa\b/,                                   lat:-0.4530, lng:39.6460 }
  ];

  /* The host brands riders use as landmarks: "the Total on Outering". */
  var PARTNERS = [
    { n:'TotalEnergies',   k:/\btotal ?energies\b|\btotal\b/ },
    { n:'Shell',           k:/\bshell\b/ },
    { n:'Rubis',           k:/\brubis\b/ },
    { n:'Quickmart',       k:/\bquick ?mart\b/ },
    { n:'Sahara Energy',   k:/\bsahara\b/ },
    { n:'Stanchard',       k:/\bstanchard\b/ },
    { n:'Wetu',            k:/\bwetu\b/ }
  ];

  var ACTIVE_COUNTRY = /\bkenya\b|\bkenyan\b/;
  var OTHER_COUNTRY  = /\buganda\b|\brwanda\b|\btanzania\b|\bethiopia\b|\bnigeria\b|\bghana\b|\bburundi\b|\bsouth sudan\b|\bsomalia\b|\bzambia\b|\bmalawi\b|\bcongo\b|\bdrc\b|\bsouth africa\b|\begypt\b|\bmorocco\b|\bzimbabwe\b|\bmozambique\b|\bbotswana\b|\bnamibia\b|\bsenegal\b|\bivory coast\b|\bcameroon\b|\bangola\b|\bindia\b|\bnigeria\b|\bdubai\b|\buae\b|\buk\b|\busa\b|\bamerica\b/;

  /* ==========================================================================
     CATEGORY FALLBACKS
     Used when the question is understood but the knowledge base holds no
     verified answer. Never answered from general knowledge or inference.
     ========================================================================== */
  /* ==========================================================================
     AFTER-SALES: PARTS CATALOGUE
     Roam After-Sales Parts and Services Catalogue, period Q3 to Q4 2025.
     Prices include VAT. p = part, r = repair/labour, t = total.
     This is a price reference, NOT an inventory system and NOT a
     compatibility guide. Never claim stock, fitment or delivery from it.
     ========================================================================== */

  var PARTS = [
    {n:'10000003.A1',d:'10A Blade Fuse',p:11.6,r:100,t:111.6},
    {n:'10000091.A1',d:'Axle Adjustment Bracket Assembly LH',p:116,r:200,t:316},
    {n:'10000092.A1',d:'Axle Adjustment Bracket Assembly RH',p:104.4,r:200,t:304.4},
    {n:'10000093.A1',d:'Axle Rear Wheel',p:359.6,r:200,t:559.6},
    {n:'10000096.A1',d:'Ball Bearing (6301)',p:580,r:300,t:880},
    {n:'10000097.A1',d:'Ball Bearing (close to coupling)',p:348,r:300,t:648},
    {n:'10000100.B1',d:'Battery Charger (SuperPack 6 Amp WT480W - FPC V1.0.2)',p:5800,r:0,t:5800},
    {n:'10000100.D1',d:'Battery Charger (SuperPack 10 Amp WT750W - FPC V1.0.4)',p:12180,r:0,t:12180},
    {n:'10001403.C1',d:'Battery Charger Assembly (SuperPack - FPC V1.2.2)',p:12180,r:0,t:12180},
    {n:'10000114.C1',d:'Battery Harness Assembly (Multicore)',p:5220,r:200,t:5420},
    {n:'10000119.A1',d:'Bearing Cone',p:580,r:200,t:780},
    {n:'10000131.A1',d:'Brake Pedal Assembly',p:1508,r:100,t:1608},
    {n:'10000132.A1',d:'Brake Pedal Return Spring',p:116,r:100,t:216},
    {n:'10000170.A1',d:'Cage Bearing',p:139.2,r:200,t:339.2},
    {n:'10000177.B1',d:'Centre Stand Assembly (Custom)',p:1508,r:100,t:1608},
    {n:'10000178.A1',d:'Centre Stand Axle',p:185.6,r:100,t:285.6},
    {n:'10000179.A1',d:'Centre Stand Rubber Damper',p:58,r:100,t:158},
    {n:'10000180.A1',d:'Centre Stand Spring (TVS Spec)',p:174,r:100,t:274},
    {n:'10000187.A1',d:'Collar Coupling Side',p:174,r:100,t:274},
    {n:'10000204.A1',d:'Contactor Assembly',p:6032,r:300,t:6332},
    {n:'10001566.A1',d:'Contactor (72V,100Amp)',p:6032,r:300,t:6332},
    {n:'10002004.A1',d:'Control Handle Left Hand - Grip and Switch Kit',p:1276,r:200,t:1476},
    {n:'10000211.A1',d:'Controller Antitheft Harness',p:348,r:0,t:348},
    {n:'10000487.C1',d:'Rear Wheel Coupling Assembly V3.0',p:1740,r:300,t:2040},
    {n:'10000238.A1',d:'DC-DC Converter Assembly',p:928,r:300,t:1228},
    {n:'10000250.D1',d:'DKD Display Mount (Rev D)',p:696,r:200,t:896},
    {n:'10000252.B1',d:'DKD Display Screen Module V2',p:6380,r:100,t:6480},
    {n:'10001997.A1',d:'Headlight and Fairing Mounting Bracket Kit.',p:6380,r:200,t:6580},
    {n:'10000253.A1',d:'Dust Cover Rear',p:23.2,r:200,t:223.2},
    {n:'10000259.C1',d:'Electric Motor Assembly V2 with 19MM shaft',p:37120,r:5000,t:42120},
    {n:'10000272.B1',d:'Fairing and Windshield Assy V2',p:928,r:100,t:1028},
    {n:'10000281.B1',d:'Flasher Relay V2',p:278.4,r:100,t:378.4},
    {n:'10000293.A1',d:'FootPeg Bracket Assembly',p:696,r:100,t:796},
    {n:'10000294.A1',d:'FootPeg Rubber Main Step Pad',p:116,r:100,t:216},
    {n:'10000296.B1',d:'Front Brake Cable Assy',p:348,r:100,t:448},
    {n:'10000300.A3',d:'Front Brake Switch Assembly Rework',p:232,r:100,t:332},
    {n:'10000304.A1',d:'Front Fork Bellow',p:290,r:200,t:490},
    {n:'10000334.A1',d:'Headlight Bracket',p:3480,r:200,t:3680},
    {n:'10000308.B1',d:'Front Hub Shoe Plate Assembly V2.0',p:1392,r:100,t:1492},
    {n:'10000309.C1',d:'Front Indicators V3',p:406,r:100,t:506},
    {n:'10000313.B1',d:'Front Wheel Axle Kit',p:348,r:200,t:548},
    {n:'10000314.B1',d:'Front Wheel Metallic Spacer',p:208.8,r:200,t:408.8},
    {n:'10000327.B1',d:'Handle Bar Black V1.1 (Custom)',p:928,r:200,t:1128},
    {n:'10000329.A1',d:'Handle Bar Clamp Kit',p:580,r:100,t:680},
    {n:'10000333.A1',d:'Headlight Assembly',p:8340.4,r:100,t:8440.4},
    {n:'10000380.C1',d:'Horn V3',p:464,r:100,t:564},
    {n:'10000386.A3',d:'Ignition Switch Assembly Rework',p:928,r:200,t:1128},
    {n:'10000408.A1',d:'Left Hand Holder Mirror Mount',p:174,r:100,t:274},
    {n:'10000412.A1',d:'Lower Front Fender Assembly',p:2088,r:100,t:2188},
    {n:'10000418.D1',d:'Main Harness V4.0',p:5800,r:300,t:6100},
    {n:'10000419.B1',d:'Main Roam Air Frame Assy V1.2 (Abuja)',p:34800,r:5000,t:39800},
    {n:'10000423.A1',d:'Motor Cable Sensor',p:928,r:100,t:1028},
    {n:'10000425.A1',d:'Motor Mount Bracket LH',p:580,r:200,t:780},
    {n:'10000426.A1',d:'Motor Mount Bracket RH',p:580,r:200,t:780},
    {n:'10000430.A1',d:'Nut brake adjuster (30191036)',p:58,r:100,t:158},
    {n:'10000454.A1',d:'Pin (30191038)',p:23.2,r:100,t:123.2},
    {n:'10000468.A1',d:'Push Clip',p:29,r:100,t:129},
    {n:'10000472.B1',d:'Rear Axle Sleeve Kit',p:580,r:300,t:880},
    {n:'10000473.B1',d:'Rear Brake Panel Assembly V2.0',p:1508,r:200,t:1708},
    {n:'10000478.B1',d:'Rear Foot Brake Switch w/o Spring',p:174,r:200,t:374},
    {n:'10001968.A1',d:'Rear Foot Brake Switch Spring (Cozy Frame)',p:174,r:200,t:374},
    {n:'10000481.A1',d:'Rear Rim (Custom)',p:4454.4,r:200,t:4654.4},
    {n:'10000486.A1',d:'Rear Wheel Collar',p:406,r:200,t:606},
    {n:'10000488.A1',d:'Rear Wheel Coupling Rubber',p:348,r:200,t:548},
    {n:'10000491.A1',d:'Relay, 12V, 40A, 4 Term',p:232,r:100,t:332},
    {n:'10000496.B1',d:'Right Hand Mirror Holder Assembly',p:406,r:100,t:506},
    {n:'10001004.A1',d:'Seat Assembly (Custom)',p:4176,r:100,t:4276},
    {n:'10000500.B1',d:'Side Mirrors Set V2',p:580,r:100,t:680},
    {n:'10000503.B1',d:'Side Stand Spring',p:174,r:100,t:274},
    {n:'10000529.A1',d:'Swing Arm Assembly',p:4060,r:600,t:4660},
    {n:'10000534.B1',d:'Tail Light',p:464,r:200,t:664},
    {n:'10000566.C1',d:'Throttle Switch Assembly V2',p:928,r:100,t:1028},
    {n:'10000577.A1',d:'Upper Front Fender Assembly',p:1276,r:100,t:1376},
    {n:'10000596.A1',d:'Bearing Sprocket Side (6202)',p:464,r:300,t:764},
    {n:'10000598.A1',d:'Bearing Brake Side (6302)',p:638,r:300,t:938},
    {n:'10000617.A1',d:'Shoe Brake',p:580,r:200,t:780},
    {n:'10000727.A1',d:'Rear Shock Absorber Assy (Custom)',p:1183.2,r:200,t:1383.2},
    {n:'10000748.A1',d:'Spare part only Swingarm Bush',p:348,r:600,t:948},
    {n:'10000870.A1',d:'USB Charge Port (12V E2 - Round)',p:348,r:100,t:448},
    {n:'10000951.A1',d:'Pre-charge Circuit Assembly',p:290,r:200,t:490},
    {n:'10001005.C2',d:'Electronics Box Enclosure KIT V1.4 (Fibre-Reinforced Plastic)',p:1740,r:100,t:1840},
    {n:'10001023.A1',d:'Front Rim (Custom)',p:4060,r:300,t:4360},
    {n:'10001025.B1',d:'Riders Footrest LH & Side Stand Assembly (Custom)',p:1972,r:100,t:2072},
    {n:'10001028.A1',d:'Safety Bar',p:2320,r:100,t:2420},
    {n:'10001039.C1',d:'Passenger Footrest LH',p:3480,r:100,t:3580},
    {n:'10001040.C1',d:'Passenger Footrest RH',p:3480,r:100,t:3580},
    {n:'10001060.C1',d:'Rear Carrier V3.1 (Custom)',p:4060,r:200,t:4260},
    {n:'10001138.B1',d:'Front Tyre Off Road Tread V2 (Tubeless)',p:4060,r:100,t:4160},
    {n:'10001140.A1',d:'Tubeless Rim Valve',p:116,r:300,t:416},
    {n:'10001154.A1',d:'Chain & Sprocket Service Kit',p:1809.6,r:100,t:1909.6},
    {n:'10001269.A2',d:'Lock (Evergood E12)',p:812,r:100,t:912},
    {n:'10001285.A1',d:'Chain Guard - Front',p:464,r:100,t:564},
    {n:'10001286.A1',d:'Chain Guard - Rear',p:580,r:100,t:680},
    {n:'10001288.A1',d:'Rear Fender & Mudflap Assembly',p:2436,r:100,t:2536},
    {n:'10001394.A1',d:'GPS - Mounting Bracket Assembly (Roam)',p:11600,r:200,t:11800},
    {n:'10001411.A1',d:'Branded Space Tank Assembly (Roam)',p:9280,r:100,t:9380},
    {n:'10001456.A1',d:'Electric Motor Controller + CONFIG',p:20880,r:300,t:21180},
    {n:'10001503.A1',d:'Battery SOC Display Screen',p:1508,r:1200,t:2708},
    {n:'10001568.A1',d:'Timer Relay 4 pin 12V 40A',p:928,r:100,t:1028},
    {n:'10001581.B1',d:'Headlight Mounting Bracket V3.0 (Custom)',p:2320,r:200,t:2520},
    {n:'10001583.A1',d:'Front Fork Struts Set (Custom)',p:11600,r:200,t:11800},
    {n:'10001584.A1',d:'Lower Triple Clamp V1.0',p:928,r:200,t:1128},
    {n:'10001076.A1',d:'Battery Compartment (Single Door: No Lock & Latch)',p:4060,r:200,t:4260},
    {n:'10001632.A1',d:'Battery DC Male Header Connector Assembly',p:4640,r:1200,t:5840},
    {n:'10001641.A1',d:'Battery BMS CAN/Rs485/UART',p:13340,r:1200,t:14540},
    {n:'10001643.A1',d:'Battery Screen to BMS Connector Cables',p:116,r:1200,t:1316},
    {n:'10001691.A1',d:'Torque Rod OTS (BJJ)',p:580,r:100,t:680},
    {n:'10001692.A1',d:'Rear Brake Adjustment Bracket',p:290,r:100,t:390},
    {n:'10001921.A1',d:'Roam Air Vinyl kit',p:249.4,r:100,t:349.4},
    {n:'10001922.A1',d:'Handle Washer and Damper Kit',p:348,r:100,t:448},
    {n:'10001932.A1',d:'Fairing and Windshield Service Kit',p:580,r:100,t:680},
    {n:'',d:'Shaft Replacement',p:11600,r:1800,t:13400}
  ];
  var SERVICES = [
    { d:'Simple Assessment',       t:0    },
    { d:'In-Depth Troubleshooting',t:300  },
    { d:'Battery Assessment',      t:1000 },
    { d:'Accident Assessment',     t:1000 }
  ];

  /* A stable internal key for every catalogue row. Almost every part has a
     number, but one service line ("Shaft Replacement") does not, so the cart
     and the browse list key off `id` rather than the part number itself. */
  PARTS.forEach(function (p, i) { p.id = p.n || 'ROAM-' + i; });

  /* Shelves for the browsable catalogue. First match wins, so the order here
     matters: "Headlight and Fairing Mounting Bracket" belongs under lights,
     not body panels, and "Centre Stand Axle" belongs with the stand rather
     than with the wheel axles. */
  var PART_CATS = [
    { n:'Brakes',                m:/brake|shoe/ },
    { n:'Battery & Charging',    m:/^battery|charger|bms|\bsoc\b|pre-charge|contactor|dc-dc|usb charge/ },
    { n:'Motor & Drivetrain',    m:/motor|controller|chain|sprocket|coupling|torque rod|shaft/ },
    { n:'Lights & Indicators',   m:/light|indicator|flasher|horn/ },
    { n:'Body & Frame',          m:/centre stand|side stand|fender|fairing|windshield|seat|carrier|footrest|footpeg|foot peg|frame|vinyl|space tank|safety bar|guard|mudflap|compartment|enclosure|electronics box/ },
    { n:'Wheels & Tyres',        m:/wheel|tyre|rim|axle|bearing|valve|hub|collar|spacer|dust cover|cage/ },
    { n:'Suspension & Steering', m:/shock|fork|handle ?bar|triple clamp|swing ?arm|bush|damper/ },
    { n:'Controls & Cockpit',    m:/display|screen|\bgps\b|\busb\b|lock|mirror|throttle|grip|handle washer/ },
    { n:'Electrics & Wiring',    m:/harness|fuse|relay|switch|ignition|converter|circuit|connector|wiring|antitheft|timer|cable/ }
  ];
  var PART_CAT_OTHER = 'Fasteners & Small Parts';

  function categoryOf(p) {
    var s = p.d.toLowerCase();
    for (var i = 0; i < PART_CATS.length; i++) if (PART_CATS[i].m.test(s)) return PART_CATS[i].n;
    return PART_CAT_OTHER;
  }

  /* [{ name, items }] in shelf order, optionally narrowed to a search term.
     Categories that match nothing are dropped rather than shown empty. */
  function partsByCategory(filter) {
    var order = PART_CATS.map(function (c) { return c.n; }).concat([PART_CAT_OTHER]);
    var buckets = {}, f = (filter || '').trim().toLowerCase();
    PARTS.forEach(function (p) {
      if (f && p.d.toLowerCase().indexOf(f) === -1 && p.id.toLowerCase().indexOf(f) === -1) return;
      var c = categoryOf(p);
      (buckets[c] = buckets[c] || []).push(p);
    });
    return order.filter(function (n) { return buckets[n]; })
                .map(function (n) { return { name: n, items: buckets[n] }; });
  }

  /* Everyday words riders use, mapped to catalogue wording. Lets someone say
     "my front light is broken" or "shock imeharibika" and still find the part. */
  var PART_ALIASES = [
    { w:/head ?light|front light|head lamp|taa ya mbele/, t:'headlight' },
    { w:/tail ?light|rear light|brake light/,             t:'tail light' },
    { w:/indicator|blinker|turn signal/,                  t:'indicator' },
    { w:/\bhorn\b|hooter/,                                t:'horn' },
    { w:/\bmirror/,                                       t:'mirror' },
    { w:/shock|suspension|rear shock/,                    t:'shock absorber' },
    { w:/\bfork\b/,                                      t:'fork' },
    { w:/brake pedal/,                                    t:'brake pedal' },
    { w:/brake cable/,                                    t:'brake cable' },
    { w:/brake shoe|shoe brake/,                          t:'shoe brake' },
    { w:/\bbrakes?\b/,                                    t:'brake' },
    { w:/\bchain\b/,                                      t:'chain' },
    { w:/sprocket/,                                       t:'sprocket' },
    { w:/\btyre|tire\b/,                                  t:'tyre' },
    { w:/\brim\b|wheel rim/,                              t:'rim' },
    { w:/\bseat\b/,                                       t:'seat' },
    { w:/\bcharger\b|charging brick/,                     t:'battery charger' },
    { w:/\bdisplay\b|screen|dashboard|speedo/,            t:'display' },
    { w:/\bmotor\b/,                                      t:'electric motor' },
    { w:/controller/,                                     t:'controller' },
    { w:/\bfuse\b/,                                       t:'fuse' },
    { w:/\bgps\b|tracker/,                                t:'gps' },
    { w:/\bharness\b|wiring/,                             t:'harness' },
    { w:/\bstand\b|kickstand/,                            t:'stand' },
    { w:/carrier|rack/,                                   t:'carrier' },
    { w:/\bfender\b|mudguard|mudflap/,                    t:'fender' },
    { w:/foot ?peg|footrest/,                             t:'footrest' },
    { w:/\block\b/,                                       t:'lock' },
    { w:/usb|phone charg/,                                t:'usb' },
    { w:/\bframe\b/,                                      t:'frame' },
    { w:/swing ?arm/,                                     t:'swing arm' },
    { w:/handle ?bar|handlebar/,                          t:'handle bar' },
    { w:/throttle/,                                       t:'throttle' },
    { w:/ignition|key switch/,                            t:'ignition' },
    { w:/space tank|storage/,                             t:'space tank' },
    { w:/windshield|fairing|wind screen/,                 t:'fairing' },
    { w:/\bbms\b/,                                        t:'bms' },
    { w:/\bbearing\b/,                                    t:'bearing' },
    { w:/vinyl|sticker|decal/,                            t:'vinyl' },
    { w:/safety bar|crash bar/,                           t:'safety bar' }
  ];

  /* Swahili and Sheng words that mean something is broken. */
  var BROKEN = /imeharibika|imevunjika|haifanyi|broken|damaged|faulty|cracked|not working|imepotea|nimepoteza|imeisha|worn out|need(s)? (a )?new|replac(e|ing|ement)|imechoka|inahitaji/;

  var FALLBACK = {
    location:
      "I don't have a confirmed Roam location at {x} in my current location data.\n" +
      'Tell me the nearest area or town and I will find the closest listed Roam Hub, or ' +
      'WhatsApp or call Roam on ' + PHONE + ' to confirm.',
    country:
      'Roam is currently available in Kenya. I do not have confirmed commercial availability for {x} at this time.\n' +
      'Please contact us on ' + PHONE + ' for the latest expansion information.',
    pricing:
      "I don't have a confirmed current price for that configuration.\n" +
      'Please contact Roam on ' + PHONE + ' for the latest price.',
    financing:
      "Financing depends on the financier and package, and I don't have enough verified information to confirm that specific option.\n" +
      'Please contact Roam on ' + PHONE + '.',
    technical:
      "I don't have a verified answer to that technical question in my current knowledge base.\n" +
      'Please contact the Roam team on ' + PHONE + ' for confirmation.',
    promotion:
      "I don't have a confirmed current promotion for that offer.\n" +
      'Please contact Roam on ' + PHONE + ' for the latest information.',
    colour:
      "I don't have confirmed current colour options in my knowledge base.\n" +
      'Please contact Roam on ' + PHONE + ' and we will confirm the available colours.',
    hours:
      "I don't have confirmed opening hours for our shops in my current information.\n" +
      'The sales line is open Mon–Fri, 9am–5pm. Call ' + PHONE + ' and we will confirm shop hours for you.',
    account:
      'That one needs a person, because it depends on your own account and paperwork.\n' +
      'Please contact Roam on ' + PHONE + ' and the team will check it for you.',
    fault:
      'Sorry to hear that. Please contact the Roam team on ' + PHONE + ' straight away so they can help you properly.',
    general:
      "I want to get this exactly right for you rather than guess, and I don't have a confirmed answer to that in my current information.\n" +
      'Please WhatsApp or call Roam on ' + PHONE + ' and the team will answer it for you.'
  };

  /* ==========================================================================
     CATEGORY ANSWERS
     One canonical answer per category. Retrieval never crosses categories.
     ========================================================================== */
  var TOPICS = [
    { c:'calculator', a:
      'The calculator works out your own numbers: monthly or daily repayments, ' +
      'charging cost, savings against petrol and total cost of ownership.\n' +
      'Open it below, or tell me what you want to work out and I will answer here.' },

    { c:'financing', a:
      'Up to 97% asset financing, with deposits from KES 15,000 and terms of 12, 18 or 24 months.\n' +
      '• Through M-KOPA, Fortune Credit, Platinum Credit, Watu or Rafiki Bank\n' +
      '• When the loan ends you own the bike **and** the battery\n' +
      'Want to see all the financiers, or work out your own repayment?' },

    { c:'pricing', a:
      'Cash prices for the Roam Air Gen 3:\n' +
      '• KES 296,000 for one battery and one charger\n' +
      '• KES 430,000 for two batteries and two chargers\n' +
      'Would you rather see the financing options?' },

    { c:'charging_cost', a:
      'About KES 1 per kilometre at home, so roughly KES 80 to fill one battery for about 80 km.\n' +
      '• A full 160 km day on two batteries: about KES 160\n' +
      '• At a Roam Point: KSh 40/kWh daytime, KSh 25/kWh off-peak\n' +
      'How many kilometres do you ride a day?' },

    { c:'home_charging', a:
      'Yes, you can charge at home.\n' +
      '• Every Roam Air comes with a portable charger\n' +
      '• It plugs into a standard wall outlet\n' +
      '• The battery lifts out so you can carry it indoors\n' +
      '• About 3 to 4 hours for a full battery\n' +
      'Want to know what that costs?' },

    { c:'charging_time', a:
      'Charging times for the Roam Air Gen 3:\n' +
      '• At home from a standard outlet: about 3 to 4 hours for a full battery\n' +
      '• Fast charging adds over 1 km of range per minute\n' +
      '• 20 to 80 percent in under 45 minutes at a Roam Point or Roam Hub\n' +
      'Want to know what charging costs?' },

    { c:'charging_where', a:
      'Three ways to charge.\n' +
      '• At home with the portable charger, always the cheapest\n' +
      '• Roam Point: self-service fast charging, pay by mobile money in the Roam App\n' +
      '• Roam Hub: charging, battery rental and after-sales, located across Nairobi\n' +
      'Want to know what each one costs?' },

    { c:'battery_owner', a:
      'You own your battery outright. No swapping, no waiting.\n' +
      '• Once financing is complete the bike and the battery are yours\n' +
      '• No ongoing swap fees\n' +
      '• That ownership is what protects your resale value\n' +
      'Want to see the financing plans?' },

    { c:'battery_specs', a:
      'The Roam Air Gen 3 battery:\n' +
      '• Removable 72V lithium-ion, about 20 kg, like a 20-litre jerrican\n' +
      '• IP67 sealed against dust and water\n' +
      '• Industrial-grade aluminium casing\n' +
      '• GPS tracking and smart telemetry built in\n' +
      '• Guaranteed for 100,000 km\n' +
      'Anything specific you want to know about it?' },

    { c:'range', a:
      'Range on the Roam Air Gen 3:\n' +
      '• Up to 80 km on one battery\n' +
      '• Up to 160 km on two, about Nairobi to Nakuru\n' +
      '• Real range depends on load, terrain, speed and riding style\n' +
      'How far do you ride in a day?' },

    { c:'performance', a:
      'Roam Air Gen 3 performance:\n' +
      '• 3,000W mid-drive motor, 55 Nm of torque\n' +
      '• Top speed 90 km/h, 0 to 60 km/h in 6.9 seconds\n' +
      '• Three riding modes: Eco, Standard and Power\n' +
      '• Reinforced suspension for steep climbs and rough roads\n' +
      'Ready for a free test ride?' },

    { c:'payload', a:
      'Roam Air is made for carrying real working loads.\n' +
      '• Maximum payload 250 kg including rider\n' +
      '• 55 Nm of torque, so it pulls well when loaded\n' +
      '• Widened subframe with standard fixing points for delivery boxes\n' +
      'Carrying something specific? Tell me and I will advise.' },

    { c:'durability', a:
      'Roam Air Gen 3 is built for African road conditions.\n' +
      '• Reinforced chassis tested through 200,000+ duty cycles under load\n' +
      '• Battery sealed to IP67 against dust and water\n' +
      '• Proven across a 6,000 km ride from Nairobi to South Africa\n' +
      'Avoid deep standing water, as with any motorcycle. Anything else?' },

    { c:'savings', a:
      'Save up to 40% a day versus fuel. At 160 km a day:\n' +
      '• Roam Air: about KES 160/day to charge\n' +
      '• Petrol motorcycle: about KES 897/day\n' +
      '• Over KES 100,000 saved a year\n' +
      'What do you spend on petrol a day?' },

    { c:'service', a:
      'Servicing is handled at our Nairobi ride-in, ride-out service centre.\n' +
      '• No oil changes and no spark plugs, there is no petrol engine\n' +
      '• You still service tyres, brakes, chain, suspension and electrics\n' +
      '• Genuine parts and diagnostics at any Roam Hub\n' +
      'For service pricing and intervals, call ' + PHONE + '.' },

    { c:'warranty', a:
      'Roam Air carries a 2-year commercial warranty.\n' +
      '• The Gen 3 battery is guaranteed for 100,000 km\n' +
      '• For what a specific warranty covers in your case, the team will confirm\n' +
      'Call ' + PHONE + ' and they will check it for you.' },

    { c:'solar', a:
      'Yes, a Roam Air can run on solar.\n' +
      '• One rode 6,000 km to South Africa on solar alone\n' +
      '• Home solar must be sized correctly for the charger\n' +
      '• During a blackout you need a backup supply, charging needs electricity\n' +
      'Want us to talk through your setup?' },

    { c:'canopy', a:
      'Roam Canopy is our platform for fleets and financiers.\n' +
      '• Monitor, manage and act on connected fleet information\n' +
      '• Built for businesses, logistics operators and financiers\n' +
      '• Roam Explorer gives location, battery health and usage per bike\n' +
      'How many bikes are you running?' },

    { c:'b2b', a:
      'Yes, we work with fleets.\n' +
      '• Fleet pricing for operators running multiple bikes\n' +
      '• Roam Canopy and Roam Explorer for monitoring and management\n' +
      '• Partners include Bolt, Keep It Cool and Greenspoon\n' +
      'Email sales@roam-electric.com or tell me your fleet size.' },

    { c:'locations', a:
      'Roam locations run from Homabay to Machakos, with most of them across Nairobi.\n' +
      '• Roam Hubs for charging, battery rental, after-sales and shops\n' +
      '• The Nairobi Ride-In Ride-Out Service Centre on Lusaka Road\n' +
      '• Roam Points for 24/7 self-service fast charging\n' +
      'Tell me your area and I will find the closest one.' },

    { c:'upcountry', a:
      'Yes, riders use Roam Air upcountry every day.\n' +
      '• The portable charger works on any standard outlet, anywhere\n' +
      '• A rider crossed Kenya border to border on charging alone\n' +
      '• Roam Hubs are currently Nairobi-based\n' +
      'Tell me your town and a rep will confirm what is nearest to you.' },

    { c:'test_ride', a:
      'Test rides are free, with no commitment.\n' +
      '• Tap the button below to book a date\n' +
      '• Or call ' + PHONE + ', Mon–Fri 9am–5pm\n' +
      '• WhatsApp works too: wa.me/' + WHATSAPP + '\n' +
      'Ready to pick a date?' },

    { c:'buses', a:
      'Our electric buses are not available to order at the moment.\n' +
      '• Bus sales are on hold while we focus on Roam Air\n' +
      '• Leave your details and we will contact you when that changes\n' +
      'Would you like a rep to reach out?' },

    { c:'country', a:
      'Roam is available in Kenya only at the moment.\n' +
      '• Sales, servicing, charging and financing are all Kenya-based\n' +
      '• We plan to expand across East Africa, then wider into Africa\n' +
      '• Nothing is confirmed for other countries yet\n' +
      'If you are outside Kenya, leave your details and we will contact you when that changes.' },

    { c:'manufacturing', a:
      'Roam Air is designed, engineered and assembled in Kenya.\n' +
      '• Built at Roam Park, our 10,000 sqm facility in Nairobi\n' +
      '• Eventual capacity for 50,000 motorcycles a year\n' +
      '• Over 7,000 motorcycles built to date\n' +
      'Want to see how it is made?' },

    { c:'legal', a:
      'Registration and insurance work exactly as with a petrol motorcycle.\n' +
      '• Roam Air is road-legal and registers with NTSA normally\n' +
      '• You will need standard motorcycle insurance\n' +
      '• Financing partners often bundle insurance into the plan\n' +
      'Your financier will confirm what their plan includes.' },

    { c:'resale', a:
      'You own the bike outright once the loan is cleared.\n' +
      '• You own the battery too, unlike battery-swap models\n' +
      '• That ownership is what holds the resale value\n' +
      '• Service history is tracked, which helps at resale\n' +
      'Want to see how the ownership maths compares?' },

    { c:'buy', a:
      'Yes, you can buy a Roam Air today.\n' +
      '• Pay cash, or finance it from a KES 15,000 deposit\n' +
      '• Buy at Roam Shop Thika, Roam Shop Machakos or our Nairobi centre\n' +
      '• Most people book a free test ride first\n' +
      'Shall I take your number so a rep can set it up?' },

    { c:'sales_location', a:
      'Here is where you can buy a Roam Air.\n' +
      '• Roam Shop Thika\n' +
      '• Roam Shop Machakos\n' +
      '• Roam Nairobi Service Centre\n' +
      '• Or call ' + PHONE + ' and a rep will arrange it wherever you are\n' +
      'Want to book a free test ride at one of them?' },

    { c:'delivery', a:
      'Roam Air is available now.\n' +
      '• Collect from our Nairobi facility, or arrange delivery\n' +
      '• Financing approval is usually the longest step\n' +
      '• Book a free test ride first if you have not ridden one\n' +
      'For current stock at a specific shop, call ' + PHONE + '.' },

    { c:'theft', a:
      'Every battery is GPS-tracked in real time through the Roam App.\n' +
      '• Live health monitoring and anti-theft alerts\n' +
      '• Remote shut-off is supported through Roam Explorer\n' +
      'If something has been stolen, call ' + PHONE + ' straight away.' },

    { c:'careers', a:
      'We are hiring across engineering, manufacturing and after-sales.\n' +
      '• Values: Dignity, Discovery, Drive, Delivery\n' +
      '• Apply at roam-electric.com/careers\n' +
      'Want to know about a specific role?' },

    { c:'technology', a:
      'Roam Air Gen 3 is a connected motorcycle.\n' +
      '• GPS tracking and smart telemetry built into the battery\n' +
      '• Remote shut-off and anti-theft alerts\n' +
      '• Roam Explorer works on 2G, 3G and 4G, so it holds up in rural areas\n' +
      '• Regenerative braking, LED lighting and USB phone charging\n' +
      'Anything specific you want to know?' },

    { c:'rider_stories', a:
      'Real riders, real distances.\n' +
      '• 6,000 km from Nairobi to South Africa on solar alone\n' +
      '• A 900 km border-to-border ride from Malaba to Mombasa\n' +
      '• 1,600 km from Nairobi to Addis Ababa\n' +
      'Want to try one yourself?' },

    { c:'care_range', a:
      'Getting more range out of a charge comes down to how you ride.\n' +
      '• Hold a steady, moderate speed, high speed uses the most energy\n' +
      '• Accelerate smoothly rather than hard off the line\n' +
      '• Carry only the load you need\n' +
      '• Use Eco mode for efficiency, Power only for heavy loads or steep hills\n' +
      '• Use regenerative braking, and skip bulky add-ons that catch the wind\n' +
      'Want the charging cost worked out for your daily distance?' },

    { c:'regen', a:
      'Regenerative braking turns some of your speed back into charge.\n' +
      '• Brake lightly to engage it, the mechanical brakes take over when you brake harder\n' +
      '• Coasting without accelerating also recovers energy\n' +
      '• It does not work at 100 percent charge, and resumes below 90 percent\n' +
      'If braking ever feels wrong, stop safely and call ' + PHONE + '.' },

    { c:'battery_care', a:
      'Looking after the battery keeps your range and your resale value.\n' +
      '• Charge from a standard socket with the approved portable charger\n' +
      '• It is safe to leave it charging overnight with the approved charger\n' +
      '• Never charge near water or puddles, keep the connector clean and dry\n' +
      '• Do not cover the charger while it is plugged in, it needs to stay cool\n' +
      '• Check it is actually charging before you leave it\n' +
      'Anything else about charging?' },

    { c:'washing', a:
      'Washing a Roam Air is easy, just a few rules.\n' +
      '• Take the battery out first\n' +
      '• Keep water off the throttle controls and the battery connectors\n' +
      '• No high-pressure washer, it damages paint and electrics\n' +
      '• Check for loose bolts afterwards\n' +
      '• Lubricate the chain after every wash' },

    { c:'maintenance_tips', a:
      'Your regular checks on a Roam Air:\n' +
      '• Tyre pressure: 28 PSI front, 32 PSI rear\n' +
      '• Chain: check slack every 500 km, about 20 mm of movement\n' +
      '• Lubricate the chain after every wash\n' +
      '• Check for loose bolts or missing parts regularly\n' +
      '• If the spanner light shows, check brakes, chain, battery connector and tyres\n' +
      'If the warning stays on, call ' + PHONE + '.' },

    { c:'safety', a:
      'Riding safely on a Roam Air:\n' +
      '• Helmet on with the chin strap fastened, plus gloves, closed shoes and a jacket\n' +
      '• Bright or reflective clothing, daytime running lights on\n' +
      '• Check tyres, brakes and lights before every ride\n' +
      '• Both hands on the bars, no phone while riding, never ride impaired\n' +
      '• In rain, dust or wind slow down and leave more following distance\n' +
      'Carry your emergency contact and blood type with you.' },

    { c:'dashboard', a:
      'What the dashboard is telling you:\n' +
      '• Motor fault: do not keep riding until it is sorted\n' +
      '• Throttle fault: stop safely and get service help\n' +
      '• Spanner: a powertrain maintenance issue needs checking\n' +
      '• Battery bar, charge, power meter, beam and indicators are status only\n' +
      'For anything to do with brakes, motor, throttle, battery or overheating, stop safely and call ' + PHONE + '.' },

    { c:'hub_rental', a:
      'Roam Hubs do fast charging, battery rentals, maintenance and rider support.\n' +
      '• Battery rental is KES 20 an hour\n' +
      '• Return rental batteries when you finish so other riders can use them\n' +
      '• Maximum rental period is 48 hours\n' +
      'Call ' + PHONE + ' for the Hub nearest you.' },

    { c:'general_roam', a:
      'Roam designs and builds electric vehicles for Africa, in Africa.\n' +
      '• Based in Nairobi, Kenya\n' +
      '• Roam Air is our electric motorcycle, built for commercial riders\n' +
      '• Over 7,000 motorcycles built to date\n' +
      'What would you like to know about?' }
  ];

  /* ==========================================================================
     INTENT CLASSIFIER
     Ordered most specific first. The first match decides which category the
     question belongs to, and retrieval is then limited to that category.
     If nothing matches, the assistant escalates rather than guessing.
     ========================================================================== */
  var INTENTS = [
    // Urgent and unambiguous first
    { c:'fault',         m:/not (working|charging|starting)|won'?t (start|charge|turn on)|broken|faulty|fault\b|stopped working|problem with my|my bike (is|has)|error code|warning light/ },
    { c:'theft',         m:/stolen|theft|thief|robbed|snatched|lost my (bike|battery)/ },
    { c:'hours',         m:/what time|opening hours|open(ing)? time|when (do|are) you (open|close)|are you open|closing time|working hours|business hours|open on (saturday|sunday|weekend)/ },
    { c:'colour',        m:/colou?rs?\b|(have|get|come in|available in|any)[\s\S]{0,14}\b(red|black|white|blue|orange|silver|grey|gray|yellow)\b/ },
    { c:'test_ride',     m:/test ?ride|book.{0,15}ride|demo ride|try (it|the bike|one|a roam|the roam)\b|ride one\b|take it for a ride|for a ride\b|ride it first|test the bike|try the roam/ },
    { c:'buses',         m:/\bbus(es)?\b|matatu|shuttle|roam rapid|roam move|coach/ },
    { c:'careers',       m:/career|\bjob\b|hiring|vacanc|work (at|for) roam|internship|apply for a (job|role)/ },

    // Business enquiries outrank consumer purchase wording
    { c:'canopy',        m:/canopy|fleet (platform|software|manage|monitor|tracking)|manage my fleet|financier portal|track (my )?fleet/ },
    { c:'b2b',           m:/\bfleet\b|\bb2b\b|\bbulk\b|corporate|multiple bikes|how many bikes|my (company|business)|our (company|business)|for (a|our|my) (company|business)|business (purchase|deal|pricing|enquiry|options)|work with (businesses|companies)|suppl(y|ier).{0,25}(company|business|fleet)|\d+\s*(bikes|motorcycles)/ },

    { c:'country',       m:/outside kenya|other countr|which countr|abroad|export|international|another country/ },

    // Range before charging, so "distance on a full charge" is a range question
    { c:'care_range',    m:/(more|better|increase|improve|maximi[sz]e|extend|save|conserve)[\s\S]{0,20}(range|batter)|range[\s\S]{0,20}(tips?|better|improve|last longer)|ride (farther|further)|use less (power|energy|battery)|efficient riding|eco mode|riding modes?|batter[\s\S]{0,20}drain/ },
    { c:'range',         m:/\brange\b|how far|distance on|kilometres? on|km on (one|a|two|full)|one charge\b|mileage|reach how far|how many (km|kilometres|kilometers)|\bdistance\b/ },

    { c:'charging_cost', m:/(charg\w*|electricit\w*|power|unit|kwh)[\s\S]{0,30}(cost|much|price|expensive|spend|tariff|bill|rate)|(cost|much|price|expensive|spend|pay)[\s\S]{0,30}(charg\w*|electricit\w*|kwh)|\bkwh\b|(fill|filling|top up)[\s\S]{0,20}batter/ },
    { c:'charging_time', m:/(how )?long[\s\S]{0,25}charg|charg\w*[\s\S]{0,15}(time|take|hours?)|full charge|fast charg|charging speed|how (fast|quick)[\s\S]{0,20}charg/ },
    { c:'home_charging', m:/charg\w*[\s\S]{0,20}(at home|home|house|indoors|wall|socket|outlet|plug)|(home|house|indoors)[\s\S]{0,20}charg|\bplug it in\b|normal socket|standard socket|wall socket|special charger|charg\w*[\s\S]{0,25}where i (live|stay)/ },
    { c:'solar',         m:/solar|off.?grid|generator|blackout|power (cut|goes off)|no electricity/ },
    { c:'charging_where',m:/where[\s\S]{0,25}charg|charg\w*[\s\S]{0,20}(station|point|hub|network|location)|roam point|roam hub|swap station|public charging|where.{0,20}(riders )?charge|charging options?\b/ },

    // Purchase family, most specific first
    { c:'sales_location',m:/\bwhere\b[\s\S]{0,30}\b(buy|get|purchase|order|acquire)\b|\b(buy|get|purchase|order|acquire)\b[\s\S]{0,30}\bwhere\b|where (can|do) i (buy|get)|which shop.{0,20}(buy|get)|find a roam (air|bike|motorcycle)/ },
    { c:'financing',     m:/financ|loan|deposit|instal(l)?ment|hire purchase|repay|pay.{0,10}(month|daily|day)|m.?kopa|watu|rafiki|platinum credit|fortune credit|credit\b|afford|own the bike|how much[\s\S]{0,20}(to start|to begin|do i need|upfront|down)|get started|what do i need to (start|begin)/ },
    { c:'pricing',       m:/\bprice\b|pricing|cost of the bike|how much (is|for|does)[\s\S]{0,25}(bike|roam|motorcycle|it|cost)|cash price|buy it outright|\brrp\b|what does it cost|how much is it|\b(roam|roam air|bike|motorcycle)\s+how much/ },
    { c:'buy',           m:/\b(buy|buying|purchase|purchasing|order|acquire)\b|\bi want\b(?!\s+to (know|understand|ask|check|confirm|see if|hear))|\bcan i (get|have|own|take)\b|\bget one\b|\bhow (do|can) i (get|own|order)\b|\bown one\b|\bi need a (roam|bike|motorcycle)\b/ },

    { c:'savings',       m:/save|saving|cheaper|petrol|fuel cost|compare.{0,15}(petrol|fuel)|versus (petrol|fuel)|swap.{0,12}(cost|cheaper)/ },
    { c:'battery_owner', m:/own[\s\S]{0,20}batter|batter[\s\S]{0,20}(mine|own|belong|include|lease|rent)|swap(ping)?\b|rent the batter|lease the batter|keep the batter|pay for the batter|\bown (it|them) outright\b/ },
    { c:'battery_specs', m:/batter[\s\S]{0,25}(weigh|heavy|kg|size|spec|type|made|casing|waterproof|ip67|volt|72v|remov)|(weigh|heavy|how big)[\s\S]{0,20}batter|batter[\s\S]{0,20}(life|last|degrad|cycle|replac|health)|how long[\s\S]{0,20}batter/ },
    { c:'performance',   m:/how fast|top speed|acceleration|\btorque\b|\bmotor\b|horsepower|\bpower\b|climb|hill|riding mode|\bspecs?\b|specification/ },
    { c:'payload',       m:/payload|carry|\bload\b|luggage|cargo|goods|passenger|pillion|\bboda\b|delivery box|how much weight/ },
    { c:'durability',    m:/\brain\b|raining|rainy|\bwet\b|\bwater\b|waterproof|bad weather|wet weather|flood|\bdust\b|\bmud\b|durab|tough|rough road|bad road|pothole|vibration|submerg/ },
    { c:'regen',         m:/regen|regenerative|\bebs\b|engine brak|energy recovery/ },
    { c:'battery_care',  m:/(care|look after|take care|protect|maintain|prolong|damage|safe)[\s\S]{0,25}batter|batter[\s\S]{0,25}(care|look after|protect|prolong|healthy|damage)|overnight charg|charg[\s\S]{0,20}overnight|leave it charging|safe to charge/ },
    { c:'washing',       m:/wash|clean(ing)?\b|jet ?wash|pressure wash|karcha|osha/ },
    { c:'dashboard',     m:/dashboard|warning light|spanner|indicator light|what does the.{0,20}light|error light|motor fault|throttle fault|display shows/ },
    { c:'safety',        m:/safety|\bhelmet\b|protective|ride safe|safe riding|reflective|\bgear\b(?!box)|accident/ },
    { c:'hub_rental',    m:/(rent|rental|hire|borrow)[\s\S]{0,20}batter|batter[\s\S]{0,20}(rent|rental|hire)|hub rental|48 hours/ },
    { c:'maintenance_tips', m:/tyre pressure|tire pressure|\bpsi\b|chain (slack|tension|lubric|adjust)|lubricat|how (do i|to) (look after|maintain|care for)|care tips?|best practice|maintenance tips?|check(list)?\b/ },
    { c:'service',       m:/servic(e|ing)|maintain|maintenance|repair|spare part|breakdown|mechanic|garage|oil change|spark plug|tune.?up/ },
    { c:'warranty',      m:/warrant|guarantee/ },
    { c:'legal',         m:/licen[cs]e|registration|logbook|number plate|ntsa|road.?legal|insur/ },
    { c:'resale',        m:/resale|resell|second hand|trade in|used bike|resell value/ },
    { c:'delivery',      m:/how long.{0,20}deliver|deliver|collect|pick (it )?up|in stock|lead time|when can i get|availab(le|ility) now/ },
    { c:'technology',    m:/\bgps\b|telemetr|track(ing)?\b|roam app|remote shut|connected|iot|regenerative|explorer/ },
    { c:'manufacturing', m:/manufactur|roam park|made in|where.{0,20}(made|built|assembl)|factory|production|assembl/ },
    { c:'upcountry',     m:/upcountry|rural|village|outside nairobi|my town|shags|\bcounty\b/ },
    { c:'rider_stories', m:/rider stor|testimonial|real rider|who (uses|rides)|success stor|expedition|6,?000 ?km|addis|malaba/ },
    { c:'locations',     m:/where (are|is) (you|your|roam)|your (shop|shops|office|offices|location|locations|branch|branches)|roam shop|showroom|service cent(re|er)|where can i (find|see|visit)/ },
    { c:'general_roam',  m:/what is roam|who (are|is) roam|about roam|tell me about roam|^what do you (do|sell|make)\s*\??$|roam electric/ },

    /* Last in the list on purpose. A rider who names a specific subject gets
       that subject's answer with the calculator offered beside it; this only
       catches bare calculator wording with nothing else to go on, so
       "calculator" or "can I calculate?" opens the tool instead of escalating. */
    { c:'calculator',    m:/calculat|\bcalc\b|work out (the|my|some)? ?(cost|number|figure|saving|price)|run the numbers|crunch the numbers|cost tool|finance tool/ }
  ];

  /* Questions the knowledge base does not hold verified answers for. These are
     escalated by category rather than answered from general knowledge. */
  var NOT_APPROVED = [
    { m:/\bkwh\b[\s\S]{0,20}(batter|capacit)|batter[\s\S]{0,20}capacit|how many kwh|battery size in kwh/,       f:'technical' },
    { m:/cycle life|how many (charge )?cycles|charge cycles|degrad/,                                            f:'technical' },
    { m:/(after|past|beyond)[\s\S]{0,15}100,?000 ?km|replace.{0,20}batter.{0,20}cost|cost.{0,20}replace.{0,20}batter|new battery (cost|price)/, f:'technical' },
    { m:/charger[\s\S]{0,20}(amp|input|watt|volt)|how many (amps|watts)|ac input/,                               f:'technical' },
    { m:/servic(e|ing)[\s\S]{0,20}(cost|price|much|interval|every|schedule)|(cost|price|much)[\s\S]{0,20}servic(e|ing)/, f:'technical' },
    { m:/warrant[\s\S]{0,25}(cover|exclude|void|claim|eligib)|is (this|that|it) covered/,                        f:'account'   },
    { m:/(am i|do i|will i|would i)[\s\S]{0,25}(qualif|eligib|approv)|credit (check|score)|early settle|pay (it )?off early|clear (the|my) loan early|hidden (fee|charge)|extra (fee|charge)|other (fees|charges)/, f:'financing' },
    { m:/discount|promo(tion|tional)?\b|special offer|\bany offers?\b|offers?\s+(on|available|running|right now)|deal on|on sale\b|black friday|coupon|voucher/, f:'promotion' },
    { m:/my (data|information|privacy)|data protection|gdpr|who sees my|store my (data|number)/,                 f:'account'   },
    { m:/(work|use|function)[\s\S]{0,25}(offline|no network|without network|no signal)|\bsms\b/,                 f:'technical' }
  ];

  // Buying signals that trigger the lead form
  var INTENT = /financ|loan|deposit|instal|payment|price|pricing|cost|how much|buy|purchas|order|test ride|fleet|afford|interested|get one|where can i|sign up|apply|quote|call me|contact me|\bbus(es)?\b/;

  /* ==========================================================================
     STYLES
     ========================================================================== */
  var CSS = [
'#roam-assistant{',
'  --orange:#ED7D31;--orange-hot:#F27229;--orange-ink:#2A1200;',
'  --ink-900:#0A0B08;--ink-850:#101208;--ink-800:#14170F;--ink-700:#1D2018;',
'  --white:#fff;--dim:rgba(255,255,255,.64);--faint:rgba(255,255,255,.42);',
'  --line:rgba(255,255,255,.10);--line-strong:rgba(255,255,255,.20);',
'  --r-sm:8px;--r-md:14px;--r-lg:20px;',
'  font-family:Montserrat,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
'#roam-assistant *,#roam-assistant *::before,#roam-assistant *::after{box-sizing:border-box;}',

'.rai-launch{position:fixed;bottom:24px;right:24px;z-index:99998;display:inline-flex;align-items:center;gap:10px;height:54px;padding:0 22px 0 20px;border:none;border-radius:999px;cursor:pointer;background:var(--orange);color:var(--orange-ink);font-family:inherit;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;box-shadow:0 10px 30px -8px rgba(237,125,49,.55);transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease,background .15s ease;}',
'.rai-launch:hover{transform:translateY(-2px);background:var(--orange-hot);box-shadow:0 16px 38px -10px rgba(237,125,49,.65);}',
'.rai-launch:active{transform:translateY(0) scale(.98);}',
'.rai-launch svg{width:18px;height:18px;fill:currentColor;flex-shrink:0;}',
'.rai-launch.hidden{opacity:0;pointer-events:none;transform:scale(.9);}',

'.rai-chat{position:fixed;bottom:24px;right:24px;z-index:99999;width:460px;max-width:calc(100vw - 32px);height:720px;max-height:calc(100vh - 48px);border-radius:var(--r-lg);background:var(--ink-900);border:1px solid var(--line);box-shadow:0 40px 90px -20px rgba(0,0,0,.75);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(22px) scale(.98);pointer-events:none;transition:opacity .28s ease,transform .28s cubic-bezier(.2,.8,.2,1);}',
'.rai-chat.open{opacity:1;transform:none;pointer-events:auto;}',

'.rai-header{background:#000;padding:16px 18px 14px;border-bottom:1px solid rgba(255,255,255,.12);flex-shrink:0;}',
'.rai-header-top{display:flex;align-items:center;gap:12px;}',
'.rai-wordmark{height:17px;width:auto;display:block;}',
'.rai-divider{width:1px;height:16px;background:rgba(255,255,255,.22);}',
'.rai-header-label{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.78);}',
'.rai-close{margin-left:auto;background:none;border:none;cursor:pointer;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.55);transition:all .15s ease;padding:0;}',
'.rai-close:hover{background:rgba(255,255,255,.1);color:#fff;}',
'.rai-close svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none;}',
'.rai-status{display:flex;align-items:center;gap:7px;margin-top:9px;font-size:10px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.45);}',
'.rai-dot{width:6px;height:6px;border-radius:50%;background:#35C759;box-shadow:0 0 0 3px rgba(53,199,89,.16);}',

'.rai-messages{flex:1;overflow-y:auto;padding:18px 16px 8px;display:flex;flex-direction:column;gap:14px;background:radial-gradient(90% 60% at 100% 0%,rgba(237,125,49,.07),rgba(237,125,49,0) 70%),var(--ink-900);}',
'.rai-messages::-webkit-scrollbar{width:5px;}',
'.rai-messages::-webkit-scrollbar-track{background:transparent;}',
'.rai-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px;}',

'.rai-row{display:flex;}',
'.rai-row.user{justify-content:flex-end;}',
'.rai-bubble{max-width:88%;padding:13px 16px;font-size:13.5px;line-height:1.55;border-radius:var(--r-md);animation:raiIn .32s cubic-bezier(.2,.8,.2,1) both;}',
'.rai-row.bot .rai-bubble{background:var(--ink-800);border:1px solid var(--line);color:var(--white);border-bottom-left-radius:5px;}',
'.rai-row.user .rai-bubble{background:var(--orange);color:var(--orange-ink);font-weight:600;border-bottom-right-radius:5px;max-width:82%;}',
'@keyframes raiIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}',

'.rai-eyebrow{display:flex;align-items:center;gap:8px;font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--orange);margin-bottom:9px;}',
'.rai-eyebrow::before{content:"";width:16px;height:1px;background:var(--orange);flex-shrink:0;}',

'.rai-lede{font-size:13.5px;line-height:1.55;color:var(--white);}',
'.rai-lede + .rai-list{margin-top:10px;}',
'.rai-list{display:flex;flex-direction:column;gap:7px;}',
'.rai-li{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;color:var(--dim);}',
'.rai-li::before{content:"";width:5px;height:5px;background:var(--orange);flex-shrink:0;margin-top:7px;}',
'.rai-li strong{color:var(--white);font-weight:700;}',
'.rai-cta{margin-top:12px;padding-top:11px;border-top:1px solid var(--line);font-size:12.5px;font-weight:700;color:var(--orange);}',

'.rai-card{background:var(--ink-800);border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;width:100%;animation:raiIn .32s cubic-bezier(.2,.8,.2,1) both;transition:border-color .18s ease,transform .18s ease;}',
'.rai-card:hover{border-color:var(--line-strong);transform:translateY(-2px);}',
'.rai-card-img{width:100%;height:172px;object-fit:cover;display:block;background:var(--ink-700);}',
'.rai-card-body{padding:15px 16px 16px;}',
'.rai-card-title{font-size:13.5px;font-weight:700;color:var(--white);line-height:1.35;margin-bottom:7px;}',
'.rai-card-desc{font-size:12.5px;line-height:1.55;color:var(--dim);}',
'.rai-card-link{display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-size:10.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--orange);text-decoration:none;transition:gap .15s ease;}',
'.rai-card-link:hover{gap:11px;}',

'.rai-panel{background:var(--ink-800);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 15px;width:100%;animation:raiIn .32s cubic-bezier(.2,.8,.2,1) both;}',
'.rai-fin-group{margin-bottom:9px;}',
'.rai-fin-group:last-of-type{margin-bottom:0;}',
'.rai-fin-plan{padding:10px 0;border-bottom:1px solid var(--line);}',
'.rai-fin-plan:last-child{padding-bottom:0;border-bottom:none;}',
'.rai-fin-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px;}',
'.rai-fin-batt{font-size:12.5px;font-weight:600;color:var(--white);}',
'.rai-fin-dep{font-size:12.5px;font-weight:800;color:var(--orange);white-space:nowrap;text-align:right;}',
'.rai-fin-dep span{font-size:9px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:1px;}',
'.rai-fin-terms{display:flex;gap:6px;flex-wrap:wrap;}',
'.rai-fin-term{flex:1;min-width:78px;background:var(--ink-900);border:1px solid var(--line);border-radius:var(--r-sm);padding:7px 9px;text-align:center;}',
'.rai-fin-term .t{font-size:9px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--faint);}',
'.rai-fin-term .v{font-size:12.5px;font-weight:800;color:var(--white);margin-top:3px;}',
'.rai-fin-term .v small{font-size:9.5px;font-weight:600;color:var(--faint);}',
'.rai-fin-term.na{opacity:.34;}',
'.rai-fin-term.na .v{color:var(--faint);}',
'.rai-fin-note{font-size:11px;line-height:1.5;color:var(--faint);padding:10px 2px 0;}',

'.rai-faq-item{border-bottom:1px solid var(--line);}',
'.rai-faq-item:last-child{border-bottom:none;}',
'.rai-faq-q{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 0;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--white);transition:color .15s ease;}',
'.rai-faq-q:hover{color:var(--orange);}',
'.rai-faq-chev{flex-shrink:0;font-size:15px;color:var(--orange);transition:transform .22s ease;line-height:1;}',
'.rai-faq-item.open .rai-faq-chev{transform:rotate(45deg);}',
'.rai-faq-a{max-height:0;overflow:hidden;transition:max-height .26s ease;}',
'.rai-faq-a p{margin:0;padding:0 0 14px;font-size:12.5px;line-height:1.6;color:var(--dim);}',

/* ---- lead form ---- */
'.rai-lead{border-color:rgba(237,125,49,.42);background:linear-gradient(180deg,rgba(237,125,49,.08),rgba(237,125,49,0) 60%),var(--ink-800);}',
'.rai-lead-title{font-size:14px;font-weight:700;color:var(--white);line-height:1.4;margin-bottom:5px;}',
'.rai-lead-sub{font-size:12px;line-height:1.5;color:var(--dim);margin-bottom:13px;}',
'.rai-field{margin-bottom:9px;}',
'.rai-field label{display:block;font-size:9px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);margin-bottom:5px;}',
'.rai-field input{width:100%;background:var(--ink-900);border:1px solid var(--line-strong);border-radius:var(--r-sm);padding:11px 13px;font-family:inherit;font-size:13px;color:var(--white);outline:none;transition:border-color .15s ease;}',
'.rai-field input::placeholder{color:rgba(255,255,255,.3);}',
'.rai-field input:focus{border-color:var(--orange);}',
'.rai-field input.err{border-color:#E5484D;}',
'.rai-field .msg{font-size:11px;color:#FF6B6E;margin-top:5px;display:none;}',
'.rai-field .msg.show{display:block;}',
'.rai-lead-actions{display:flex;gap:9px;align-items:center;margin-top:13px;}',
'.rai-lead-btn{flex:1;background:var(--orange);color:var(--orange-ink);border:none;border-radius:999px;padding:12px 18px;font-family:inherit;font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:background .15s ease,transform .15s ease;}',
'.rai-lead-btn:hover{background:var(--orange-hot);transform:translateY(-1px);}',
'.rai-lead-btn:disabled{opacity:.5;cursor:default;transform:none;}',
'.rai-lead-skip{background:none;border:none;color:var(--faint);font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;padding:8px 4px;text-decoration:underline;}',
'.rai-lead-skip:hover{color:var(--dim);}',
'.rai-lead-privacy{font-size:10.5px;line-height:1.5;color:rgba(255,255,255,.34);margin-top:11px;}',
'.rai-lead-done{display:flex;gap:11px;align-items:flex-start;}',
'.rai-lead-tick{width:22px;height:22px;border-radius:50%;background:var(--orange);color:var(--orange-ink);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:800;font-size:12px;margin-top:1px;}',

/* ---- quick actions (shown instead of any dead end) ---- */
'.rai-actions{display:flex;flex-wrap:wrap;gap:8px;width:100%;animation:raiIn .32s cubic-bezier(.2,.8,.2,1) both;}',
'.rai-action{flex:1 1 auto;min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;',
'  padding:12px 16px;border-radius:999px;cursor:pointer;text-decoration:none;font-family:inherit;',
'  font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;',
'  background:var(--ink-800);border:1px solid var(--line-strong);color:var(--white);',
'  transition:border-color .15s ease,background .15s ease,transform .15s ease;}',
'.rai-action:hover{border-color:var(--orange);color:var(--orange);transform:translateY(-1px);}',
'.rai-action svg{width:15px;height:15px;fill:currentColor;flex-shrink:0;}',
'.rai-action.primary{background:var(--orange);border-color:var(--orange);color:var(--orange-ink);flex-basis:100%;}',
'.rai-action.primary:hover{background:var(--orange-hot);color:var(--orange-ink);border-color:var(--orange-hot);}',

'.rai-quoted{background:var(--ink-900);border-left:2px solid var(--orange);border-radius:0 var(--r-sm) var(--r-sm) 0;',
'  padding:10px 13px;margin-bottom:13px;font-size:12.5px;line-height:1.5;color:var(--dim);font-style:italic;}',
'.rai-quoted span{display:block;font-style:normal;font-size:9px;font-weight:700;letter-spacing:.13em;',
'  text-transform:uppercase;color:var(--faint);margin-bottom:4px;}',

'.rai-chips{display:flex;flex-wrap:wrap;gap:7px;padding:2px 0 4px;}',
'.rai-chip{background:var(--ink-800);border:1px solid var(--line-strong);color:var(--dim);border-radius:999px;padding:8px 14px;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:600;transition:all .15s ease;}',
'.rai-chip:hover{border-color:var(--orange);color:var(--orange);transform:translateY(-1px);}',

'.rai-typing{display:flex;gap:5px;padding:15px 17px;background:var(--ink-800);border:1px solid var(--line);border-radius:var(--r-md);border-bottom-left-radius:5px;width:fit-content;}',
'.rai-typing i{width:6px;height:6px;border-radius:50%;background:var(--orange);animation:raiBounce 1.3s infinite ease-in-out;}',
'.rai-typing i:nth-child(2){animation-delay:.16s;}',
'.rai-typing i:nth-child(3){animation-delay:.32s;}',
'@keyframes raiBounce{0%,60%,100%{transform:none;opacity:.45;}30%{transform:translateY(-5px);opacity:1;}}',

'.rai-composer{display:flex;gap:9px;align-items:center;padding:13px 14px;background:var(--ink-850);border-top:1px solid var(--line);flex-shrink:0;}',
'.rai-composer input{flex:1;min-width:0;border:1px solid var(--line-strong);border-radius:999px;padding:12px 17px;font-family:inherit;font-size:13px;background:var(--ink-900);color:var(--white);outline:none;transition:border-color .15s ease,background .15s ease;}',
'.rai-composer input::placeholder{color:var(--faint);}',
'.rai-composer input:focus{border-color:var(--orange);background:#000;}',
'.rai-send{width:42px;height:42px;border-radius:50%;flex-shrink:0;background:var(--orange);color:var(--orange-ink);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s ease,transform .15s ease;}',
'.rai-send:hover{background:var(--orange-hot);transform:scale(1.06);}',
'.rai-send:disabled{opacity:.4;cursor:default;transform:none;}',
'.rai-send svg{width:17px;height:17px;fill:currentColor;}',
'.rai-foot{text-align:center;padding:0 14px 11px;background:var(--ink-850);font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.26);}',

/* ==========================================================================
   ROAM CART: cart badge, part cards, selection checklist, cart drawer.
   ========================================================================== */
'.rai-cart-btn{position:relative;background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;',
'  display:flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;flex-shrink:0;transition:color .15s ease;}',
'.rai-cart-btn:hover{color:var(--orange);}',
'.rai-cart-btn svg{width:19px;height:19px;}',
'.rai-cart-badge{position:absolute;top:-3px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;',
'  background:var(--orange);color:var(--orange-ink);font-size:9.5px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1;}',
'.rai-cart-badge.zero{display:none;}',

'.rai-part-card{background:var(--ink-800);border:1px solid var(--line);border-radius:var(--r-md);padding:15px 16px 16px;width:100%;animation:raiIn .32s cubic-bezier(.2,.8,.2,1) both;}',
'.rai-part-name{font-size:13.5px;font-weight:700;color:var(--white);line-height:1.35;margin-bottom:3px;}',
'.rai-part-no{font-size:10.5px;color:var(--faint);letter-spacing:.03em;margin-bottom:11px;}',
'.rai-part-prices{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px;}',
'.rai-part-price{background:var(--ink-900);border:1px solid var(--line);border-radius:var(--r-sm);padding:6px 10px;min-width:64px;}',
'.rai-part-price .l{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);}',
'.rai-part-price .v{font-size:13px;font-weight:800;color:var(--white);margin-top:2px;}',
'.rai-part-price.total .v{color:var(--orange);}',
'.rai-part-vat{font-size:10px;color:var(--faint);margin-bottom:12px;}',
'.rai-part-actions{display:flex;gap:8px;}',
'.rai-add-btn{flex:1 1 auto;min-height:42px;display:inline-flex;align-items:center;justify-content:center;gap:7px;',
'  background:var(--orange);color:var(--orange-ink);border:none;border-radius:999px;font-family:inherit;',
'  font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;',
'  transition:background .15s ease,transform .15s ease;}',
'.rai-add-btn:hover{background:var(--orange-hot);transform:translateY(-1px);}',
'.rai-add-btn:disabled{opacity:.6;cursor:default;transform:none;}',
'.rai-save-btn{display:block;background:none;border:none;color:var(--dim);font-family:inherit;font-size:10.5px;',
'  font-weight:600;text-decoration:underline;cursor:pointer;padding:9px 2px 0;}',
'.rai-save-btn:hover{color:var(--orange);}',

'.rai-checklist-panel .rai-eyebrow{margin-bottom:11px;}',
'.rai-check-item{display:flex;align-items:center;gap:10px;padding:9px 1px;border-bottom:1px solid var(--line);}',
'.rai-check-item:last-of-type{border-bottom:none;}',
'.rai-check-item input{width:18px;height:18px;accent-color:var(--orange);flex-shrink:0;cursor:pointer;}',
'.rai-check-item label{flex:1;min-width:0;font-size:12.5px;line-height:1.4;color:var(--white);cursor:pointer;}',
'.rai-check-item .price{font-size:12px;font-weight:800;color:var(--orange);white-space:nowrap;flex-shrink:0;}',

'.rai-cart-drawer{background:var(--ink-800);border:1px solid var(--line);border-radius:var(--r-md);padding:15px 16px 16px;width:100%;animation:raiIn .32s cubic-bezier(.2,.8,.2,1) both;}',
'.rai-cart-line{display:flex;align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid var(--line);}',
'.rai-cart-line:last-of-type{border-bottom:none;}',
'.rai-cart-line-info{flex:1;min-width:0;}',
'.rai-cart-line-name{font-size:12.5px;font-weight:700;color:var(--white);line-height:1.3;}',
'.rai-cart-line-no{font-size:9.5px;color:var(--faint);margin-top:1px;}',
'.rai-cart-line-price{font-size:11.5px;color:var(--dim);margin-top:3px;}',
'.rai-qty{display:flex;align-items:center;border:1px solid var(--line-strong);border-radius:999px;overflow:hidden;flex-shrink:0;}',
'.rai-qty button{width:28px;height:28px;background:var(--ink-900);border:none;color:var(--white);font-size:15px;',
'  line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;}',
'.rai-qty button:hover{color:var(--orange);}',
'.rai-qty span{width:22px;text-align:center;font-size:12px;font-weight:700;color:var(--white);}',
'.rai-cart-remove{background:none;border:none;color:var(--faint);cursor:pointer;padding:5px;flex-shrink:0;display:flex;}',
'.rai-cart-remove:hover{color:#e6553d;}',
'.rai-cart-remove svg{width:16px;height:16px;}',
'.rai-cart-totals{margin-top:6px;padding-top:12px;border-top:1px solid var(--line);}',
'.rai-cart-totals .row{display:flex;justify-content:space-between;font-size:12px;color:var(--dim);padding:2px 0;}',
'.rai-cart-totals .row.total{font-size:14.5px;font-weight:800;color:var(--white);margin-top:5px;}',
'.rai-cart-totals .row.total span:last-child{color:var(--orange);}',
'.rai-cart-tagline{font-size:10px;letter-spacing:.06em;color:var(--faint);margin-top:11px;text-align:center;}',

'.rai-pq-summary{background:var(--ink-900);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:13px;font-size:11.5px;color:var(--dim);line-height:1.65;}',
'.rai-pq-summary b{color:var(--white);}',

/* ==========================================================================
   ROAM HUB FINDER: region tabs, service filters and location cards.
   ========================================================================== */
'.rai-hub-tabs{display:flex;gap:6px;margin-bottom:11px;overflow-x:auto;-webkit-overflow-scrolling:touch;',
'  scrollbar-width:none;}',
'.rai-hub-tabs::-webkit-scrollbar{display:none;}',
'.rai-hub-tab{flex:0 0 auto;background:var(--ink-900);border:1px solid var(--line-strong);border-radius:999px;',
'  padding:7px 13px;font-family:inherit;font-size:11px;font-weight:600;color:var(--dim);cursor:pointer;',
'  white-space:nowrap;transition:all .15s ease;}',
'.rai-hub-tab:hover{color:var(--white);border-color:var(--faint);}',
'.rai-hub-tab.on{background:var(--orange);border-color:var(--orange);color:#14170F;}',
'.rai-hub-filters{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 12px;}',
'.rai-hub-filt{background:none;border:1px solid var(--line-strong);border-radius:999px;padding:6px 11px;',
'  font-family:inherit;font-size:10.5px;font-weight:600;color:var(--faint);cursor:pointer;transition:all .15s ease;}',
'.rai-hub-filt:hover{color:var(--white);border-color:var(--faint);}',
'.rai-hub-filt.on{background:rgba(237,125,49,.14);border-color:var(--orange);color:var(--orange);}',
'.rai-hub-list{padding:0;background:none;border:none;}',
'.rai-hub-card{background:var(--ink-900);border:1px solid var(--line);border-left:2px solid var(--orange);',
'  border-radius:var(--r-sm);padding:12px 13px;margin-top:9px;}',
'.rai-hub-list .rai-hub-card:first-child{margin-top:0;}',
'.rai-hub-head{display:flex;align-items:flex-start;gap:10px;}',
'.rai-hub-id{flex:1;min-width:0;}',
'.rai-hub-name{font-size:12.5px;font-weight:700;color:var(--white);line-height:1.35;}',
'.rai-hub-sub{font-size:10px;color:var(--faint);margin-top:2px;}',
'.rai-hub-km{flex:0 0 auto;font-size:10px;font-weight:700;color:var(--orange);background:rgba(237,125,49,.12);',
'  border-radius:999px;padding:3px 8px;}',
'.rai-hub-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;}',
'.rai-hub-tag{font-size:10px;font-weight:600;border-radius:999px;padding:3px 8px;',
'  background:rgba(255,255,255,.05);color:var(--dim);}',
'.rai-hub-tag.on{background:rgba(237,125,49,.13);color:var(--orange);}',
'.rai-hub-tag.off{color:var(--faint);text-decoration:line-through;text-decoration-color:var(--faint);}',
'.rai-hub-phone{font-size:10.5px;color:var(--dim);margin-top:8px;}',
'.rai-hub-phone.none{color:var(--faint);font-style:italic;}',
'.rai-hub-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}',
'.rai-hub-act{flex:0 0 auto;text-decoration:none;font-size:11px;font-weight:700;border-radius:999px;',
'  padding:7px 12px;border:1px solid var(--line-strong);color:var(--white);transition:all .15s ease;}',
'.rai-hub-act:hover{border-color:var(--orange);color:var(--orange);}',
'.rai-hub-act.map{background:var(--orange);border-color:var(--orange);color:#14170F;}',
'.rai-hub-act.map:hover{filter:brightness(1.08);color:#14170F;}',
'.rai-hub-more{width:100%;margin-top:11px;background:none;border:1px dashed var(--line-strong);',
'  border-radius:999px;padding:9px;font-family:inherit;font-size:11px;font-weight:700;',
'  color:var(--dim);cursor:pointer;}',
'.rai-hub-more:hover{color:var(--orange);border-color:var(--orange);}',

/* ==========================================================================
   PARTS CATALOGUE: searchable, shelf-by-shelf browse of all catalogue rows.
   ========================================================================== */
'.rai-cat-search{position:relative;margin-bottom:11px;}',
'.rai-cat-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:15px;height:15px;fill:var(--faint);pointer-events:none;}',
'.rai-cat-search input{width:100%;background:var(--ink-900);border:1px solid var(--line-strong);border-radius:999px;',
'  padding:11px 14px 11px 34px;font-family:inherit;font-size:13px;color:var(--white);outline:none;transition:border-color .15s ease;}',
'.rai-cat-search input:focus{border-color:var(--orange);}',
'.rai-cat-count{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-bottom:9px;}',
'.rai-cat-empty{font-size:12.5px;line-height:1.6;color:var(--dim);padding:6px 2px 2px;}',
'.rai-cat-group{border-top:1px solid var(--line);}',
'.rai-cat-head{width:100%;display:flex;align-items:center;gap:9px;background:none;border:none;cursor:pointer;',
'  padding:12px 2px;font-family:inherit;text-align:left;color:var(--white);}',
'.rai-cat-name{flex:1;min-width:0;font-size:12.5px;font-weight:700;letter-spacing:.01em;}',
'.rai-cat-n{font-size:10px;font-weight:700;color:var(--faint);background:var(--ink-900);border-radius:999px;padding:3px 8px;}',
'.rai-cat-chev{font-size:15px;line-height:1;color:var(--orange);transition:transform .22s ease;width:12px;text-align:center;}',
'.rai-cat-group.open .rai-cat-chev{transform:rotate(45deg);}',
'.rai-cat-head:hover .rai-cat-name{color:var(--orange);}',
'.rai-cat-body{display:none;padding-bottom:6px;}',
'.rai-cat-group.open .rai-cat-body{display:block;}',
'.rai-cat-row{display:flex;align-items:center;gap:10px;padding:8px 2px 8px 10px;border-left:2px solid var(--line);margin-bottom:2px;}',
'.rai-cat-row:hover{border-left-color:var(--orange);}',
'.rai-cat-info{flex:1;min-width:0;}',
'.rai-cat-part{font-size:12px;font-weight:600;color:var(--white);line-height:1.35;}',
'.rai-cat-meta{font-size:10px;color:var(--faint);margin-top:2px;}',
'.rai-cat-add{width:32px;height:32px;flex-shrink:0;border-radius:50%;border:1px solid var(--line-strong);background:var(--ink-900);',
'  color:var(--orange);font-size:17px;line-height:1;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;',
'  transition:background .15s ease,color .15s ease,transform .15s ease;}',
'.rai-cat-add:hover{background:var(--orange);color:var(--orange-ink);border-color:var(--orange);transform:scale(1.08);}',
'.rai-cat-add.added{background:var(--orange);color:var(--orange-ink);border-color:var(--orange);font-size:13px;}',

/* ==========================================================================
   HOME SCREEN: the three things a rider most often wants, one tap away.
   ========================================================================== */
'.rai-home{display:flex;flex-direction:column;gap:8px;width:100%;animation:raiIn .32s cubic-bezier(.2,.8,.2,1) both;}',
'.rai-home-btn{display:flex;align-items:center;gap:12px;width:100%;text-align:left;text-decoration:none;',
'  background:var(--ink-800);border:1px solid var(--line);border-radius:var(--r-md);padding:13px 15px;',
'  font-family:inherit;cursor:pointer;transition:border-color .18s ease,transform .18s ease,background .18s ease;}',
'.rai-home-btn:hover{border-color:var(--orange);transform:translateY(-2px);background:var(--ink-700);}',
'.rai-home-ico{width:34px;height:34px;flex-shrink:0;border-radius:9px;background:rgba(237,125,49,.14);color:var(--orange);',
'  display:flex;align-items:center;justify-content:center;font-size:16px;}',
'.rai-home-ico svg{width:17px;height:17px;fill:currentColor;}',
'.rai-home-txt{flex:1;min-width:0;display:block;}',
'.rai-home-t{display:block;font-size:13px;font-weight:700;color:var(--white);line-height:1.3;}',
'.rai-home-d{display:block;font-size:11px;color:var(--dim);margin-top:3px;line-height:1.45;}',
'.rai-home-arrow{color:var(--faint);font-size:15px;flex-shrink:0;transition:transform .18s ease,color .18s ease;}',
'.rai-home-btn:hover .rai-home-arrow{color:var(--orange);transform:translateX(3px);}',

/* ==========================================================================
   MOBILE: full-screen sheet.
   Notes: 100dvh (not 100vh) so the panel is not cut off by mobile browser
   chrome; env(safe-area-inset-*) for notches and home indicators; and
   16px inputs, because iOS Safari force-zooms the page on any input under 16px.
   ========================================================================== */
'@media(max-width:600px){',
'  .rai-chat{width:100vw;max-width:100vw;height:100vh;height:100dvh;max-height:none;',
'    right:0;left:0;bottom:0;top:0;border-radius:0;border:none;',
'    transform:translateY(100%);transition:transform .3s cubic-bezier(.2,.8,.2,1),opacity .2s ease;}',
'  .rai-chat.open{transform:none;}',
'  .rai-header{padding:calc(14px + env(safe-area-inset-top)) 16px 12px;}',
'  .rai-messages{padding:16px 14px 8px;gap:12px;}',
'  .rai-composer{padding:10px 12px calc(10px + env(safe-area-inset-bottom));}',
'  .rai-composer input{font-size:16px;padding:13px 16px;}',      /* 16px stops iOS zoom */
'  .rai-send{width:46px;height:46px;}',
'  .rai-close{width:40px;height:40px;}',                          /* 44px-ish tap target */
'  .rai-close svg{width:15px;height:15px;}',
'  .rai-field input{font-size:16px;padding:13px 14px;}',
'  .rai-launch{bottom:calc(16px + env(safe-area-inset-bottom));right:16px;height:52px;padding:0 20px;font-size:11px;}',
'  .rai-foot{padding-bottom:calc(9px + env(safe-area-inset-bottom));}',
'  .rai-bubble{max-width:90%;font-size:14px;}',
'  .rai-card-img{height:158px;}',
'  .rai-fin-term{min-width:0;flex:1;padding:8px 4px;}',
'  .rai-fin-term .v{font-size:12px;}',
'  .rai-chip{padding:10px 15px;font-size:12px;}',
'  .rai-action{flex-basis:calc(50% - 4px);font-size:11px;padding:13px 12px;}',
'  .rai-lead-btn{padding:14px 18px;font-size:12px;}',
'  .rai-lead-actions{flex-wrap:wrap;}',
'  .rai-lead-skip{flex-basis:100%;text-align:center;padding:10px 4px 2px;}',
'  .rai-add-btn{min-height:46px;font-size:12px;}',
'  .rai-qty button{width:32px;height:32px;font-size:17px;}',
'  .rai-qty span{width:26px;font-size:13px;}',
'  .rai-check-item input{width:20px;height:20px;}}',

/* very small phones */
'@media(max-width:380px){',
'  .rai-launch span{display:none;}',
'  .rai-launch{padding:0;width:54px;justify-content:center;}',
'  .rai-header-label{font-size:10px;letter-spacing:.16em;}',
'  .rai-status{font-size:9px;letter-spacing:.1em;}}',

/* landscape phones: the keyboard leaves very little height */
'@media(max-height:520px) and (max-width:900px){',
'  .rai-header{padding-top:calc(10px + env(safe-area-inset-top));padding-bottom:8px;}',
'  .rai-status{display:none;}',
'  .rai-foot{display:none;}}',

/* larger desktops get a slightly roomier panel */
'@media(min-width:1600px) and (min-height:900px){',
'  .rai-chat{width:500px;height:780px;}}',

/* respect reduced-motion preferences */
'@media(prefers-reduced-motion:reduce){',
'  #roam-assistant *{animation-duration:.01ms !important;transition-duration:.01ms !important;}}'
  ].join('\n');

  /* ==========================================================================
     BOOT
     ========================================================================== */
  function boot() {
    if (!document.querySelector('link[href*="Montserrat"]')) {
      var f = document.createElement('link');
      f.rel = 'stylesheet';
      f.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(f);
    }
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var root = document.createElement('div');
    root.id = 'roam-assistant';
    root.innerHTML =
      '<button class="rai-launch" id="rai-launch" aria-label="Ask Roam">' +
        '<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 5.9 2 10.7c0 2.7 1.4 5.1 3.6 6.7v3.3c0 .4.5.7.9.4l3.1-2.1c.8.2 1.6.2 2.4.2 5.5 0 10-3.9 10-8.5S17.5 2 12 2z"/></svg>' +
        '<span>Ask Roam</span></button>' +
      '<div class="rai-chat" id="rai-chat" role="dialog" aria-label="Roam Assistant">' +
        '<div class="rai-header"><div class="rai-header-top">' +
          '<img class="rai-wordmark" src="' + WORDMARK + '" alt="Roam">' +
          '<div class="rai-divider"></div><div class="rai-header-label">Assistant</div>' +
          '<button class="rai-cart-btn" id="rai-cart-btn" aria-label="Roam Cart" title="Roam Cart">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M3.5 4h2l.6 3M6.1 7h13.9l-2.3 7H8.3M6.1 7 8.3 14M8.3 14l-1 2.3A1 1 0 0 0 8.2 18h9.3"/>' +
              '<circle cx="10" cy="20.5" r="1.15" fill="currentColor" stroke="none"/>' +
              '<circle cx="17" cy="20.5" r="1.15" fill="currentColor" stroke="none"/>' +
            '</svg>' +
            '<span class="rai-cart-badge zero" id="rai-cart-badge">0</span>' +
          '</button>' +
          '<button class="rai-close" id="rai-close" aria-label="Close">' +
            '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" stroke-linecap="round"/></svg></button>' +
        '</div><div class="rai-status"><span class="rai-dot"></span> Online · The Standard of Electric Mobility</div></div>' +
        '<div class="rai-messages" id="rai-messages"></div>' +
        '<div class="rai-composer">' +
          '<input type="text" id="rai-input" placeholder="Ask about Roam Air, charging, financing…" autocomplete="off">' +
          '<button class="rai-send" id="rai-send" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg></button>' +
        '</div><div class="rai-foot">Roam Electric · Nairobi, Kenya</div>' +
      '</div>';
    document.body.appendChild(root);
    wire();
  }

  /* ==========================================================================
     HELPERS
     ========================================================================== */
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }

  var history_ = [];
  var busy = false;
  var leadShown = false;
  var leadCaptured = false;
  var turns = 0;

  function scrollDown() {
    var m = $('rai-messages');
    requestAnimationFrame(function () { m.scrollTop = m.scrollHeight; });
  }

  /* --------------------------------------------------------------------------
     HUMAN PACING AND PHRASING
     An answer that appears the instant you press send reads as a database
     lookup. A person reads your message, thinks, then types: the dots stay up
     for roughly as long as the reply would take to write, capped so nobody is
     ever left waiting on a widget. Set typingMs: 0 in the config to switch the
     pause off entirely (used by the test harness).
     -------------------------------------------------------------------------- */
  var TYPING_MS = (CFG.typingMs === 0 || CFG.typingMs > 0) ? CFG.typingMs : null;

  function typingPause(text) {
    if (TYPING_MS !== null) return TYPING_MS;
    var n = String(text || '').length;
    return Math.max(420, Math.min(1500, 380 + n * 5));
  }

  /* Stagger something behind the message before it. Honours the same switch
     as typingPause, so with typingMs:0 the whole panel builds synchronously
     and the test harness can assert straight after a click. */
  function after(ms, fn) {
    if (TYPING_MS === 0 || !ms) { fn(); return; }
    setTimeout(fn, ms);
  }

  /* A short human beat in front of a confirmation, so five parts added in a
     row do not read as five identical machine receipts. The sentence that
     follows is always the same, so nothing that matters depends on the beat. */
  var ACKS = ['Nice one. ', 'Sorted. ', 'Done. ', 'Got it. ', 'Perfect. '];
  var ackAt = 0;
  function ack() {
    var a = ACKS[ackAt % ACKS.length];
    ackAt++;
    return a;
  }

  /* Karibu in the morning is not the same as karibu at 9pm. */
  function greetingLine() {
    var h = new Date().getHours();
    var when = h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
    return when + ', karibu Roam.';
  }
  function row(html, role) {
    var r = document.createElement('div');
    r.className = 'rai-row ' + role;
    r.innerHTML = html;
    $('rai-messages').appendChild(r);
    scrollDown();
    return r;
  }

  function formatResponse(text) {
    var lines = String(text).split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var html = '', inList = false;
    var isB = function (l) { return /^[•\-*]\s+/.test(l) || /^\d+[.)]\s+/.test(l); };
    var isCta = function (l) { return !isB(l) && /\?$/.test(l) && l.split(' ').length <= 14; };
    lines.forEach(function (line, i) {
      if (isB(line)) {
        if (!inList) { html += '<div class="rai-list">'; inList = true; }
        html += '<div class="rai-li">' + inline(line.replace(/^[•\-*]\s+/, '').replace(/^\d+[.)]\s+/, '')) + '</div>';
      } else {
        if (inList) { html += '</div>'; inList = false; }
        html += (i === lines.length - 1 && isCta(line))
          ? '<div class="rai-cta">' + inline(line) + '</div>'
          : '<div class="rai-lede">' + inline(line) + '</div>';
      }
    });
    if (inList) html += '</div>';
    return html;
  }

  /* ==========================================================================
     CARDS
     ========================================================================== */
  function mediaCard(key) {
    var m = MEDIA[key];
    if (!m) return '';
    return '<div class="rai-card">' +
      (m.img ? '<img class="rai-card-img" src="' + m.img + '" alt="' + esc(m.title) + '" loading="lazy">' : '') +
      '<div class="rai-card-body"><div class="rai-eyebrow">' + esc(m.eyebrow) + '</div>' +
      '<div class="rai-card-title">' + esc(m.title) + '</div>' +
      '<div class="rai-card-desc">' + esc(m.desc) + '</div>' +
      '<a class="rai-card-link" href="' + m.link + '" target="_blank" rel="noopener">Read the story &rarr;</a>' +
      '</div></div>';
  }

  function term(label, v) {
    return '<div class="rai-fin-term' + (v ? '' : ' na') + '"><div class="t">' + label + '</div>' +
      '<div class="v">' + (v ? v + '<small>/day</small>' : '<small>n/a</small>') + '</div></div>';
  }

  function financingCard() {
    var h = '<div class="rai-panel">';
    Object.keys(FINANCING_DATA).forEach(function (partner) {
      h += '<div class="rai-fin-group"><div class="rai-eyebrow">' + esc(partner) + '</div>';
      FINANCING_DATA[partner].forEach(function (p) {
        h += '<div class="rai-fin-plan"><div class="rai-fin-head">' +
          '<div class="rai-fin-batt">' + esc(p.battery) + '</div>' +
          '<div class="rai-fin-dep"><span>Deposit</span>KES ' + p.down + '</div></div>' +
          '<div class="rai-fin-terms">' + term('12 mo', p.p12) + term('18 mo', p.p18) + term('24 mo', p.p24) + '</div></div>';
      });
      h += '</div>';
    });
    h += '<div class="rai-fin-note">Daily rates are each financier’s own quoted figure. Cash price without financing: KES ' +
      CASH.single + ' (single battery + 1 charger) or KES ' + CASH.dual + ' (dual battery + 2 chargers).</div></div>';
    return h;
  }

  function faqCard() {
    var h = '<div class="rai-panel"><div class="rai-eyebrow">Got Questions?</div>';
    FAQ.forEach(function (f) {
      h += '<div class="rai-faq-item"><div class="rai-faq-q">' + esc(f.q) +
        '<span class="rai-faq-chev">+</span></div><div class="rai-faq-a"><p>' + esc(f.a) + '</p></div></div>';
    });
    return h + '</div>';
  }

  function chips() {
    return '<div class="rai-chips">' + SUGGESTIONS.map(function (s) {
      return '<button class="rai-chip" data-q="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('') + '</div>';
  }

  /* ==========================================================================
     ROAM PARTS & ROAM CART
     Find it. Add it. Ride on. — clean part cards, a selection checklist for
     multi-part requests, and an interactive cart drawer with quantity
     controls, a WhatsApp handoff and a quote request. Reuses the .rai-chip
     click handler already wired for the greeting suggestions.
     ========================================================================== */
  var ICON_WA = '<svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.4.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>';
  var ICON_CALL = '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>';

  /* The three things riders come here for, one tap away on the opening
     screen: browse the parts catalogue, work out the numbers, book a ride.
     The parts entry stays in-chat; the other two open Roam's own pages. */
  function homeActions() {
    return '<div class="rai-home">' +
      '<button class="rai-home-btn" data-open-hubs>' +
        '<span class="rai-home-ico">📍</span>' +
        '<span class="rai-home-txt"><span class="rai-home-t">Find a Roam Hub</span>' +
        '<span class="rai-home-d">Charging, battery rental, after-sales and shops, with directions</span></span>' +
        '<span class="rai-home-arrow">&rarr;</span></button>' +
      '<button class="rai-home-btn" data-open-catalogue>' +
        '<span class="rai-home-ico">🔧</span>' +
        '<span class="rai-home-txt"><span class="rai-home-t">Roam Parts</span>' +
        '<span class="rai-home-d">Browse over 100 genuine parts and add them to your Roam Cart</span></span>' +
        '<span class="rai-home-arrow">&rarr;</span></button>' +
      '<a class="rai-home-btn" href="' + CALCULATOR_URL + '" target="_blank" rel="noopener">' +
        '<span class="rai-home-ico">' +
          '<svg viewBox="0 0 24 24"><path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 4v3h10V6H7zm0 5v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v4h2v-4h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2z"/></svg>' +
        '</span>' +
        '<span class="rai-home-txt"><span class="rai-home-t">Cost calculator</span>' +
        '<span class="rai-home-d">Repayments, charging cost and what you save against petrol</span></span>' +
        '<span class="rai-home-arrow">&rarr;</span></a>' +
      '<a class="rai-home-btn" href="' + testRideLink() + '" target="_blank" rel="noopener">' +
        '<span class="rai-home-ico">' +
          '<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 5.9 2 10.7c0 2.7 1.4 5.1 3.6 6.7v3.3c0 .4.5.7.9.4l3.1-2.1c.8.2 1.6.2 2.4.2 5.5 0 10-3.9 10-8.5S17.5 2 12 2z"/></svg>' +
        '</span>' +
        '<span class="rai-home-txt"><span class="rai-home-t">Book a free test ride</span>' +
        '<span class="rai-home-d">Pick a county, a date and a time that suits you</span></span>' +
        '<span class="rai-home-arrow">&rarr;</span></a>' +
    '</div>';
  }

  /* The whole catalogue, on shelves. A rider who does not know what the part
     is called can open a category and read down the list; every row adds
     straight to the Roam Cart. The search box filters across all categories
     at once and keeps the matching ones open. */
  function partsBrowser(filter) {
    var groups = partsByCategory(filter);
    var f = (filter || '').trim();
    var shown = 0;
    groups.forEach(function (g) { shown += g.items.length; });

    var h = '<div class="rai-panel rai-catalogue" data-catalogue>' +
      '<div class="rai-eyebrow">🔧 Roam Parts</div>' +
      '<div class="rai-cat-search">' +
        '<svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 1 0 3.5 10.9l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>' +
        '<input type="text" id="rai-cat-q" placeholder="Search parts, part numbers or what’s broken" ' +
          'value="' + esc(f) + '" autocomplete="off">' +
      '</div>';

    if (!groups.length) {
      return h + '<div class="rai-cat-empty">Nothing in the catalogue matches &ldquo;' + esc(f) + '&rdquo;.<br>' +
        'Try a simpler word such as &ldquo;brake&rdquo;, or WhatsApp Roam on ' + PHONE + ' and the team will find it.</div></div>';
    }

    /* Browsing the whole catalogue reads "over 100 parts" rather than an exact
       count: the list moves as Roam adds and retires parts, and a hard number
       on screen is a number that goes stale. A filtered view still counts the
       hits, because there the number is the useful part of the answer. */
    h += '<div class="rai-cat-count">' +
         (f ? shown + ' part' + (shown === 1 ? '' : 's') + ' matching &ldquo;' + esc(f) + '&rdquo;'
            : 'Over 100 parts in the Roam catalogue') + ' &middot; VAT included</div>';

    groups.forEach(function (g, gi) {
      // When searching, everything is already narrowed, so open every group.
      // When browsing, open the first shelf only and let the rider explore.
      var open = f ? true : gi === 0;
      h += '<div class="rai-cat-group' + (open ? ' open' : '') + '">' +
        '<button class="rai-cat-head" data-cat-toggle>' +
          '<span class="rai-cat-name">' + esc(g.name) + '</span>' +
          '<span class="rai-cat-n">' + g.items.length + '</span>' +
          '<span class="rai-cat-chev">+</span></button>' +
        '<div class="rai-cat-body">';
      g.items.forEach(function (p) {
        h += '<div class="rai-cat-row">' +
          '<div class="rai-cat-info"><div class="rai-cat-part">' + esc(p.d) + '</div>' +
            '<div class="rai-cat-meta">' + esc(p.n || 'No part number') + ' &middot; part ' + ksh(p.p) +
              (p.r > 0 ? ' &middot; fitted ' + ksh(p.t) : '') + '</div></div>' +
          '<button class="rai-cat-add" data-add-part="' + p.id + '" aria-label="Add ' + esc(p.d) + ' to Roam Cart">+</button>' +
          '</div>';
      });
      h += '</div></div>';
    });
    return h + '</div>';
  }

  /* ==========================================================================
     ROAM HUB FINDER: the panel and the location cards
     A rider asking where to go should end up with a tap that opens Google
     Maps and a tap that rings the station, not a paragraph to read.
     ========================================================================== */

  /* One station. `full` spells out every service as yes or no, which is what
     a question about one hub deserves; the compact form shows only what the
     station actually offers, which is what a list of results wants. */
  function hubCard(h, full, km) {
    var digits = hubDigits(h);
    var tags = SERVICE_KEYS.filter(function (k) { return full || h[k]; })
      .map(function (k) {
        return '<span class="rai-hub-tag' + (h[k] ? ' on' : ' off') + '">' +
          SERVICE_TAGS[k] + (full ? (h[k] ? ': Yes' : ': No') : '') + '</span>';
      }).join('');
    if (!tags) tags = '<span class="rai-hub-tag off">No rider services listed</span>';

    var head = '<div class="rai-hub-head"><div class="rai-hub-id">' +
      '<div class="rai-hub-name">' + esc(hubName(h)) + '</div>' +
      '<div class="rai-hub-sub">' + esc(h.pa) + ' &middot; ' + esc(h.s) + '</div></div>' +
      (typeof km === 'number' ? '<span class="rai-hub-km">' + (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km</span>' : '') +
      '</div>';

    var acts = '<a class="rai-hub-act map" href="' + esc(hubMaps(h)) + '" target="_blank" rel="noopener">' +
      '📍 Open in Google Maps</a>';
    if (digits) {
      acts += '<a class="rai-hub-act" href="tel:+' + digits + '">📞 Call</a>' +
              '<a class="rai-hub-act" href="https://wa.me/' + digits + '" target="_blank" rel="noopener">WhatsApp</a>';
    }

    return '<div class="rai-hub-card" data-hub="' + esc(h.s) + '">' + head +
      '<div class="rai-hub-tags">' + tags + '</div>' +
      (h.ph ? '<div class="rai-hub-phone">' + esc(h.ph) + '</div>'
            : '<div class="rai-hub-phone none">No confirmed phone number for this station</div>') +
      (full && h.ld ? '<div class="rai-hub-phone none">Launched ' + esc(h.ld) + '</div>' : '') +
      '<div class="rai-hub-acts">' + acts + '</div></div>';
  }

  function hubCards(hs, full) {
    if (!hs.length) return '';
    return '<div class="rai-panel rai-hub-list">' +
      hs.map(function (h) { return hubCard(h, full); }).join('') + '</div>';
  }

  /* Which stations the finder is currently showing, given its own state. */
  function finderResults() {
    var s = finderState;
    var out = HUBS.filter(function (h) {
      return SERVICE_KEYS.every(function (k) { return !s.f[k] || h[k]; });
    });
    if (s.rg === 'nairobi' || s.rg === 'outside') {
      out = out.filter(function (h) { return h.rg === s.rg; });
    }
    var q = s.q.trim().toLowerCase();
    if (q) {
      out = out.filter(function (h) {
        return (h.s + ' ' + h.pa + ' ' + hubName(h)).toLowerCase().indexOf(q) > -1 || h.k.test(q);
      });
    }
    if (s.origin) {
      out = out.map(function (h) { return { h: h, km: kmBetween(s.origin, h) }; })
               .sort(function (a, b) { return a.km - b.km; });
    } else {
      out = out.map(function (h) { return { h: h, km: null }; });
    }
    return out;
  }

  function hubFinder() {
    var s = finderState, rows = finderResults();
    var shown = s.all ? rows : rows.slice(0, 4);

    function tab(id, label) {
      return '<button class="rai-hub-tab' + (s.rg === id ? ' on' : '') +
        '" data-hub-region="' + id + '">' + label + '</button>';
    }
    function filt(k) {
      return '<button class="rai-hub-filt' + (s.f[k] ? ' on' : '') +
        '" data-hub-filter="' + k + '">' + SERVICE_TAGS[k] + '</button>';
    }

    var h = '<div class="rai-panel rai-hubs" data-hubfinder>' +
      '<div class="rai-eyebrow">📍 Find a Roam Hub</div>' +
      '<div class="rai-hub-tabs">' + tab('near', s.origin ? 'Near ' + esc(s.origin.n) : 'Nearest to me') +
        tab('nairobi', 'Nairobi') + tab('outside', 'Outside Nairobi') + tab('all', 'All') + '</div>' +
      '<div class="rai-cat-search">' +
        '<svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 1 0 3.5 10.9l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/></svg>' +
        '<input type="text" id="rai-hub-q" placeholder="Area, station or partner" value="' +
          esc(s.q) + '" autocomplete="off"></div>' +
      '<div class="rai-hub-filters">' + SERVICE_KEYS.map(filt).join('') + '</div>';

    if (!rows.length) {
      return h + '<div class="rai-cat-empty">No Roam location in my current data matches that.<br>' +
        'Clear a filter, or WhatsApp Roam on ' + PHONE + ' and the team will confirm.</div></div>';
    }

    h += '<div class="rai-cat-count">' + rows.length + ' Roam location' +
         (rows.length === 1 ? '' : 's') + (s.origin ? ' &middot; closest first' : '') + '</div>';
    shown.forEach(function (r) { h += hubCard(r.h, false, r.km === null ? undefined : r.km); });
    if (rows.length > shown.length) {
      h += '<button class="rai-hub-more" data-hub-more>Show all ' + rows.length + ' locations</button>';
    }
    return h + '</div>';
  }

  /* Re-render the panel in place. `from` is any element inside it. */
  function redrawFinder(from) {
    var panel = from && from.closest ? from.closest('[data-hubfinder]') : null;
    if (!panel) panel = document.querySelector('[data-hubfinder]');
    if (!panel) return null;
    panel.outerHTML = hubFinder();
    scrollDown();
    return document.querySelector('[data-hubfinder]');
  }

  /* "Nearest to me" only ever means nearest once the rider has actually said
     where they are. The browser asks their permission; if they decline, or
     the device cannot say, the panel asks for an area instead of guessing. */
  function locateRider(from) {
    var panel = from && from.closest ? from.closest('[data-hubfinder]') : null;
    var btn = panel ? panel.querySelector('[data-hub-region="near"]') : null;
    if (!navigator.geolocation) {
      row('<div class="rai-bubble">' + formatResponse(
        'This browser will not share a location with me. Tell me the area you are in and ' +
        'I will find the closest Roam location.') + '</div>', 'bot');
      return;
    }
    if (btn) btn.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      finderState.origin = { n: 'you', lat: pos.coords.latitude, lng: pos.coords.longitude };
      finderState.rg = 'near';
      finderState.all = false;
      redrawFinder(panel);
    }, function () {
      if (btn) btn.textContent = 'Nearest to me';
      row('<div class="rai-bubble">' + formatResponse(
        'No problem, I will not use your location. Tell me the area you are in and I will ' +
        'find the closest Roam location.') + '</div>', 'bot');
    }, { timeout: 8000, maximumAge: 300000 });
  }

  /* A single searchable part: name, number, part/repair/total pricing all
     clearly separated, and one-tap actions into the Roam Cart or My Parts List. */
  function partCard(p) {
    var h = '<div class="rai-part-card" data-part-card="' + p.n + '">' +
      '<div class="rai-part-name">' + esc(p.d) + '</div>' +
      '<div class="rai-part-no">Part No. ' + esc(p.n || '—') + '</div>' +
      '<div class="rai-part-prices">' +
        '<div class="rai-part-price"><div class="l">Part</div><div class="v">' + ksh(p.p) + '</div></div>';
    if (p.r > 0) {
      h += '<div class="rai-part-price"><div class="l">Repair</div><div class="v">' + ksh(p.r) + '</div></div>' +
           '<div class="rai-part-price total"><div class="l">Total</div><div class="v">' + ksh(p.t) + '</div></div>';
    }
    h += '</div><div class="rai-part-vat">VAT included</div>' +
      '<div class="rai-part-actions"><button class="rai-add-btn" data-add-part="' + p.id + '">+ Add to Roam Cart</button></div>' +
      '<button class="rai-save-btn" data-save-part="' + p.id + '">+ Add to My Parts List</button>' +
      '</div>';
    return h;
  }

  /* Several parts named in one message: pre-checked so one tap adds them all,
     but nothing is forced onto the customer's Roam Cart without confirming. */
  function checklistCard(items) {
    var id = ++checklistSeq, h = '<div class="rai-panel rai-checklist-panel" data-checklist="' + id + '">' +
      '<div class="rai-eyebrow">Select Parts</div>';
    items.forEach(function (p, i) {
      var cbId = 'rai-chk-' + id + '-' + i;
      h += '<div class="rai-check-item">' +
        '<input type="checkbox" id="' + cbId + '" data-part="' + p.id + '" checked>' +
        '<label for="' + cbId + '">' + esc(p.d) + '<br><span style="color:var(--faint);font-size:10.5px;">' + p.n + '</span></label>' +
        '<span class="price">' + ksh(p.t) + '</span></div>';
    });
    h += '<button class="rai-add-btn" style="width:100%;margin-top:12px;" data-add-selected>+ Add selected to Roam Cart</button></div>';
    return h;
  }

  /* Ready-made WhatsApp message with every line, part number, quantity and
     the running total, so a rider can hand the whole cart to Roam in one tap. */
  function whatsappCartLink() {
    var t = cartTotals();
    var lines = ['Hi Roam, I would like help with these parts:'];
    cart.forEach(function (b, i) { lines.push((i + 1) + '. ' + b.d + partNo(b) + ' x' + b.q); });
    lines.push('Estimated total: ' + ksh(t.total));
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  /* The Roam Cart itself: quantity steppers, a running total, and the three
     ways out — WhatsApp Roam, Request a Quote, or Call Roam. */
  function cartDrawer() {
    if (!cart.length) {
      return '<div class="rai-cart-drawer"><div class="rai-eyebrow">🛒 Roam Cart</div>' +
        '<div class="rai-lede" style="margin:2px 0 0;">Your Roam Cart is empty. Tell me a part and I will start one for you.</div>' +
        '<div class="rai-cart-tagline">Find it. Add it. Ride on.</div></div>';
    }
    var t = cartTotals();
    var h = '<div class="rai-cart-drawer"><div class="rai-eyebrow">🛒 Roam Cart (' + cartCount() + ')</div>';
    cart.forEach(function (b) {
      h += '<div class="rai-cart-line">' +
        '<div class="rai-cart-line-info"><div class="rai-cart-line-name">' + esc(b.d) + '</div>' +
        '<div class="rai-cart-line-no">' + esc(b.n || 'No part number') + '</div>' +
        '<div class="rai-cart-line-price">' + ksh(b.t) + ' each' + (b.r > 0 ? ' (fitted)' : '') + '</div></div>' +
        '<div class="rai-qty"><button data-qty-minus="' + b.id + '" aria-label="Decrease quantity">&minus;</button>' +
        '<span>' + b.q + '</span><button data-qty-plus="' + b.id + '" aria-label="Increase quantity">+</button></div>' +
        '<button class="rai-cart-remove" data-cart-remove="' + b.id + '" aria-label="Remove">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h8l1-13"/></svg></button>' +
        '</div>';
    });
    h += '<div class="rai-cart-totals">' +
      '<div class="row"><span>Parts subtotal</span><span>' + ksh(t.parts) + '</span></div>' +
      (t.labour > 0 ? '<div class="row"><span>Repair &amp; fitting</span><span>' + ksh(t.labour) + '</span></div>' : '') +
      '<div class="row total"><span>Total</span><span>' + ksh(t.total) + '</span></div></div>' +
      '<div class="rai-actions" style="margin-top:12px;">' +
        '<a class="rai-action primary" href="' + whatsappCartLink() + '" target="_blank" rel="noopener">' + ICON_WA + 'Send Roam Cart on WhatsApp</a>' +
        '<button class="rai-action" data-request-quote>Request a Quote</button>' +
        '<a class="rai-action" href="tel:+' + WHATSAPP + '">' + ICON_CALL + 'Call Roam</a>' +
      '</div>' +
      '<button class="rai-lead-skip" style="width:100%;text-align:center;margin-top:6px;" data-continue-shopping>Continue shopping</button>' +
      '<div class="rai-cart-tagline">Find it. Add it. Ride on.</div>' +
      '</div>';
    return h;
  }

  function updateCartBadge() {
    var el = $('rai-cart-badge');
    if (!el) return;
    var n = cartCount();
    el.textContent = n;
    el.classList.toggle('zero', n === 0);
  }

  /* After a quantity or removal click, redraw the drawer that triggered it in
     place, so the total and line items stay in sync without a fresh bubble. */
  function refreshCartDrawer(fromEl) {
    updateCartBadge();
    var drawer = fromEl.closest('.rai-cart-drawer');
    if (drawer) drawer.outerHTML = cartDrawer();
  }

  /* One-tap link to the real "Book a Free Test Ride" form, shown whenever the
     conversation touches on test rides. Responses land straight in Roam's
     lead sheet, independent of the WhatsApp/call-back lead capture above. */
  function bookRideAction() {
    return '<div class="rai-actions">' +
      '<a class="rai-action primary" href="' + testRideLink() + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 5.9 2 10.7c0 2.7 1.4 5.1 3.6 6.7v3.3c0 .4.5.7.9.4l3.1-2.1c.8.2 1.6.2 2.4.2 5.5 0 10-3.9 10-8.5S17.5 2 12 2z"/></svg>' +
        'Book your free test ride</a>' +
    '</div>';
  }

  /* Offered whenever the answer involves money, so the rider can go straight
     to the full breakdown instead of asking follow-up after follow-up. */
  function calculatorAction(label) {
    return '<div class="rai-actions">' +
      '<a class="rai-action primary" href="' + CALCULATOR_URL + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24"><path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 4v3h10V6H7zm0 5v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v4h2v-4h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2z"/></svg>' +
        (label || 'Open the cost calculator') + '</a>' +
    '</div>';
  }

  /* Shown whenever the assistant cannot answer from knowledge. The visitor
     always leaves with a route to a human rather than a dead end. */
  function quickActions(question) {
    var waText = encodeURIComponent(
      'Hi Roam, I asked your website assistant: "' + question + '." Could you help?'
    );
    return '<div class="rai-actions">' +
      '<a class="rai-action primary" href="https://wa.me/' + WHATSAPP + '?text=' + waText + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.4.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>' +
        'WhatsApp us</a>' +
      '<a class="rai-action" href="tel:+' + WHATSAPP + '">' +
        '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>' +
        'Call</a>' +
      '<button class="rai-action" data-escalate="' + esc(question) + '">' +
        '<svg viewBox="0 0 24 24"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>' +
        'Get me an answer</button>' +
    '</div>';
  }

  /* ==========================================================================
     LEAD CAPTURE
     ========================================================================== */

  // Accepts 07xx / 01xx / +2547xx / 2547xx / 7xx, returns +2547xxxxxxxx or null
  function normalisePhone(raw) {
    var d = String(raw).replace(/[\s\-().]/g, '');
    var m = d.match(/^(?:\+?254|0)?(7\d{8}|1\d{8})$/);
    return m ? '+254' + m[1] : null;
  }

  function leadForm(reason, question) {
    return '<div class="rai-panel rai-lead" id="rai-lead"' +
        (question ? ' data-question="' + esc(question) + '"' : '') + '>' +
      '<div class="rai-eyebrow">' + (question ? 'Get an Answer' : 'Talk to Sales') + '</div>' +
      '<div class="rai-lead-title">' +
        (question ? 'We will get you a proper answer' : 'Want a Roam rep to call you back?') + '</div>' +
      '<div class="rai-lead-sub">' + esc(reason) + ' Leave your number and the team will be in touch, usually the same working day.</div>' +
      (question ? '<div class="rai-quoted"><span>Your question</span>' + esc(question) + '</div>' : '') +
      '<div class="rai-field"><label for="rai-l-name">Your name</label>' +
        '<input type="text" id="rai-l-name" placeholder="e.g. Joseph Mwangi" autocomplete="name">' +
        '<div class="msg" id="rai-e-name">Please enter your name</div></div>' +
      '<div class="rai-field"><label for="rai-l-phone">Phone number</label>' +
        '<input type="tel" id="rai-l-phone" placeholder="07XX XXX XXX" autocomplete="tel" inputmode="tel">' +
        '<div class="msg" id="rai-e-phone">Enter a valid Kenyan number, e.g. 0712 345 678</div></div>' +
      '<div class="rai-field"><label for="rai-l-email">Email <span style="text-transform:none;letter-spacing:0;font-weight:600;">(optional)</span></label>' +
        '<input type="email" id="rai-l-email" placeholder="you@example.com" autocomplete="email"></div>' +
      '<div class="rai-lead-actions">' +
        '<button class="rai-lead-btn" id="rai-l-send">Request a call back</button>' +
        '<button class="rai-lead-skip" id="rai-l-skip">Not now</button></div>' +
      '<div class="rai-lead-privacy">We use your details only to contact you about Roam products. ' +
        'Prefer to talk now? <a href="https://wa.me/' + WHATSAPP + '" target="_blank" rel="noopener" style="color:var(--orange);">WhatsApp us</a> or call ' + PHONE + '.</div>' +
      '</div>';
  }

  function maybeOfferLead(userText) {
    if (leadShown || leadCaptured) return;
    if (!INTENT.test(userText.toLowerCase())) return;
    /* Not on the first answer. Asking one price question is not the same as
       wanting a call back, and a form under the very first reply reads as a
       wall of stuff rather than an answer. Give the rider room to ask a
       second question first. */
    if (turns < 3) return;
    leadShown = true;
    var reason = /\bbus(es)?\b|matatu|shuttle/.test(userText.toLowerCase())
      ? 'Buses are on hold right now, but we will let you know the moment that changes.'
      : 'It sounds like you are weighing up a Roam Air.';
    setTimeout(function () { row(leadForm(reason), 'bot'); }, 550);
  }

  function transcript() {
    return history_.map(function (m) {
      return (m.role === 'user' ? 'Visitor: ' : 'Assistant: ') + m.content;
    }).join('\n');
  }

  // localStorage is wrapped: some embeds (sandboxed iframes) block it entirely
  function queueLead(payload) {
    try {
      var k = 'roamPendingLeads';
      var q = JSON.parse(window.localStorage.getItem(k) || '[]');
      q.push(payload);
      window.localStorage.setItem(k, JSON.stringify(q.slice(-20)));
    } catch (e) { /* storage unavailable, nothing to do */ }
  }
  function flushQueued() {
    if (!LEADS_ENDPOINT) return;
    var k = 'roamPendingLeads', q;
    try { q = JSON.parse(window.localStorage.getItem(k) || '[]'); } catch (e) { return; }
    if (!q.length) return;
    Promise.all(q.map(postLead)).then(function () {
      try { window.localStorage.removeItem(k); } catch (e) {}
    }).catch(function () {});
  }

  function postLead(payload) {
    if (!LEADS_ENDPOINT) return Promise.reject(new Error('no leads endpoint'));
    return fetch(LEADS_ENDPOINT, {
      method: 'POST',
      // text/plain avoids a CORS preflight, which Apps Script does not answer
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error('lead post ' + r.status);
      return r;
    });
  }

  /* Last-ditch delivery when the readable POST fails (typically Apps Script
     CORS). Fire-and-forget: the lead almost certainly lands, but we cannot
     read the response, so we report it as sent-but-unconfirmed rather than
     claiming success. Returns true if something was dispatched. */
  function beaconLead(payload) {
    if (!LEADS_ENDPOINT) return false;
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
        if (navigator.sendBeacon(LEADS_ENDPOINT, blob)) return true;
      }
    } catch (e) { /* fall through */ }
    try {
      fetch(LEADS_ENDPOINT, {
        method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body
      });
      return true;
    } catch (e) { return false; }
  }

  function submitLead() {
    var nameEl = $('rai-l-name'), phoneEl = $('rai-l-phone'), emailEl = $('rai-l-email');
    var name = nameEl.value.trim();
    var phone = normalisePhone(phoneEl.value);
    var email = emailEl.value.trim();
    var ok = true;

    if (name.length < 2) { nameEl.classList.add('err'); $('rai-e-name').classList.add('show'); ok = false; }
    else { nameEl.classList.remove('err'); $('rai-e-name').classList.remove('show'); }

    if (!phone) { phoneEl.classList.add('err'); $('rai-e-phone').classList.add('show'); ok = false; }
    else { phoneEl.classList.remove('err'); $('rai-e-phone').classList.remove('show'); }

    if (!ok) return;

    var btn = $('rai-l-send');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    var leadEl = document.querySelector('.rai-lead[data-question]');
    var askedQuestion = leadEl ? leadEl.getAttribute('data-question') : '';

    var params = new URLSearchParams(window.location.search);
    var payload = {
      secret: LEADS_SECRET,
      name: name,
      phone: phone,
      email: email,
      interest: 'Roam Air',
      // populated when the visitor asked something we could not answer:
      // this is the exact question the rep needs to come back on
      unansweredQuestion: askedQuestion,
      transcript: transcript(),
      page: window.location.href,
      referrer: document.referrer || '',
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      submittedAt: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    // remember them, so the booking form opens already filled in
    known.name = name; known.phone = phone; known.email = email;

    postLead(payload).then(function () {
      leadCaptured = true;
      showLeadDone('confirmed');
    }).catch(function () {
      var dispatched = beaconLead(payload);
      if (!dispatched) queueLead(payload);   // retried on the next page view
      leadCaptured = true;
      showLeadDone(dispatched ? 'unconfirmed' : 'queued');
    });
  }

  function showLeadDone(state) {
    var el = $('rai-lead');
    if (!el) return;
    el.id = '';
    var msg;
    if (state === 'confirmed') {
      msg = 'A Roam rep will call you, usually the same working day. In the meantime, ask me anything else.';
    } else if (state === 'unconfirmed') {
      msg = 'A Roam rep will call you, usually the same working day. If you would rather not wait, ' +
        '<a href="https://wa.me/' + WHATSAPP + '" target="_blank" rel="noopener" style="color:var(--orange);">message us on WhatsApp</a>.';
    } else {
      msg = 'We could not reach our server just now, so your request is saved and will send automatically. ' +
        'To be certain of a reply, <a href="https://wa.me/' + WHATSAPP + '" target="_blank" rel="noopener" style="color:var(--orange);">message us on WhatsApp</a> or call ' + PHONE + '.';
    }
    el.innerHTML = '<div class="rai-lead-done"><div class="rai-lead-tick">&#10003;</div><div>' +
      '<div class="rai-lead-title" style="margin-bottom:4px;">Thank you, we have your details.</div>' +
      '<div class="rai-lead-sub" style="margin-bottom:0;">' + msg + '</div></div></div>';
    scrollDown();
  }

  /* ==========================================================================
     ROAM PARTS QUOTE REQUEST
     Shown from the Roam Cart. Carries the cart contents and total, and asks
     only for what is needed to follow up: name, phone, location, a note.
     ========================================================================== */
  function quoteForm() {
    var t = cartTotals(), s = '<div class="rai-pq-summary">';
    cart.forEach(function (b) {
      s += (b.q > 1 ? b.q + ' x ' : '') + esc(b.d) + ' — ' + ksh(b.t * b.q) + '<br>';
    });
    s += '<b>Estimated total: ' + ksh(t.total) + '</b></div>';
    return '<div class="rai-panel rai-lead" id="rai-pq">' +
      '<div class="rai-eyebrow">Roam Parts Quote Request</div>' +
      '<div class="rai-lead-title">Tell us where you are and we will complete your parts request.</div>' +
      s +
      '<div class="rai-field"><label for="rai-pq-name">Your name</label>' +
        '<input type="text" id="rai-pq-name" placeholder="e.g. Joseph Mwangi" autocomplete="name">' +
        '<div class="msg" id="rai-pq-e-name">Please enter your name</div></div>' +
      '<div class="rai-field"><label for="rai-pq-phone">Phone number</label>' +
        '<input type="tel" id="rai-pq-phone" placeholder="07XX XXX XXX" autocomplete="tel" inputmode="tel">' +
        '<div class="msg" id="rai-pq-e-phone">Enter a valid Kenyan number, e.g. 0712 345 678</div></div>' +
      '<div class="rai-field"><label for="rai-pq-location">Location</label>' +
        '<input type="text" id="rai-pq-location" placeholder="e.g. Kisumu, or your nearest Roam Hub">' +
        '<div class="msg" id="rai-pq-e-location">Please tell us your location</div></div>' +
      '<div class="rai-field"><label for="rai-pq-note">Note <span style="text-transform:none;letter-spacing:0;font-weight:600;">(optional)</span></label>' +
        '<input type="text" id="rai-pq-note" placeholder="Anything else Roam should know"></div>' +
      '<div class="rai-lead-actions">' +
        '<button class="rai-lead-btn" id="rai-pq-send">Send quote request</button>' +
        '<button class="rai-lead-skip" id="rai-pq-skip">Not now</button></div>' +
      '<div class="rai-lead-privacy">This is a draft estimate, not a final price. Roam will confirm current price, availability, compatibility and fitting.</div>' +
      '</div>';
  }

  function submitPartsQuote() {
    var nameEl = $('rai-pq-name'), phoneEl = $('rai-pq-phone'), locEl = $('rai-pq-location'), noteEl = $('rai-pq-note');
    var name = nameEl.value.trim();
    var phone = normalisePhone(phoneEl.value);
    var location = locEl.value.trim();
    var ok = true;

    if (name.length < 2) { nameEl.classList.add('err'); $('rai-pq-e-name').classList.add('show'); ok = false; }
    else { nameEl.classList.remove('err'); $('rai-pq-e-name').classList.remove('show'); }

    if (!phone) { phoneEl.classList.add('err'); $('rai-pq-e-phone').classList.add('show'); ok = false; }
    else { phoneEl.classList.remove('err'); $('rai-pq-e-phone').classList.remove('show'); }

    if (location.length < 2) { locEl.classList.add('err'); $('rai-pq-e-location').classList.add('show'); ok = false; }
    else { locEl.classList.remove('err'); $('rai-pq-e-location').classList.remove('show'); }

    if (!ok) return;

    var btn = $('rai-pq-send');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    var t = cartTotals();
    var itemsText = cart.map(function (b) { return b.q + ' x ' + b.d + partNo(b); }).join('; ');
    var params = new URLSearchParams(window.location.search);
    var payload = {
      secret: LEADS_SECRET,
      name: name,
      phone: phone,
      email: '',
      location: location,
      interest: 'Roam Parts Quote',
      note: noteEl.value.trim(),
      items: itemsText,
      estimatedTotal: ksh(t.total),
      unansweredQuestion: '',
      transcript: transcript(),
      page: window.location.href,
      referrer: document.referrer || '',
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      submittedAt: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    known.name = name; known.phone = phone;

    postLead(payload).then(function () {
      leadCaptured = true;
      showQuoteDone('confirmed');
    }).catch(function () {
      var dispatched = beaconLead(payload);
      if (!dispatched) queueLead(payload);
      leadCaptured = true;
      showQuoteDone(dispatched ? 'unconfirmed' : 'queued');
    });
  }

  function showQuoteDone(state) {
    var el = $('rai-pq');
    if (!el) return;
    el.id = '';
    var msg;
    if (state === 'confirmed') {
      msg = 'A Roam rep will confirm your parts and price, usually the same working day.';
    } else if (state === 'unconfirmed') {
      msg = 'Your request is on its way. If you would rather not wait, ' +
        '<a href="https://wa.me/' + WHATSAPP + '" target="_blank" rel="noopener" style="color:var(--orange);">message us on WhatsApp</a>.';
    } else {
      msg = 'We could not reach our server just now, so your request is saved and will send automatically. ' +
        'To be certain of a reply, <a href="https://wa.me/' + WHATSAPP + '" target="_blank" rel="noopener" style="color:var(--orange);">message us on WhatsApp</a> or call ' + PHONE + '.';
    }
    el.innerHTML = '<div class="rai-lead-done"><div class="rai-lead-tick">&#10003;</div><div>' +
      '<div class="rai-lead-title" style="margin-bottom:4px;">Thank you, we have your quote request.</div>' +
      '<div class="rai-lead-sub" style="margin-bottom:0;">' + msg + '</div></div></div>';
    scrollDown();
  }

  /* ==========================================================================
     ANSWERING
     ========================================================================== */
  function askBackend(msg) {
    history_.push({ role: 'user', content: msg });
    if (!API_ENDPOINT) return Promise.reject(new Error('no api endpoint'));
    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: SYSTEM_PROMPT, messages: history_ })
    }).then(function (r) {
      if (!r.ok) throw new Error('api ' + r.status);
      return r.json();
    }).then(function (d) {
      // Accepts Anthropic, OpenAI and Perplexity response shapes, plus {reply}
      var reply =
        (d.content && d.content[0] && d.content[0].text) ||
        (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) ||
        d.reply;
      if (!reply) throw new Error('empty');
      reply = String(reply).trim();
      history_.push({ role: 'assistant', content: reply });
      return { text: reply, unresolved: false };
    });
  }

  /* ==========================================================================
     ANSWERING PIPELINE
       intent detection -> category-constrained retrieval -> relevance check
       -> answer, or escalation if the category holds no verified answer.
     A correct "I do not have confirmed information on that" is always better
     than an irrelevant, inferred or invented answer.
     ========================================================================== */

  /* --------------------------------------------------------------------------
     LANGUAGE NORMALISATION
     Riders do not write formal English. Swahili, Sheng, mixed phrasing, short
     messages and typos are all rewritten into plain English terms first, so
     intent classification works on meaning rather than on exact wording.
     -------------------------------------------------------------------------- */
  var LEXICON = [
    // multi-word first, longest first
    [/\bmi\s+nataka\b/g,        'i want'],
    [/\bnataka\s+kununua\b/g,   'i want to buy'],
    [/\bnataka\s+kuchukua\b/g,  'i want to take'],
    [/\bnaweza\s+kupata\b/g,    'can i get'],
    [/\bnaeza\s+kupata\b/g,     'can i get'],
    [/\bnaweza\s+kununua\b/g,   'can i buy'],
    [/\bnaeza\s+kununua\b/g,    'can i buy'],
    [/\bkwa\s+siku\b/g,         'per day'],
    [/\bkila\s+siku\b/g,        'every day'],
    [/\bni\s+ngapi\b/g,         'how much'],
    [/\bgharama\s+gani\b/g,     'how much cost'],
    [/\bbei\s+gani\b/g,         'what price'],
    // single words
    [/\bna(e|we)za\b/g,         'can i'],
    [/\bnataka\b/g,             'i want'],
    [/\bnahitaji\b/g,           'i need'],
    [/\bnunua\b|\bkununua\b/g,  'buy'],
    [/\binauzwa\b|\bmnauza\b/g, 'sell'],
    [/\bniongezee\b|\bongezea\b/g, 'add me'],
    [/\bongeza\b/g,             'add'],
    [/\bpunguza\b/g,            'reduce'],
    [/\btoa\b|\bondoa\b/g,      'remove'],
    [/\bnapata\b|\bkupata\b|\bpata\b/g, 'get'],
    [/\bkuchukua\b|\bchukua\b/g,'take'],
    [/\bwapi\b/g,               'where'],
    [/\biko\b|\bipo\b|\bziko\b/g, 'is'],
    [/\bngapi\b/g,              'how much'],
    [/\bbei\b/g,                'price'],
    [/\bpesa\b/g,               'money'],
    [/\bmalipo\b/g,             'payment'],
    [/\bnyumbani\b/g,           'at home'],
    [/\binacharge\b|\bkucharge\b/g, 'charging'],
    [/\binafika\b|\bfika\b/g,   'reach how far'],
    [/\bnaanzia\b/g,            'deposit to start'],
    [/\bbetri\b/g,              'battery'],
    [/\bpikipiki\b/g,           'motorcycle'],
    [/\bduka\b|\bmaduka\b/g,    'shop'],
    [/\bmoja\b/g,               'one'],
    [/\bmbili\b/g,              'two'],
    [/\bhiyo\b|\bhii\b/g,       'that'],
    [/\bsasa\b/g,               'now'],
    [/\blini\b/g,               'when'],
    [/\bvipi\b/g,               'how about'],
    [/\bmuda\b/g,               'time'],
    [/\bmzigo\b/g,              'load'],
    [/\bnini\b/g,               'what'],
    [/\bkweli\b/g,              'really'],
    // location wording riders actually use
    [/\bniko\b|\bnipo\b/g,      'i am at'],
    [/\bnipe\b/g,               'give me'],
    [/\bkuna\b/g,               'is there'],
    [/\binapatikana\b|\bzinapatikana\b/g, 'is available'],
    [/\bkaribu na\b/g,          'near'],
    [/\bmahali\b|\bpahali\b/g,  'place'],
    [/\bkituo\b|\bvituo\b/g,    'station'],
    [/\bnambari\b|\bnamba\b/g,  'number'],
    [/\bsimu\b/g,               'phone'],
    [/\bmatengenezo\b|\bkurekebisha\b|\brekebisha\b/g, 'repair'],
    [/\bkukodisha\b|\bkukodi\b/g, 'rent'],
    // common typos and shorthand
    [/\bchargin\b|\bcharjing\b|\bcharginq\b/g, 'charging'],
    [/\bbatery\b|\bbattry\b|\bbatry\b/g,       'battery'],
    [/\bfinacing\b|\bfinancin\b|\bfynance\b/g, 'financing'],
    [/\bmotobike\b|\bmotobyke\b|\bmotorbike\b/g, 'motorcycle'],
    [/\bhw\b/g, 'how'], [/\bwat\b/g, 'what'], [/\bwher\b/g, 'where'],
    [/\bpls\b|\bplz\b/g, 'please'], [/\bu\b/g, 'you'], [/\br\b/g, 'are'],
    [/\bcn\b/g, 'can'], [/\bd\b/g, 'the'], [/\bnid\b/g, 'need']
  ];

  function normalise(text) {
    // Commas are kept (unlike every other punctuation mark) because the parts
    // engine uses them to split a multi-item request such as "brake cable,
    // headlight and rear shock" into separate searches. findParts() strips
    // them again itself before scoring, so nothing downstream sees them.
    var q = String(text).toLowerCase()
      .replace(/[’`]/g, "'")
      .replace(/[^a-z0-9',?\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    for (var i = 0; i < LEXICON.length; i++) q = q.replace(LEXICON[i][0], LEXICON[i][1]);
    return q.replace(/\s+/g, ' ').trim();
  }

  /* Genuinely ambiguous: "Roam iko wapi?" could mean a shop to buy from, a
     charging point, or head office. One short clarification, not a guess and
     not an escalation. */
  var AMBIGUOUS = /^(roam\s+)?(is\s+)?where\s*\??$|^where\s+(is|are)\s+roam\s*\??$|^roam\s*\??$|^where\s*\??$/;

  var STOP = { what:1,when:1,where:1,which:1,does:1,the:1,and:1,for:1,you:1,your:1,can:1,are:1,
               it:1,to:1,of:1,do:1,my:1,me:1,on:1,how:1,much:1,about:1,with:1,have:1,has:1,
               get:1,got:1,tell:1,there:1,they:1,this:1,that:1,from:1,will:1,would:1,should:1,
               is:1,in:1,at:1,a:1,an:1,any:1,please:1,roam:1 };

  function tokens(q) {
    return q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) {
      return w.length > 2 && !STOP[w];
    });
  }

  function titleCase(s) {
    return s.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  function topicFor(cat) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].c === cat) return TOPICS[i].a;
    return null;
  }

  /* Retrieval is limited to one category and must clear a real score, so a
     question is never answered with a fact from a different subject. */
  function bestFaqIn(cat, q) {
    var words = tokens(q), best = null, bestScore = 0;
    FAQ.forEach(function (f) {
      if (f.c !== cat) return;
      var hq = f.q.toLowerCase(), score = 0;
      words.forEach(function (w) {
        var s = w.length > 5 ? w.slice(0, 5) : w;
        if (hq.indexOf(s) !== -1) score += s.length * 2;
      });
      if (score > bestScore) { bestScore = score; best = f; }
    });
    return bestScore >= 10 ? best : null;
  }

  var LOC_FRAME = /where (are|is) (you|your|roam)|are (you|there|roam)\b[\s\S]{0,20}\b(in|at|near)\b|is (roam|there)\b[\s\S]{0,25}\b(in|at|near)\b|do (you|they) have\b[\s\S]{0,30}\b(in|at|near)\b|(shop|shops|hub|hubs|branch|branches|outlet|dealer|showroom|store|office|roam point|service cent(re|er))s?\b[\s\S]{0,12}\b(in|at|near)\b|nearest (shop|hub|point|branch|dealer|outlet|store|service)|available (in|at)|located (in|at)|operate (in|at)|coverage (in|at)|present in|presence in/;

  /* Returns a place name, '' when the phrase is not a place at all, or null
     when the question contains no place phrase. */
  function extractPlace(q) {
    // "nearest hub to Mombasa", "closest shop from Nakuru"
    var m = q.match(/\b(?:nearest|closest)\b[a-z ]{0,24}?\b(?:to|from|in|at|near)\s+([a-z][a-z' -]{2,32})/);
    if (!m) m = q.match(/\b(?:in|at|near|around)\s+([a-z][a-z' -]{2,32})/);
    if (!m) return null;
    var raw = m[1].split(/[?.,!]/)[0].trim().split(/\s+/).slice(0, 3).join(' ');
    if (!raw || NOT_A_PLACE.test(raw.split(/\s+/)[0])) return '';
    return raw;
  }

  /* Country availability. Never speculate about a market that is not active. */
  function countryAnswer(q) {
    var m = q.match(OTHER_COUNTRY);
    if (!m) return null;
    return { text: FALLBACK.country.replace('{x}', titleCase(m[0])),
             unresolved: true, forced: true, cat: 'country' };
  }

  /* ==========================================================================
     ROAM HUB FINDER: the location query engine
     Everything here answers from HUBS and nothing else. A service is read off
     the station's own record, never inherited from another hub; a place that
     is not in the table is unknown and says so; and no answer here is ever
     handed to the model, so none of it can be talked into an invention.
     ========================================================================== */

  var HUB_CH      = /charg|\bchaji\b/;
  var HUB_RE      = /\brent\w*\b|\bhire\b|\bborrow\b|(spare|extra|another|second)\s+batter/;
  var HUB_AS      = /after.?sales|servic\w*|repair\w*|\bfix\b|\bmechanic\b|maintenance|\bmatengenezo\b/;
  var HUB_SH      = /\bshops?\b|\bstores?\b|(buy|get|purchase|order|sell)\b[\s\S]{0,26}\b(part|parts|spare|spares|accessor\w*)\b|\b(parts?|spares?)\b[\s\S]{0,22}\b(shop|store|buy|sold|available)\b/;
  var HUB_WORD    = /\bhubs?\b|\bstations?\b|\bkituo\b|\bvituo\b|roam point|charging point|\bbranch(es)?\b|\boutlets?\b|service cent(re|er)/;
  var HUB_WHERE   = /\bwhere\b|\bnearest\b|\bclosest\b|\bnear me\b|\bnearby\b|\baround me\b|\bdirections?\b|\blocations?\b|\blocate\b|which (hub|station|branch|shop|cent(re|er))|list (all |the )?(hub|station|location)|show me (all |the )?(hub|station|location)/;
  var HUB_GENERIC = /where (are|is) (you|your|roam)\b|where (can|do) i (find|see|visit)\b|your (locations?|branch\w*|shops?|offices?|hubs?)\b|roam (locations?|shops?|hubs?)\b|all (your |the )?(locations?|hubs?|stations?)\b/;
  var HUB_HERE    = /\bi am (in|at|near|around)\b|\bi'm (in|at|near|around)\b|\bi live (in|at|near)\b|\bi stay (in|at|near)\b|\bi am going to\b|\bgoing to\b|\bheaded (to|for)\b/;
  var HUB_CONTACT = /\bphone\b|\bnumbers?\b|\bcall\b|\bcontact\b|\bwhatsapp\b|\btel\b/;
  var HUB_LAUNCH  = /\blaunch\w*\b|\bopened\b|when did[\s\S]{0,30}\b(open|start)\b/;
  /* Charging at home is a charging question, not a location question. */
  var HUB_HOME    = /\bat home\b|home charg|\bhouse\b|\bsocket\b|\boutlet\b(?![\s\S]{0,10}\bnear)|plug it in|\bovernight\b|wall charger/;

  /* "Do you have after-sales?" is a plain yes-or-no about whether Roam does
     the thing at all. There is no place in it, so the location engine used to
     let it fall through to the escalation even though the answer is a clear
     yes. These match the asking, and the service nouns below are deliberately
     narrower than HUB_CH/HUB_SH so that "do you have a 20A charger" stays a
     parts question and "do you have this part in stock" stays a stock one. */
  var HUB_OFFER   = /\b(do|does)\s+(you|u|roam|they)\b|\b(are|is)\s+(you|u|roam|they)\b[\s\S]{0,14}\b(hav\w*|offer\w*|provid\w*|doing|giving)\b|\b(is|are) there\b|\bmna\b|\bmko na\b|\bkuna\b|\b(mna|una|wana)fanya\b/;
  var OFFER_CH    = /\bcharging\b|\bchaji\b/;
  var OFFER_RE    = /\bbattery (rental|hire|swap)\b|\brentals?\b|\brent (a |an )?batter/;
  var OFFER_AS    = /after.?sales|\bafter sale\b|\bservicing\b|\bservices?\b|\brepairs?\b|\bmaintenance\b|\bmatengenezo\b/;
  var OFFER_SH    = /\bshops?\b|\bstores?\b/;
  var OFFER_NAMES = { ch:'charging', re:'battery rental', as:'after-sales', sh:'parts shops' };

  function hubDigits(h) { return h.ph ? h.ph.replace(/\D/g, '') : ''; }
  function hubMaps(h) {
    return 'https://www.google.com/maps/search/?api=1&query=' + h.lat + ',' + h.lng;
  }
  function hubName(h) { return 'Roam Hub – ' + h.s; }

  /* Straight-line kilometres. Good enough to rank stations; never presented
     as a driving distance. */
  function kmBetween(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var la = a.lat * rad, lb = b.lat * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(la) * Math.cos(lb);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  /* Two stations share the word "Machakos", so the more specific wording wins
     when it is present and both are offered when it is not. */
  function matchStations(q) {
    var exact = HUBS.filter(function (h) { return h.kx && h.kx.test(q); });
    if (exact.length) return exact;
    return HUBS.filter(function (h) { return h.k.test(q); });
  }
  function matchArea(q) {
    for (var i = 0; i < AREAS.length; i++) if (AREAS[i].k.test(q)) return AREAS[i];
    return null;
  }
  function matchPartner(q) {
    for (var i = 0; i < PARTNERS.length; i++) if (PARTNERS[i].k.test(q)) return PARTNERS[i];
    return null;
  }

  var SERVICE_KEYS  = ['ch', 're', 'as', 'sh'];
  var SERVICE_NAMES = { ch:'charging', re:'battery rental', as:'after-sales', sh:'a shop' };
  var SERVICE_TAGS  = { ch:'⚡ Charging', re:'🔋 Battery rental',
                        as:'🔧 After-sales', sh:'🏪 Shop' };

  function hubWants(q) {
    return { ch: HUB_CH.test(q) ? 1 : 0, re: HUB_RE.test(q) ? 1 : 0,
             as: HUB_AS.test(q) ? 1 : 0, sh: HUB_SH.test(q) ? 1 : 0 };
  }
  function wantCount(w) {
    var n = 0; SERVICE_KEYS.forEach(function (k) { if (w[k]) n++; }); return n;
  }
  /* Combination filters are an AND, so "charge and rent a battery" returns
     only the stations whose own record lists both. */
  function hubsMatching(w) {
    return HUBS.filter(function (h) {
      return SERVICE_KEYS.every(function (k) { return !w[k] || h[k]; });
    });
  }
  function wantsPhrase(w) {
    var parts = SERVICE_KEYS.filter(function (k) { return w[k]; })
                            .map(function (k) { return SERVICE_NAMES[k]; });
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }
  function listNames(hs) {
    return hs.map(function (h) { return hubName(h); }).join(', ');
  }
  function hubEscalation() {
    return '\nIf you need it confirmed, WhatsApp or call Roam on ' + PHONE + '.';
  }

  /* The finder panel's own state, so tapping a region or a service filter
     re-renders the same panel in place rather than starting a new answer. */
  var finderState = { rg:'all', q:'', f:{ ch:0, re:0, as:0, sh:0 }, all:false, origin:null };
  function setFinder(o) {
    finderState = { rg: o.rg || 'all', q: o.q || '',
                    f: { ch:(o.f&&o.f.ch)?1:0, re:(o.f&&o.f.re)?1:0,
                         as:(o.f&&o.f.as)?1:0, sh:(o.f&&o.f.sh)?1:0 },
                    all: !!o.all, origin: o.origin || null };
    return finderState;
  }

  function stationReply(text, hubs, full) {
    return { text: text, unresolved: false, forced: true, cat: 'hub_location',
             ui: 'hubs', hubs: hubs, full: !!full };
  }
  function finderReply(text, state) {
    setFinder(state || {});
    return { text: text, unresolved: false, forced: true, cat: 'hub_location', ui: 'hubFinder' };
  }

  /* One station, one service: answered from that station's own row. */
  function serviceAtStation(h, w) {
    var yes = SERVICE_KEYS.filter(function (k) { return w[k] && h[k]; });
    var no  = SERVICE_KEYS.filter(function (k) { return w[k] && !h[k]; });
    var t;
    if (!no.length) {
      t = 'Yes. ' + hubName(h) + ' is listed as offering ' +
          wantsPhrase({ ch:w.ch&&h.ch, re:w.re&&h.re, as:w.as&&h.as, sh:w.sh&&h.sh }) + '.';
    } else if (!yes.length) {
      t = no.map(function (k) { return SERVICE_NAMES[k]; }).join(' and ') +
          ' is not listed for ' + hubName(h) + ' in my current location data.';
      t = t.charAt(0).toUpperCase() + t.slice(1);
      var alt = hubsMatching(w).sort(function (a, b) {
        return kmBetween(h, a) - kmBetween(h, b);
      })[0];
      if (alt) t += '\nThe closest listed one is ' + hubName(alt) + '.';
    } else {
      t = hubName(h) + ' is listed for ' + yes.map(function (k) { return SERVICE_NAMES[k]; }).join(' and ') +
          ', but not for ' + no.map(function (k) { return SERVICE_NAMES[k]; }).join(' or ') + '.';
    }
    return stationReply(t, no.length && !yes.length && hubsMatching(w).length
      ? [h, hubsMatching(w).sort(function (a, b) { return kmBetween(h, a) - kmBetween(h, b); })[0]]
      : [h], true);
  }

  /* Rank the listed stations around a place the rider actually named. Nothing
     is called "nearest" unless there is a location to measure from, and a
     town with nothing within 60 km is told so rather than sold a hub 300 km
     away as though it were close. */
  function nearestReply(origin, w, label) {
    var pool = wantCount(w) ? hubsMatching(w) : HUBS.filter(function (h) {
      return h.ch || h.re || h.as || h.sh;
    });
    if (!pool.length) {
      return stationReply('No Roam location in my current data lists ' + wantsPhrase(w) + '.' +
        hubEscalation(), [], false);
    }
    var ranked = pool.map(function (h) {
      return { h: h, km: kmBetween(origin, h) };
    }).sort(function (a, b) { return a.km - b.km; });

    var svc = wantCount(w) ? ' for ' + wantsPhrase(w) : '';
    if (ranked[0].km > 60) {
      return stationReply('I do not have a Roam location listed near ' + label + '.\n' +
        'The closest one on my list' + svc + ' is ' + hubName(ranked[0].h) +
        ', roughly ' + Math.round(ranked[0].km) + ' km away.' + hubEscalation(),
        [ranked[0].h], false);
    }
    var top = ranked.slice(0, 3);
    return finderReply('Closest to ' + label + svc + ': ' + hubName(top[0].h) +
      (top.length > 1 ? ', then ' + listNames(top.slice(1).map(function (r) { return r.h; })) : '') + '.',
      { rg:'near', f:w, origin:{ n:label, lat:origin.lat, lng:origin.lng } });
  }

  function hubAnswer(q) {
    if (HUB_HOME.test(q) && !HUB_WORD.test(q)) return null;

    var st       = matchStations(q);
    var w        = hubWants(q);
    var any      = wantCount(w) > 0;
    var frame    = HUB_WHERE.test(q) || LOC_FRAME.test(q);
    var hubWord  = HUB_WORD.test(q);
    var contact  = HUB_CONTACT.test(q);
    var launch   = HUB_LAUNCH.test(q);
    var box      = /\bcontainers?\b/.test(q);
    var here     = HUB_HERE.test(q);
    var generic  = HUB_GENERIC.test(q);
    var partner  = matchPartner(q);
    var area     = matchArea(q);
    var nearWord = /\bnearest\b|\bclosest\b|\bnear me\b|\baround me\b|\bnearby\b/.test(q);

    /* "Do you have after-sales?" — no place, just asking whether Roam does it. */
    var ow = { ch: OFFER_CH.test(q) ? 1 : 0, re: OFFER_RE.test(q) ? 1 : 0,
               as: OFFER_AS.test(q) ? 1 : 0, sh: OFFER_SH.test(q) ? 1 : 0 };
    var offer = HUB_OFFER.test(q) && wantCount(ow) > 0;

    /* ---- a named station ------------------------------------------------ */
    if (st.length) {
      if (!(frame || any || contact || launch || box || here || hubWord)) return null;

      if (st.length === 1) {
        var h = st[0];
        if (launch) {
          return stationReply(h.ld
            ? hubName(h) + ' launched on ' + h.ld + '.'
            : 'I do not have a launch date for ' + hubName(h) + ' in my current location data.',
            [h], true);
        }
        if (box && !any) {
          return stationReply(hubName(h) + (h.co ? ' is listed as a container site.'
                                                 : ' is not listed as a container site.'), [h], true);
        }
        if (contact && !any && !frame) {
          return stationReply(h.ph
            ? 'The number for ' + hubName(h) + ' is ' + h.ph + '.'
            : 'I do not have a confirmed phone number for ' + hubName(h) +
              ' in my current location data.\nRoam customer support is on ' + PHONE + '.',
            [h], true);
        }
        if (any) return serviceAtStation(h, w);
        return stationReply('Here is ' + hubName(h) + '.', [h], true);
      }

      /* Two stations answer to the same town name. */
      var hit = any ? st.filter(function (x) {
        return SERVICE_KEYS.every(function (k) { return !w[k] || x[k]; });
      }) : st;
      if (!hit.length) {
        return stationReply('None of the ' + st.length + ' listed Roam locations there lists ' +
          wantsPhrase(w) + '.\nThey are ' + listNames(st) + '.' + hubEscalation(), st, true);
      }
      return stationReply(hit.length === 1
        ? 'That is ' + hubName(hit[0]) + '.'
        : 'There are ' + hit.length + ' listed Roam locations there.', hit, true);
    }

    /* ---- no station named ----------------------------------------------- */
    if (!(frame || hubWord || here || generic || offer)) return null;
    if (!any && !hubWord && !partner && !generic && !offer && !(area && (frame || here))) return null;

    /* A partner brand used as the landmark: "which Total stations have Roam?" */
    if (partner && (hubWord || frame)) {
      var pool = HUBS.filter(function (h) { return h.pa === partner.n; });
      if (any) pool = pool.filter(function (h) {
        return SERVICE_KEYS.every(function (k) { return !w[k] || h[k]; });
      });
      if (!pool.length) {
        return stationReply('I do not have a ' + partner.n + ' site listed' +
          (any ? ' with ' + wantsPhrase(w) : '') + ' in my current location data.' + hubEscalation(),
          [], false);
      }
      return stationReply(pool.length + ' Roam location' + (pool.length === 1 ? '' : 's') +
        ' hosted by ' + partner.n + ':', pool, false);
    }

    /* A place the rider named that is not a Roam location and not somewhere I
       can measure from. Say so; never answer it with a product fact. */
    var unknown = extractPlace(q);
    if (!area && unknown) {
      return { text: 'I do not have a confirmed Roam location at ' + titleCase(unknown) +
          ' in my current location data.\n' +
          'Tell me the nearest area or town and I will find the closest listed Roam Hub, or ' +
          'WhatsApp or call Roam on ' + PHONE + ' to confirm.',
        unresolved: true, forced: true, cat: 'hub_location' };
    }

    if (area) return nearestReply(area, w, area.n);

    /* Nothing to measure from. Offer the finder rather than guessing. */
    var matching = hubsMatching(w);
    var lead;
    if (nearWord) {
      lead = 'Sure, what area are you in? I will find the closest Roam location' +
             (any ? ' for ' + wantsPhrase(w) : '') + '.\nOr pick one from the list below.';
    } else if (offer && matching.length) {
      /* Answer the yes-or-no first, then show where. A rider who asks whether
         Roam does after-sales wants to hear yes, not a list. */
      var on = SERVICE_KEYS.filter(function (k) { return ow[k]; })
                           .map(function (k) { return OFFER_NAMES[k]; });
      lead = 'Yes, Roam has ' +
             (on.length === 1 ? on[0]
                              : on.slice(0, -1).join(', ') + ' and ' + on[on.length - 1]) + '.\n' +
             matching.length + ' of the Roam locations I have list ' + wantsPhrase(w) +
             '. Tap one to open it in Google Maps.' +
             (ow.as ? '\nFor parts and a draft quote, ask me for Roam Parts and I will open the catalogue here in the chat.' : '');
    } else if (any) {
      lead = matching.length + ' Roam location' + (matching.length === 1 ? '' : 's') +
             ' list' + (matching.length === 1 ? 's' : '') + ' ' + wantsPhrase(w) + '.' +
             (matching.length ? ' Tap one to open it in Google Maps.' : hubEscalation());
    } else {
      lead = 'Here are the Roam locations I have. Filter by what you need, or tell me your area ' +
             'and I will find the closest one.';
    }
    return finderReply(lead, { f:w });
  }

  /* Location availability. A place that is not in the approved database is
     unknown, and unknown means escalate. It is never turned into a product
     answer, a nearby town, or an implied presence. */
  function locationAnswer(q) {
    if (!LOC_FRAME.test(q)) return null;
    // "are you open at 8am" is a question about hours, not about a place
    if (/what time|when (do|are) you|\bopen(ing|s)?\b|\bclos(e|ed|ing)\b|\d\s?(am|pm)\b|o'?clock|business hours|working hours/.test(q)) return null;
    var i;
    for (i = 0; i < PLACES.length; i++) {
      if (PLACES[i].k.test(q)) return { text: PLACES[i].a, unresolved: false, cat: 'locations' };
    }
    var p = extractPlace(q);
    if (p === '') return null;                       // "are you in stock", not a place
    if (p === null || ACTIVE_COUNTRY.test(q)) {      // "where are you located"
      return { text: topicFor('locations'), unresolved: false, cat: 'locations' };
    }
    return { text: FALLBACK.location.replace('{x}', titleCase(p)),
             unresolved: true, forced: true, cat: 'locations' };
  }

  /* ==========================================================================
     AFTER-SALES ENGINE
     Part search by number, description, everyday wording, Swahili and Sheng.
     Cart, quantities and a draft quote. Every figure comes from the
     catalogue. Nothing here invents a part, a price, stock, fitment,
     delivery or an appointment.
     ========================================================================== */

  var cart = [];        // Roam Cart — [{ n, d, p, r, t, q }]
  var savedList = [];   // My Parts List — save-for-later, lighter than the cart
  var lastPart = null;  // last single part resolved, so "will it fit" / "add it" know what "it" means
  var checklistSeq = 0; // unique id suffix for each rendered selection checklist

  function ksh(v) {
    var s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, '');
    return 'KES ' + s.replace(/\B(?=(\d{3})+(?!\d)(\.|$))/g, ',');
  }

  /* " (10000131.A1)", or nothing at all for the one catalogue row that has
     no part number, so a line never reads "Shaft Replacement ()". */
  function partNo(p) { return p.n ? ' (' + p.n + ')' : ''; }

  /* Words that carry no meaning when matching a part description. */
  var PSTOP = { the:1, a:1, an:1, my:1, for:1, of:1, and:1, is:1, it:1, to:1, on:1,
                how:1, much:1, price:1, cost:1, need:1, want:1, add:1, buy:1, get:1,
                roam:1, air:1, bike:1, motorcycle:1, part:1, parts:1, new:1, one:1,
                please:1, what:1, does:1, do:1, i:1, me:1, you:1, your:1, can:1,
                broken:1, damaged:1, replace:1, replacement:1, spare:1, quote:1,
                bike:1, bikes:1, motorcycle:1, motorcycles:1, electric:1, batteries:1,
                two:1, three:1, four:1, five:1, another:1, more:1, special:1, some:1 };

  function partTokens(q) {
    return q.replace(/[^a-z0-9.\s]/g, ' ').split(/\s+/)
            .filter(function (w) {
              return w.length > 2 && !PSTOP[w] && !/^[0-9.]+$/.test(w);
            });
  }

  /* Returns matching catalogue rows, best first. */
  function findParts(q) {
    var i, hits = [];

    // 1. Exact part number wins outright.
    var pn = q.match(/\b(\d{8})\s*\.?\s*([a-z]\d)\b/i);
    if (pn) {
      var want = (pn[1] + '.' + pn[2]).toUpperCase();
      for (i = 0; i < PARTS.length; i++) if (PARTS[i].n === want) return [PARTS[i]];
    }

    // 2. Everyday wording mapped to catalogue wording.
    var terms = [];
    for (i = 0; i < PART_ALIASES.length; i++) {
      if (PART_ALIASES[i].w.test(q)) terms.push(PART_ALIASES[i].t);
    }
    var words = partTokens(q).concat(terms.join(' ').split(' ').filter(Boolean));
    if (!words.length) return [];
    // A single loose word is not enough. Without a recognised part word, the
    // query must line up with at least two words of a description, otherwise
    // "the electric bike" finds a motor controller.
    var minHits = terms.length ? 1 : 2;

    PARTS.forEach(function (p) {
      var d = p.d.toLowerCase(), score = 0, hit = 0;
      words.forEach(function (w) {
        var stem = w.length > 5 ? w.slice(0, 5) : w;
        if (d.indexOf(stem) !== -1) { score += stem.length; hit++; }
      });
      if (hit) hits.push({ p: p, s: score, h: hit });
    });
    if (!hits.length) return [];

    var maxHit = Math.max.apply(null, hits.map(function (x) { return x.h; }));
    if (maxHit < minHits) return [];
    hits = hits.filter(function (x) { return x.h === maxHit; });
    hits.sort(function (a, b) { return b.s - a.s || a.p.d.length - b.p.d.length; });
    return hits.map(function (x) { return x.p; });
  }

  var SERVICE_WORDS = [
    { w:/in.?depth|troubleshoot|diagnos/, d:'In-Depth Troubleshooting' },
    { w:/batter[a-z]*\s*assess/,          d:'Battery Assessment' },
    { w:/accident/,                       d:'Accident Assessment' },
    { w:/simple\s*assess|basic\s*assess/, d:'Simple Assessment' }
  ];

  function serviceMatch(q) {
    for (var i = 0; i < SERVICE_WORDS.length; i++) {
      if (SERVICE_WORDS[i].w.test(q)) {
        for (var j = 0; j < SERVICES.length; j++) {
          if (SERVICES[j].d === SERVICE_WORDS[i].d) return SERVICES[j];
        }
      }
    }
    return null;
  }

  function partLine(p) {
    var s = '**' + p.d + '**\n' +
            '• Part number: ' + p.n + '\n' +
            '• Part: ' + ksh(p.p) + '\n';
    if (p.r > 0) s += '• Repair or fitting: ' + ksh(p.r) + '\n' +
                      '• Total: ' + ksh(p.t) + '\n';
    return s;
  }

  /* These are Roam's own approved catalogue prices, so they are quoted plainly.
     No draft-estimate hedging, no restating the catalogue period at a rider who
     only asked what a brake cable costs. Availability and fitment have their
     own guarded answers, which is where those questions belong. */
  var PRICE_CAVEAT = 'All prices include VAT.';

  /* How many of something the customer asked for. */
  var WORDNUM = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8,
                  nine:9, ten:10, a:1, an:1, moja:1, mbili:2, tatu:3, nne:4, tano:5 };

  function qtyIn(q) {
    var m = q.match(/\b(\d{1,2})\b/);
    if (m) { var n = parseInt(m[1], 10); if (n > 0 && n <= 50) return n; }
    var w = q.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|moja|mbili|tatu|nne|tano)\b/);
    return w ? WORDNUM[w[1]] : 1;
  }

  function cartTotals() {
    var parts = 0, labour = 0;
    cart.forEach(function (b) { parts += b.p * b.q; labour += b.r * b.q; });
    return { parts: parts, labour: labour, total: parts + labour };
  }

  /* Full plain-text cart contents, used for the WhatsApp handoff message and
     as a text fallback. The chat bubble itself stays short; the interactive
     Roam Cart card carries the line-by-line detail on screen. */
  function cartText(title) {
    if (!cart.length) {
      return 'Your Roam Cart is empty at the moment.\n' +
             'Tell me a part, for example "add a brake pedal", and I will start one for you.';
    }
    var s = (title || 'Here is your Roam Cart.') + '\n';
    cart.forEach(function (b) {
      s += '• ' + b.q + ' x ' + b.d + partNo(b) + ': ' + ksh(b.t * b.q) + '\n';
    });
    var t = cartTotals();
    s += 'Parts ' + ksh(t.parts) + ', fitting ' + ksh(t.labour) + ', total **' + ksh(t.total) + '**\n';
    return s + 'Say "give me a quote" when you are ready.';
  }

  function cartCount() {
    var n = 0;
    cart.forEach(function (b) { n += b.q; });
    return n;
  }

  function quoteView() {
    if (!cart.length) {
      return 'There is nothing in your Roam Cart yet.\n' +
             'Tell me which parts you need and I will put a draft estimate together.';
    }
    var t = cartTotals();
    var s = '**ROAM PARTS QUOTE REQUEST**\n';
    cart.forEach(function (b) {
      s += '• ' + b.q + ' x ' + b.d + partNo(b) + ' at ' + ksh(b.t) + ' each: ' + ksh(b.t * b.q) + '\n';
    });
    s += 'Parts subtotal: ' + ksh(t.parts) + '\n' +
         'Repair and fitting: ' + ksh(t.labour) + '\n' +
         'Estimated total: **' + ksh(t.total) + '**\n' +
         'VAT is included. Roam will confirm current price, availability, compatibility and fitting.';
    return s;
  }

  function addToCart(p, qty) {
    lastPart = p;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === p.id) { cart[i].q += qty; return cart[i]; }
    }
    cart.push({ id: p.id, n: p.n, d: p.d, p: p.p, r: p.r, t: p.t, q: qty });
    return cart[cart.length - 1];
  }

  function adjustCartQty(id, delta) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) {
        cart[i].q += delta;
        if (cart[i].q < 1) cart.splice(i, 1);
        return;
      }
    }
  }

  function removeFromCart(id) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) { cart.splice(i, 1); return; }
    }
  }

  function partById(id) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].id === id) return PARTS[i];
    return null;
  }

  function addToSavedList(p) {
    for (var i = 0; i < savedList.length; i++) if (savedList[i].id === p.id) return false;
    savedList.push(p);
    return true;
  }

  /* Splits "a brake cable, headlight and a tyre" into separate search terms,
     so a multi-part request can be resolved item by item instead of as one
     confused bag of words. */
  function splitPartSegments(q) {
    return q.split(/\s*,\s*|\s+(?:and|&|plus|as well as)\s+/)
            .map(function (s) { return s.trim(); })
            .filter(function (s) { return s.length > 2; });
  }

  /* Looks for more than one distinct part named in the same message. Returns
     null when this is not really a multi-part request, { clarify: text } when
     one of the segments is itself ambiguous, or { multi: [...], missing: [...] }
     with each segment resolved to exactly one catalogue row. */
  function multiPartRequest(q) {
    if (!/,| and | & |\bplus\b/.test(q)) return null;
    var segs = splitPartSegments(q);
    if (segs.length < 2) return null;
    var resolved = [], missing = [];
    for (var i = 0; i < segs.length; i++) {
      var f = findParts(segs[i]);
      if (f.length === 1) {
        resolved.push(f[0]);
      } else if (f.length > 1) {
        var t = 'For "' + segs[i] + '" I found a few options.\n';
        f.slice(0, 5).forEach(function (p) {
          t += '• **' + p.d + '** (' + p.n + '): part ' + ksh(p.p) +
               (p.r > 0 ? ', fitted ' + ksh(p.t) : '') + '\n';
        });
        return { clarify: t + 'Which one do you need? I will add the rest with it.' };
      } else {
        missing.push(segs[i]);
      }
    }
    if (resolved.length < 2) return null;   // not really a multi-part request
    return { multi: resolved, missing: missing };
  }

  /* Handles anything to do with parts, prices, the Roam Cart, My Parts List
     and quotes. Returns an answer object, or null so the normal pipeline
     continues. */
  function afterSalesAnswer(q) {
    var i, m, found, qty;

    // ---- Roam Cart management ----------------------------------------------
    if (/^(clear|empty|start over|reset)\b|clear (the )?(cart|list)|start over/.test(q)) {
      cart = [];
      return { text: 'Cleared. Tell me the parts you need and I will start a fresh Roam Cart.',
               unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
    }
    if (!/parts list|saved parts/.test(q) &&
        /(show|see|view|open|what.{0,12}(in )?my)\s*(me\s*)?(my\s*)?(cart|roam cart|selected|parts)\b|what have i (added|selected)|what parts did i add|my total|what.?s my total/.test(q)) {
      return { text: 'Here is your Roam Cart.', unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
    }
    if (/(give|get|make|prepare|send|i want a?).{0,15}quote|^quote\b|quotation/.test(q)) {
      if (!cart.length) {
        return { text: 'There is nothing in your Roam Cart yet. Tell me which parts you need and I will put a quote together.',
                 unresolved: false, forced: true, cat: 'parts' };
      }
      return { text: quoteView(), unresolved: false, forced: true, cat: 'parts', ui: 'quote' };
    }
    if (/how much (is|for|will) everything|total for everything|how much for everything|how much (is|for) my (cart|order)/.test(q)) {
      return { text: 'Here is your Roam Cart total.', unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
    }
    if (/^remove\b|remove (the|a|my)\b|take off|delete (the|a)\b/.test(q)) {
      if (!cart.length) {
        return { text: 'There is nothing in your Roam Cart to remove yet.', unresolved: false, forced: true, cat: 'parts' };
      }
      found = findParts(q).filter(function (fp) {
        for (var j = 0; j < cart.length; j++) if (cart[j].id === fp.id) return true;
        return false;
      });
      if (!found.length) {
        if (cart.length === 1) {
          var solo = cart[0].d;
          cart.splice(0, 1);
          return { text: 'Removed ' + solo + ' from your Roam Cart.', unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
        }
        return { text: 'Which one should I take off?', unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
      }
      for (i = 0; i < cart.length; i++) {
        if (cart[i].id === found[0].id) {
          var name = cart[i].d;
          cart.splice(i, 1);
          return { text: 'Removed ' + name + ' from your Roam Cart.', unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
        }
      }
      return { text: found[0].d + ' is not in your Roam Cart.', unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
    }
    // "make that three", "add two more" applies to the last item added
    m = q.match(/^(make (it|that)|change.{0,12}to|i need)\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(please)?\s*[.!]?$/);
    if (m && cart.length && !findParts(q).length) {
      cart[cart.length - 1].q = qtyIn(m[3]);
      return { text: 'Updated. ' + cart[cart.length - 1].d + ' is now ' + cart[cart.length - 1].q + '.',
               unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
    }
    if (/^add (another|one more)\b|one more\b/.test(q) && cart.length && !findParts(q).length) {
      cart[cart.length - 1].q += 1;
      return { text: 'Added one more ' + cart[cart.length - 1].d + '.', unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
    }
    // "make the brake pedals three" — set the quantity of a named cart line.
    m = q.match(/^(?:make|set|change)\s+(?:the\s+|my\s+)?([a-z0-9 ]{3,40}?)\s+(?:to\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(please)?\s*[.!]?$/);
    if (m && cart.length) {
      var seg = m[1].trim(), hit = null, stem = seg.replace(/s\b/, '');
      for (i = 0; i < cart.length; i++) {
        if (cart[i].d.toLowerCase().indexOf(stem) !== -1) { hit = cart[i]; break; }
      }
      if (!hit) {
        var fp2 = findParts(seg).filter(function (x) {
          for (var j = 0; j < cart.length; j++) if (cart[j].id === x.id) return true;
          return false;
        });
        if (fp2.length) {
          for (i = 0; i < cart.length; i++) if (cart[i].id === fp2[0].id) { hit = cart[i]; break; }
        }
      }
      if (hit) {
        hit.q = qtyIn(m[2]);
        return { text: 'Updated. ' + hit.d + ' is now ' + hit.q + '.', unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
      }
    }

    // ---- My Parts List (save for later, lighter than the Roam Cart) -------
    if (/(show|see|view|what.{0,10}(is|are)? ?(on|in))\s*(my\s*)?(my parts list|saved parts)\b|^my parts list\b/.test(q)) {
      if (!savedList.length) {
        return { text: 'Your My Parts List is empty. Say "save it" on any part to keep it here for later.',
                 unresolved: false, forced: true, cat: 'parts' };
      }
      var sl = '**My Parts List**\n';
      savedList.forEach(function (p) { sl += '• ' + p.d + ' (' + p.n + '): ' + ksh(p.p) + '\n'; });
      return { text: sl + 'Say "add it to my Roam Cart" for any of these when you are ready.',
               unresolved: false, forced: true, cat: 'parts' };
    }
    if (/add.{0,15}(to )?my parts list|save (it|this|that)( for later)?|add to (my )?wish ?list/.test(q)) {
      var sp = findParts(q)[0] || lastPart;
      if (!sp) {
        return { text: 'Tell me which part to save, for example "save the brake cable for later".',
                 unresolved: false, forced: true, cat: 'parts' };
      }
      var added = addToSavedList(sp);
      return { text: (added ? sp.d + ' saved to your My Parts List.' : sp.d + ' is already on your My Parts List.'),
               unresolved: false, forced: true, cat: 'parts' };
    }

    // ---- service prices ----------------------------------------------------
    var svc = serviceMatch(q);
    if (svc) {
      return { unresolved: false, forced: true, cat: 'parts', text:
        '**' + svc.d + '**: ' + (svc.t === 0 ? 'free of charge' : ksh(svc.t)) + '\n' +
        PRICE_CAVEAT };
    }
    if (/service (price|prices|charges|rates)|assessment (price|cost)|what.{0,15}(services|assessments) (do you|cost)/.test(q)) {
      var s = 'Roam after-sales service charges:\n';
      SERVICES.forEach(function (x) { s += '• ' + x.d + ': ' + (x.t === 0 ? 'free' : ksh(x.t)) + '\n'; });
      return { text: s + PRICE_CAVEAT, unresolved: false, forced: true, cat: 'parts' };
    }

    // A charger amperage we do not stock must be refused by name, not invented.
    m = q.match(/\b(\d{1,3})\s*(?:a|amp|amps|ampere)\b/);
    if (m && /charger/.test(q)) {
      var amp = m[1];
      if (amp !== '6' && amp !== '10') {
        return { unresolved: false, forced: true, cat: 'parts', text:
          "We don't do a " + amp + "A charger, I'm afraid. There are two in the Roam catalogue.\n" +
          '• Battery Charger, SuperPack 6 Amp (10000100.B1): ' + ksh(5800) + '\n' +
          '• Battery Charger, SuperPack 10 Amp (10000100.D1): ' + ksh(12180) + '\n' +
          'Which of those would suit you?' };
      }
    }

    // ---- compatibility: never confirm fitment from a price list -----------
    if (/\bcompat|fit(s)? (my|this|it)\b|will (it|this|that) fit|work(s)? (on|with) my\b|suit(s)? my\b/.test(q)) {
      var cp = findParts(q)[0] || lastPart;
      return { unresolved: false, forced: true, cat: 'parts', text:
        (cp ? 'I can confirm the ' + cp.d + ' and its price, but ' : 'I can confirm the part and its price, but ') +
        "I don't have verified compatibility information for your specific Roam Air version. " +
        "I'll connect you with Roam Service to confirm fitment on " + PHONE + '.' };
    }

    // ---- stock: the catalogue is a price list, not live inventory ---------
    if (/\bin stock\b|do you have (it|this|that|one|any)( in stock)?\b|is (it|this|that) available\b|stock (level|status)|available (now|today)\b/.test(q) &&
        (/\bpart\b|\bparts\b/.test(q) || lastPart || /\d{8}/.test(q))) {
      return { unresolved: false, forced: true, cat: 'parts', text:
        'The part is listed in the Roam parts catalogue. I can add it to your Roam Cart, but current availability needs to be confirmed by the Roam team on ' + PHONE + '.' };
    }

    // ---- a generic "Roam Parts" entry point, not a specific search --------
    if (/^(roam )?(spare )?parts\??$|^spares\??$|after.?sales parts|parts (catalogue|catalog|section|list)\b|what parts (do you have|are available)|show me (the )?parts\b/.test(q)) {
      return { unresolved: false, forced: true, cat: 'parts', ui: 'partsIntro', text:
        '🔧 **Roam Parts.** Search a part, a part number, or just describe what\'s broken.' };
    }

    // ---- vague braking complaint with no named component -------------------
    if (/doesn'?t stop|not stopping|hard to stop|failing to stop|poor braking|weak brak|brak(e|ing)[\s\S]{0,15}(not (stop|work)|fail|spongy|weak)/.test(q) &&
        findParts(q).length !== 1) {
      return { unresolved: false, forced: true, cat: 'parts', text:
        'That could involve a few different braking parts. Is the issue with the front brake, the rear brake, or both? Tell me and I will find the right part.' };
    }
    // ---- vague light complaint with no named component ---------------------
    if (/\blight\b/.test(q) && !/head\s?light|tail\s?light|indicator|blinker/.test(q) && BROKEN.test(q) && findParts(q).length !== 1) {
      return { unresolved: false, forced: true, cat: 'parts', text:
        'A few things could be causing that. Is it the headlight assembly, the headlight bracket or mount, the tail light, or a front indicator? Tell me which and I will get you the price.' };
    }

    // ---- is this a parts question at all? ---------------------------------
    var asking     = /^(do|does|did|is|are|was|can|could|should|would|will|what|how|why|where|which|who)\b/.test(q) || /\?\s*$/.test(q);
    var wantsAdd   = /^add\b|\badd (a|an|the|another|my|two|three|four|five|six|seven|eight|nine|ten|\d)|put .{0,20}(in|on) (my )?(cart|list)/.test(q) ||
                     (!asking && /\bi (need|want) (a|an|the|two|three|four|five|six|seven|eight|nine|ten|\d+) [a-z]{3}/.test(q)) ||
                     (!asking && /\bi (need|want)\b/.test(q) && /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})\s*\.?\s*$/.test(q));
    var wantsPrice = /how much|price|cost|bei|ngapi|what does .{0,20}cost/.test(q);
    var partsish   = /\bpart\b|\bparts\b|spare|part number|\d{8}\s*\.?\s*[a-z]\d/i.test(q);
    var broken     = BROKEN.test(q);
    /* Asking what charging COSTS is an energy question, not a request to buy
       a charger. Without this the word "charging" finds Battery Charger. */
    if (/charging cost|cost[\s\S]{0,15}(to )?charg|charg[\s\S]{0,15}cost|electricit|\bkwh\b|tariff|per kilometre|per km|spend[\s\S]{0,15}charg|charg[\s\S]{0,15}how much|how much[\s\S]{0,15}(to )?charg|(fill|filling|top up)[\s\S]{0,20}batter/.test(q) && !/\bcharger\b|chargers/.test(q)) return null;
    /* Rider-care wording is not a parts enquiry, even when it shares a word
       with a part name ("safety gear" is not the Safety Bar). */
    if (/safety gear|safe riding|ride safe|what.{0,15}(gear|equipment).{0,15}(need|wear)|helmet|protective|best practice|care tips?|look after|maintain my|tyre pressure|chain slack|wash/.test(q)) return null;
    if (!(wantsAdd || wantsPrice || partsish || broken)) return null;

    // ---- more than one part named in the same message ----------------------
    var mp = multiPartRequest(q);
    if (mp && mp.clarify) {
      return { text: mp.clarify, unresolved: false, forced: true, cat: 'parts' };
    }
    if (mp && mp.multi) {
      var introText = 'I found these parts for you. Would you like me to add them to your Roam Cart?';
      if (mp.missing.length) introText += '\nI could not find a match for: ' + mp.missing.join(', ') + '.';
      return { text: introText, unresolved: false, forced: true, cat: 'parts', ui: 'checklist', items: mp.multi };
    }

    found = findParts(q);
    if (!found.length) {
      if (partsish && /\d{8}/.test(q)) {
        return { unresolved: true, forced: true, cat: 'parts', text:
          "I don't see that part number in my current Roam parts catalogue.\n" +
          'Please check the number, or call Roam on ' + PHONE + ' and the team will find it for you.' };
      }
      // "add it", "niongezee moja" — a pronoun referring to the part just discussed
      if (wantsAdd && lastPart && /\b(it|that|this|one)\b/.test(q)) {
        qty = qtyIn(q);
        addToCart(lastPart, qty);
        return { text: '✅ ' + qty + ' x ' + lastPart.d + ' added to your Roam Cart.',
                 unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
      }
      return null;   // let the normal pipeline try, it may be a product question
    }

    // Several plausible parts. Ask rather than pick for them, unless they
    // gave a clear instruction to add, in which case take the closest match.
    if (found.length > 1 && !/\d{8}/.test(q) && !wantsAdd) {
      var list = 'I found a few parts that could be the one.\n';
      found.slice(0, 5).forEach(function (p) {
        list += '• **' + p.d + '** (' + p.n + '): part ' + ksh(p.p) +
                (p.r > 0 ? ', fitted ' + ksh(p.t) : '') + '\n';
      });
      return { text: list + 'Which one do you need? If you are not sure, send a photo to WhatsApp on ' + PHONE + '.',
               unresolved: false, forced: true, cat: 'parts' };
    }

    var part = found[0];
    lastPart = part;

    if (wantsAdd) {
      qty = qtyIn(q);
      addToCart(part, qty);
      return { text: ack() + qty + ' x ' + part.d + ' is in your Roam Cart.',
               unresolved: false, forced: true, cat: 'parts', ui: 'cart' };
    }

    /* Answer the question that was actually asked: the part on its own, the
       repair-inclusive figure, or the total. A rider who described a breakage
       gets a word of sympathy first, the way anyone on a service desk would
       open. The card underneath carries the full breakdown either way. */
    var askPartOnly  = /\bjust\b|\bonly\b/.test(q) && /\bpart\b/.test(q) && !/repair|fitt|total|altogether/.test(q);
    var askTotal     = /altogether|in total|all together|total cost|everything included|cost me.{0,15}altogether/.test(q);
    var askRepair    = !askTotal && /repair(ed)?|fix(ed)?|fitting|labour|fitted|install(ed)?/.test(q);
    var opener = broken ? 'Pole about that. ' : '';
    var priceLine;
    if (askPartOnly)                  priceLine = opener + 'The part on its own is ' + ksh(part.p) + '.';
    else if (askTotal)                priceLine = opener + 'Altogether, fitted, that comes to ' + ksh(part.t) + '.';
    else if (askRepair && part.r > 0) priceLine = opener + 'With repair and fitting that is ' + ksh(part.t) + '.';
    else if (part.r > 0)              priceLine = opener + 'Here is the one you want: ' + ksh(part.p) +
                                                  ' for the part, or ' + ksh(part.t) + ' fitted at Roam.';
    else                              priceLine = opener + 'Here is the one you want: ' + ksh(part.p) + '.';

    return { unresolved: false, forced: true, cat: 'parts', ui: 'part', part: part, text: priceLine };
  }

  /* Do the maths for them, using only the approved KES 1 per kilometre figure.
     Never invents an electricity tariff or a petrol price. */
  function calcAnswer(q) {
    if (!/(cost|spend|much|save|saving|pay|budget)/.test(q)) return null;
    var m = q.match(/(\d{1,4})\s*(?:km|kilometre|kilometer)/);
    if (!m) return null;
    var km = parseInt(m[1], 10);
    if (!km || km > 2000) return null;
    var month = km * 30;
    function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    return { unresolved: false, cat: 'charging_cost', text:
      'At ' + money(km) + ' km a day, here is roughly what charging costs you.\n' +
      '• About KES ' + money(km) + ' a day, at about KES 1 per kilometre at home\n' +
      '• About KES ' + money(month) + ' a month\n' +
      '• You would need ' + (km > 80 ? 'two batteries' : 'one battery') + ' for that distance\n' +
      'Tell me what you spend on petrol now and I will show you the difference.' };
  }

  /* Last chance before escalating. A question phrased differently from the FAQ
     is still the same question, so search FAQ titles across all categories.
     Deliberately strict: two or more distinctive words must line up, so this
     rescues real paraphrases without resurrecting loose keyword matching. */
  function paraphraseFaq(q) {
    var words = tokens(q), best = null, bestScore = 0;
    if (words.length < 2) return null;
    FAQ.forEach(function (f) {
      var hq = f.q.toLowerCase(), score = 0, hits = 0;
      words.forEach(function (w) {
        var s = w.length > 5 ? w.slice(0, 5) : w;
        if (hq.indexOf(s) !== -1) { score += s.length * 2; hits++; }
      });
      if (hits >= 2 && score > bestScore) { bestScore = score; best = f; }
    });
    return bestScore >= 16 ? best : null;
  }

  /* The last category answered, so a short follow-up stays on topic instead of
     being read as a brand new, unrelated question. */
  var lastCat = null;
  var FOLLOW_UP = /^(what|how) (if|about)|^and\b|^what about|^how about|^ok(ay)? (and|what)|^then\b|^so\b/;

  /* Returns { text, unresolved, forced, cat }.
     `unresolved` shows the one-tap routes to a human.
     `forced` means the guardrails answered and no model may override it. */
  function answerLocally(text) {
    var q = normalise(text), i, r;

    // Medium confidence: two readings are genuinely plausible. Ask once.
    if (AMBIGUOUS.test(q)) {
      lastCat = null;
      return { unresolved: false, forced: true, cat: 'clarify', text:
        'Happy to help, just so I point you to the right place.\n' +
        '• Are you looking for a shop to buy from or test ride?\n' +
        '• Or somewhere to charge?\n' +
        '• Or our office?\n' +
        'Tell me which and I will give you the details.' };
    }

    r = countryAnswer(q);  if (r) { lastCat = r.cat; return r; }
    /* The location database answers every hub, charging, rental, after-sales
       and shop location question before anything else gets a look in, so a
       question about where to go can never be answered with a product fact. */
    r = hubAnswer(q);      if (r) { lastCat = r.cat; return r; }
    r = locationAnswer(q); if (r) { lastCat = r.cat; return r; }
    r = calcAnswer(q);     if (r) { lastCat = r.cat; return r; }
    r = afterSalesAnswer(q); if (r) { lastCat = r.cat; return r; }

    for (i = 0; i < NOT_APPROVED.length; i++) {
      if (NOT_APPROVED[i].m.test(q)) {
        return { text: FALLBACK[NOT_APPROVED[i].f], unresolved: true, forced: true, cat: 'unknown' };
      }
    }

    // High confidence: the question classifies into one category.
    var cat = null;
    for (i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].m.test(q)) { cat = INTENTS[i].c; break; }
    }

    /* A follow-up continues the previous subject. "What if I want two
       batteries?" after a price question is still about price, not a fresh
       purchase enquiry. A follow-up that names its own specific subject
       ("what about financing?") still wins. */
    if (FOLLOW_UP.test(q) && lastCat && (!cat || cat === 'buy' || cat === 'general_roam')) {
      cat = lastCat;
    }

    // Same question, different words. Not an unknown question.
    if (!cat) {
      var p = paraphraseFaq(q);
      if (p) { lastCat = p.c; return { text: p.a, unresolved: false, cat: p.c }; }
    }

    // Low confidence: genuinely unsupported. Escalate.
    if (!cat) return { text: FALLBACK.general, unresolved: true, forced: true, cat: 'unknown' };

    lastCat = cat;
    if (cat === 'colour') return { text: FALLBACK.colour, unresolved: true, forced: true, cat: cat };
    if (cat === 'hours')  return { text: FALLBACK.hours,  unresolved: true, forced: true, cat: cat };
    if (cat === 'fault')  return { text: FALLBACK.fault,  unresolved: true, forced: true, cat: cat };

    var f = bestFaqIn(cat, q);
    if (f) return { text: f.a, unresolved: false, cat: cat };

    var t = topicFor(cat);
    if (t) return { text: t, unresolved: false, cat: cat };

    return { text: FALLBACK.general, unresolved: true, forced: true, cat: cat };
  }

  /* Money questions. These get the calculator button alongside the answer. */
  var MONEY_CATS = { charging_cost:1, savings:1, financing:1, pricing:1, buy:1, b2b:1, resale:1, calculator:1 };
  var CALC_LABEL = {
    charging_cost: 'Work out your charging cost',
    savings:       'Work out your savings',
    financing:     'Compare financing plans',
    pricing:       'Compare the total cost',
    buy:           'Compare financing plans',
    b2b:           'Open the fleet savings calculator',
    resale:        'Compare the total cost',
    calculator:    'Open the calculator'
  };

  /* Story cards are tied to the classified category, so an answer can never be
     illustrated with a card about an unrelated subject. */
  var CARDS = {
    solar:          ['solar expedition'],
    manufacturing:  ['roam park'],
    rider_stories:  ['border to border', 'nairobi addis'],
    durability:     ['truck test'],
    charging_where: ['charging'],
    charging_time:  ['fast charging battery'],
    battery_specs:  ['fast charging battery'],
    canopy:         ['roam explorer'],
    b2b:            ['roam explorer'],
    service:        ['service center'],
    locations:      ['service center'],
    sales_location: ['service center'],
    technology:     ['roam explorer']
  };

  function handle(text) {
    if (!text || !text.trim() || busy) return;
    text = text.trim();
    busy = true;
    $('rai-send').disabled = true;
    turns++;

    var c = $('rai-messages').querySelector('.rai-chips');
    if (c) c.parentElement.remove();
    var home = $('rai-messages').querySelector('.rai-home');
    if (home) home.parentElement.remove();

    row('<div class="rai-bubble">' + esc(text) + '</div>', 'user');
    $('rai-input').value = '';
    var l = text.toLowerCase();

    /* Classify first. The category decides what is shown alongside the answer,
       so a question can never be illustrated with an unrelated card. */
    var local = answerLocally(text);
    var cat   = local.cat;

    /* One thing at a time. A rider who asks a question gets the answer and at
       most one thing to act on. The full financier table is a wall of numbers,
       so it is held back until they actually ask to see every plan; until then
       the answer names the headline figure and the calculator does the rest. */
    var wantsAllPlans = /\ball (the )?(plan|option|financier|lender|rate)|every (plan|option|financier)|(compare|show|list|see)[\s\S]{0,20}(plan|option|financier|lender|table)|full (table|list|breakdown)|what are (my|the) options/.test(l);

    /* Everything that goes on screen after the answer itself. A real person
       says their piece first and then hands you the thing, so the cards and
       buttons follow the words rather than landing ahead of them. */
    function showPanels(reply) {
      var showedPanel = false;

      if (reply.ui === 'part' && reply.part) { row(partCard(reply.part), 'bot'); showedPanel = true; }
      else if (reply.ui === 'checklist' && reply.items) { row(checklistCard(reply.items), 'bot'); showedPanel = true; }
      else if (reply.ui === 'cart' || reply.ui === 'quote') { row(cartDrawer(), 'bot'); showedPanel = true; }
      else if (reply.ui === 'partsIntro') { row(partsBrowser(), 'bot'); showedPanel = true; }
      else if (reply.ui === 'hubs' && reply.hubs && reply.hubs.length) {
        row(hubCards(reply.hubs, reply.full), 'bot'); showedPanel = true;
      }
      else if (reply.ui === 'hubFinder') { row(hubFinder(), 'bot'); showedPanel = true; }
      if (reply.ui === 'quote' && cart.length) row(quoteForm(), 'bot');
      updateCartBadge();

      if (!reply.forced && !showedPanel) {
        if (wantsAllPlans && (cat === 'financing' || cat === 'pricing' || cat === 'buy')) {
          row(financingCard(), 'bot');
          showedPanel = true;
        } else {
          (CARDS[cat] || []).slice(0, 1).forEach(function (k) {
            row(mediaCard(k), 'bot');
          });
        }
        if (cat === 'test_ride') { row(bookRideAction(), 'bot'); showedPanel = true; }
      }

      /* Anything about money gets the calculator, including the guardrailed
         answers, because the calculator is where the real numbers live. The
         table already carries its own note, so the button is not repeated. */
      if (MONEY_CATS[cat] && !showedPanel) {
        row(calculatorAction(CALC_LABEL[cat] || 'Open the cost calculator'), 'bot');
      }
      if (/faq|frequently asked|common question|^questions?$|^help$/.test(l)) row(faqCard(), 'bot');
    }

    function finish(reply) {
      row('<div class="rai-bubble">' + formatResponse(reply.text) + '</div>', 'bot');
      showPanels(reply);
      if (reply.unresolved) {
        row(quickActions(text), 'bot');   // never leave the visitor at a dead end
      } else {
        maybeOfferLead(text);
      }
      busy = false;
      $('rai-send').disabled = false;
      if (!isTouch()) $('rai-input').focus();
    }

    /* Hold the typing dots for as long as the reply would take to write, then
       answer. An answer that lands the instant you press send reads as a
       lookup rather than as someone on the other end. */
    function typeThen(body, done) {
      var dots = row('<div class="rai-typing"><i></i><i></i><i></i></div>', 'bot');
      after(typingPause(body), function () { dots.remove(); done(); });
    }

    /* Guardrailed answers are final. No model is asked, so no model can turn
       an unknown location, country, price or spec into an invented answer.
       With no model configured at all, the local answer is likewise the whole
       answer, and there is nothing to wait for beyond the typing beat. */
    if (local.forced || !API_ENDPOINT) {
      history_.push({ role: 'user', content: text });
      history_.push({ role: 'assistant', content: local.text });
      typeThen(local.text, function () { finish(local); });
      return;
    }

    var typing = row('<div class="rai-typing"><i></i><i></i><i></i></div>', 'bot');

    askBackend(text).catch(function () {
      // offline path still records the reply, so the lead transcript is complete
      history_.push({ role: 'assistant', content: local.text });
      return local;
    }).then(function (reply) {
      typing.remove();
      finish(reply);
    });
  }

  /* ==========================================================================
     WIRING
     ========================================================================== */
  function isMobile() { return window.matchMedia('(max-width:600px)').matches; }
  function isTouch() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }

  /* On mobile the panel is a full-screen sheet, so the page behind it must not
     scroll. Position-fixed preserves and restores the scroll position, which
     `overflow:hidden` alone does not on iOS. */
  var savedScroll = 0;
  function lockPage() {
    if (!isMobile()) return;
    savedScroll = window.pageYOffset || document.documentElement.scrollTop || 0;
    var b = document.body;
    b.style.position = 'fixed';
    b.style.top = -savedScroll + 'px';
    b.style.left = '0';
    b.style.right = '0';
    b.style.width = '100%';
  }
  function unlockPage() {
    var b = document.body;
    if (b.style.position !== 'fixed') return;
    b.style.position = '';
    b.style.top = '';
    b.style.left = '';
    b.style.right = '';
    b.style.width = '';
    window.scrollTo(0, savedScroll);
  }

  /* When the on-screen keyboard opens, the visual viewport shrinks but the
     layout viewport does not, so the composer would sit behind the keyboard.
     Track visualViewport and resize the panel to match. */
  function trackKeyboard() {
    var vv = window.visualViewport;
    if (!vv) return;
    var apply = function () {
      var panel = $('rai-chat');
      if (!panel || !isMobile() || !panel.classList.contains('open')) {
        if (panel) panel.style.height = '';
        return;
      }
      panel.style.height = vv.height + 'px';
      scrollDown();
    };
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
  }

  function open() {
    $('rai-chat').classList.add('open');
    $('rai-launch').classList.add('hidden');
    lockPage();
    if (!$('rai-messages').children.length) {
      row('<div class="rai-bubble"><div class="rai-eyebrow">Roam Team</div>' +
        '<div class="rai-lede">' + esc(greetingLine()) + '</div>' +
        '<div class="rai-lede">Tell me what you need and I will sort it out, or start with one of these.</div></div>', 'bot');
      // Give the panel a beat before the actions land, so the opening screen
      // arrives the way a person sends a follow-up rather than all at once.
      after(420, function () {
        row(homeActions(), 'bot');
        after(260, function () { row(chips(), 'bot'); });
      });
    }
    // Autofocus on a phone pops the keyboard immediately and hides the
    // conversation, so only focus on pointer devices.
    if (!isTouch()) setTimeout(function () { $('rai-input').focus(); }, 260);
  }

  function close() {
    $('rai-chat').classList.remove('open');
    $('rai-launch').classList.remove('hidden');
    $('rai-chat').style.height = '';
    unlockPage();
  }

  function wire() {
    $('rai-launch').addEventListener('click', open);
    $('rai-close').addEventListener('click', close);
    $('rai-cart-btn').addEventListener('click', function () {
      if (busy) return;
      row('<div class="rai-bubble">' + formatResponse('Here is your Roam Cart.') + '</div>', 'bot');
      row(cartDrawer(), 'bot');
    });
    $('rai-send').addEventListener('click', function () { handle($('rai-input').value); });
    $('rai-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handle(e.target.value); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('rai-chat').classList.contains('open')) close();
    });

    $('rai-messages').addEventListener('click', function (e) {
      var q = e.target.closest('.rai-faq-q');
      if (q) {
        var item = q.parentElement, ans = item.querySelector('.rai-faq-a');
        var wasOpen = item.classList.contains('open');
        item.parentElement.querySelectorAll('.rai-faq-item.open').forEach(function (o) {
          o.classList.remove('open');
          o.querySelector('.rai-faq-a').style.maxHeight = null;
        });
        if (!wasOpen) { item.classList.add('open'); ans.style.maxHeight = ans.scrollHeight + 'px'; }
        return;
      }
      var chip = e.target.closest('.rai-chip');
      if (chip) { handle(chip.dataset.q); return; }

      var esc_ = e.target.closest('[data-escalate]');
      if (esc_) {
        var question = esc_.getAttribute('data-escalate');
        esc_.closest('.rai-actions').parentElement.remove();
        var existing = $('rai-lead');
        if (existing) existing.parentElement.remove();
        leadShown = true;
        row(leadForm('Tell us where to reach you and we will answer this properly.', question), 'bot');
        return;
      }

      if (e.target.closest('#rai-l-send')) { submitLead(); return; }
      if (e.target.closest('#rai-l-skip')) {
        var lead = $('rai-lead');
        if (lead) lead.parentElement.remove();
        return;
      }

      // ---- open the full catalogue from the home screen -------------------
      if (e.target.closest('[data-open-catalogue]')) {
        row('<div class="rai-bubble">' + formatResponse(
          'Here is the full Roam parts catalogue. Open a section, or search if you already know what you are after.') +
          '</div>', 'bot');
        after(320, function () { row(partsBrowser(), 'bot'); });
        return;
      }
      // ---- open the hub finder from the home screen -----------------------
      if (e.target.closest('[data-open-hubs]')) {
        setFinder({});
        row('<div class="rai-bubble">' + formatResponse(
          'Here are the Roam locations I have. Filter by what you need, search an area, ' +
          'or tap Nearest to me and I will rank them from where you are.') + '</div>', 'bot');
        after(320, function () { row(hubFinder(), 'bot'); });
        return;
      }
      // ---- hub finder: region tabs, service filters, show all -------------
      var hubTab = e.target.closest('[data-hub-region]');
      if (hubTab) {
        var rg = hubTab.getAttribute('data-hub-region');
        if (rg === 'near' && !finderState.origin) { locateRider(hubTab); return; }
        finderState.rg = rg; finderState.all = false;
        redrawFinder(hubTab); return;
      }
      var hubFilt = e.target.closest('[data-hub-filter]');
      if (hubFilt) {
        var fk = hubFilt.getAttribute('data-hub-filter');
        finderState.f[fk] = finderState.f[fk] ? 0 : 1;
        finderState.all = false;
        redrawFinder(hubFilt); return;
      }
      if (e.target.closest('[data-hub-more]')) {
        finderState.all = true;
        redrawFinder(e.target.closest('[data-hubfinder]')); return;
      }

      // ---- catalogue: open and close a shelf ------------------------------
      var catHead = e.target.closest('[data-cat-toggle]');
      if (catHead) { catHead.parentElement.classList.toggle('open'); scrollDown(); return; }

      // ---- Roam Cart: add / save / select / quantity / remove -------------
      var addP = e.target.closest('[data-add-part]');
      if (addP) {
        var partA = partById(addP.getAttribute('data-add-part'));
        if (partA) {
          addToCart(partA, 1);
          updateCartBadge();
          /* Adding from the catalogue is a browsing action: riders add three
             or four in a row, so it confirms on the button itself instead of
             pushing a new bubble and a cart drawer down the thread each time. */
          if (addP.closest('[data-catalogue]')) {
            addP.textContent = '✓';
            addP.classList.add('added');
            return;
          }
          addP.textContent = 'Added ✓';
          addP.disabled = true;
          row('<div class="rai-bubble">' + formatResponse(ack() + partA.d + ' is in your Roam Cart.') + '</div>', 'bot');
          after(280, function () { row(cartDrawer(), 'bot'); });
        }
        return;
      }
      var saveP = e.target.closest('[data-save-part]');
      if (saveP) {
        var partS = partById(saveP.getAttribute('data-save-part'));
        if (partS) {
          var wasNew = addToSavedList(partS);
          saveP.textContent = wasNew ? 'Saved ✓' : 'Already saved';
          row('<div class="rai-bubble">' + formatResponse(wasNew ?
            partS.d + ' saved to your My Parts List.' : partS.d + ' is already on your My Parts List.') + '</div>', 'bot');
        }
        return;
      }
      var addSel = e.target.closest('[data-add-selected]');
      if (addSel) {
        var panel = addSel.closest('[data-checklist]');
        var added = [];
        panel.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) {
          var partC = partById(cb.getAttribute('data-part'));
          if (partC) { addToCart(partC, 1); added.push(partC.d); }
        });
        panel.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
        addSel.textContent = 'Added to Roam Cart ✓';
        if (added.length) {
          row('<div class="rai-bubble">' + formatResponse('✅ Added to your Roam Cart: ' + added.join(', ') + '.') + '</div>', 'bot');
          row(cartDrawer(), 'bot');
          updateCartBadge();
        }
        return;
      }
      var qp = e.target.closest('[data-qty-plus]');
      if (qp) { adjustCartQty(qp.getAttribute('data-qty-plus'), 1); refreshCartDrawer(qp); return; }
      var qm = e.target.closest('[data-qty-minus]');
      if (qm) { adjustCartQty(qm.getAttribute('data-qty-minus'), -1); refreshCartDrawer(qm); return; }
      var rc = e.target.closest('[data-cart-remove]');
      if (rc) { removeFromCart(rc.getAttribute('data-cart-remove')); refreshCartDrawer(rc); return; }

      var rq = e.target.closest('[data-request-quote]');
      if (rq) {
        if (!cart.length) {
          row('<div class="rai-bubble">' + formatResponse('Your Roam Cart is empty. Add a part first and I will put a quote together.') + '</div>', 'bot');
          return;
        }
        row(quoteForm(), 'bot');
        return;
      }
      if (e.target.closest('#rai-pq-send')) { submitPartsQuote(); return; }
      if (e.target.closest('#rai-pq-skip')) {
        var pq = $('rai-pq');
        if (pq) pq.parentElement.remove();
        return;
      }
      var cs = e.target.closest('[data-continue-shopping]');
      if (cs) { row(partsBrowser(), 'bot'); return; }
    });

    /* Live filtering inside the catalogue. The panel is replaced in place and
       focus and caret are restored, so typing never jumps out of the box. */
    $('rai-messages').addEventListener('input', function (e) {
      var hbox = e.target.closest('#rai-hub-q');
      if (hbox) {
        var hAt = hbox.selectionStart;
        finderState.q = hbox.value;
        finderState.all = false;
        redrawFinder(hbox);
        var hAgain = $('rai-hub-q');
        if (hAgain) {
          hAgain.focus();
          try { hAgain.setSelectionRange(hAt, hAt); } catch (err) { /* not all inputs support this */ }
        }
        return;
      }
      var box = e.target.closest('#rai-cat-q');
      if (!box) return;
      var panel = box.closest('[data-catalogue]');
      if (!panel) return;
      var term = box.value, at = box.selectionStart;
      panel.outerHTML = partsBrowser(term);
      var again = $('rai-cat-q');
      if (again) {
        again.focus();
        try { again.setSelectionRange(at, at); } catch (err) { /* not all inputs support this */ }
      }
    });

    $('rai-messages').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      // Enter inside the catalogue search filters; it must not submit a form.
      if (e.target.closest('#rai-cat-q')) { e.preventDefault(); return; }
      if (e.target.closest('#rai-hub-q')) { e.preventDefault(); return; }
      if (e.target.closest('#rai-pq')) { e.preventDefault(); submitPartsQuote(); return; }
      if (e.target.closest('.rai-lead')) { e.preventDefault(); submitLead(); }
    });

    trackKeyboard();
    window.addEventListener('orientationchange', function () {
      setTimeout(function () {
        if (!isMobile()) { $('rai-chat').style.height = ''; unlockPage(); }
        scrollDown();
      }, 250);
    });

    flushQueued();
  }

  // Public hook, so Roam can open the assistant from any button on the site:
  //   <a href="#" onclick="RoamAssistant.open(); return false;">Chat to sales</a>
  window.RoamAssistant = { open: open, close: close };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
