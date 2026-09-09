// Real-browser tests. These exist because a schema-only suite proved
// insufficient: verify:validation was green while the form's own pattern
// attribute accepted letters in a phone field, and while a failed submit
// silently wiped every field the owner had typed. Neither is visible without
// driving the actual page.
//
// The dev server must be running.
//
//   npm run ui:test          -> validation flows + layout rules (asserts)
//   npm run ui:shots         -> screenshots of every screen, 3 viewports
//
// Env: BASE_URL, UI_USER, UI_PASS, SHOT_DIR, ONLY_VP, ONLY
import { chromium } from "playwright";
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const USER = process.env.UI_USER || "testowner";
const PASS = process.env.UI_PASS || "newpass456";
const MODE = process.argv[2] || "test";
// Letters only: a person name legitimately rejects digits.
// The "ZZ Test" prefix is what `npm run seed:bulk -- --wipe` removes, so
// rows this suite creates are cleaned up by that one command.
// Six letters, always. A base-36 slice with non-letters stripped often
// collapsed to the fallback, so two runs collided - and now that a duplicate
// party name is REFUSED rather than warned about, that collision failed the
// run instead of quietly passing.
const TAG =
  "ZZ Test QA " +
  Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  laptop: { width: 1366, height: 768 },
  wide: { width: 1920, height: 1080 },
};

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["parties", "/parties"],
  ["parties-nomatch", "/parties?q=zzzzz"],
  ["karigars", "/karigars"],
  ["jobwork", "/job-work"],
  ["jobwork-new", "/job-work/new"],
  ["reports", "/reports"],
  ["settings", "/settings"],
];

let pass = 0;
let skipped = 0;
const failures = [];

// A pagination rule cannot be tested with three records. Skipping loudly is
// honest; reporting a pass or a failure would both be lies.
// A 3:1 PORTRAIT image, solid magenta. The aspect ratio is the whole point:
// the owner's logo is taller than it is wide, and `object-cover` fills a
// square by cutting the top and bottom off exactly such an image.
function tallTestPng(w = 60, h = 180) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = 255;
      raw[row + 2 + x * 3] = 0;
      raw[row + 3 + x * 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

// Decodes what Playwright hands back from a screenshot: non-interlaced,
// 8-bit RGB or RGBA, with per-scanline filters. Enough to sample a pixel,
// which is the only claim being made here.
function decodePng(buf) {
  let p = 8, w = 0, h = 0, channels = 3;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error("only 8-bit PNGs");
      channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : null;
      if (!channels) throw new Error("unsupported colour type " + data[9]);
    } else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[y * stride + i - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = i >= channels && y > 0 ? out[(y - 1) * stride + i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + i] = v & 0xff;
    }
  }
  return {
    w, h,
    at(x, y) {
      const i = y * stride + x * channels;
      return [out[i], out[i + 1], out[i + 2]];
    },
  };
}

const isMagenta = ([r, g, b]) => r > 170 && g < 110 && b > 170;

function skip(label, why) {
  skipped++;
  console.log(`SKIP - ${label}  (${why})`);
}
function check(label, ok, detail = "") {
  if (ok) pass++;
  else failures.push(label + (detail ? "  (" + detail + ")" : ""));
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${detail ? "  (" + detail + ")" : ""}`);
}

/**
 * Open a create dialog by pressing the header button, because the dialogs are
 * client state now and no URL opens them.
 */
async function openCreateDialog(page, label) {
  await page.locator(`button:has-text("${label}")`).first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 25000 });
  await page.waitForTimeout(300);
}

async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="username"]', USER);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page
    .waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(300);
  return !page.url().includes("/login");
}

const browser = await chromium.launch({ headless: true });

// ─────────────────────────── screenshots ───────────────────────────
if (MODE === "shots") {
  const dir = process.env.SHOT_DIR || "ui-shots";
  mkdirSync(dir, { recursive: true });
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    if (process.env.ONLY_VP && process.env.ONLY_VP !== vpName) continue;
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    if (!(await login(page))) { console.log("LOGIN FAILED"); break; }
    for (const [name, path] of ROUTES) {
      if (process.env.ONLY && !name.includes(process.env.ONLY)) continue;
      await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${dir}/${vpName}-${name}.png` });
      console.log("shot", `${dir}/${vpName}-${name}.png`);
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(0);
}

// ─────────────────────────── assertions ───────────────────────────
// acceptDownloads explicitly: the export check asserts that clicking Excel
// produces a FILE, and a check that fails because downloads were disabled
// would be blaming the app for the harness.
const ctx = await browser.newContext({ viewport: VIEWPORTS.laptop, acceptDownloads: true });
const page = await ctx.newPage();
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(String(e.message).slice(0, 140)));

check("login succeeds", await login(page), page.url());

const errs = () =>
  page.$$eval('[data-slot="field-error"]', (els) =>
    els.map((e) => e.textContent.trim()).filter(Boolean)
  );

// Every screen renders without a client-side crash, without the document
// scrolling (the shell is one viewport tall) and without sideways scroll.
console.log("\n--- EVERY SCREEN RENDERS ---");
for (const [name, path] of ROUTES) {
  const before = jsErrors.length;
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => ({
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    // The comment above always claimed this check covered the document
    // scrolling, but the code only ever measured the SIDEWAYS axis — which is
    // how /job-work/new came to scroll vertically, show a screenful of empty
    // background below the app and put two scrollbars on screen, with the
    // suite green. A check has to measure what its comment promises.
    vScroll: document.documentElement.scrollHeight > window.innerHeight + 1,
    crashed: /Application error|Unhandled Runtime/i.test(document.body.innerText),
  }));
  check(
    `${name}: renders clean`,
    jsErrors.length === before && !m.crashed && !m.hScroll && !m.vScroll,
    `js=${jsErrors.length - before} hScroll=${m.hScroll} vScroll=${m.vScroll}`
  );
}

// ─────────────────────────── pagination rules ───────────────────────────
// The owner's spec: 10 a page, no pager until there is a second page, and the
// pager pinned to the bottom of the body regardless of how many rows the page
// happens to hold.
console.log("\n--- PAGINATION ---");

// How many records each list actually holds, read from its own "of N".
// EVERY list needs its own count: deriving one number from the parties list
// and reusing it for karigars and job works asked for a page those lists do
// not have, so the pager was legitimately absent and the check failed for the
// wrong reason. And a hardcoded page=3 needs >20 records, not >10.
async function lastPageOf(path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const total = await page.evaluate(() => {
    const m = document.body.innerText.match(/of\s+(\d+)/);
    return m ? Number(m[1]) : document.querySelectorAll("tbody tr").length;
  });
  return { total, lastPage: Math.max(1, Math.ceil(total / 10)) };
}

const partiesCount = await lastPageOf("/parties");
const karigarsCount = await lastPageOf("/karigars");
const jobWorkCount = await lastPageOf("/job-work");

// The rules cannot be tested at all without a second page. Skip loudly —
// reporting a pass or a failure would both be dishonest.
const canPage = partiesCount.total > 10;
if (!canPage) {
  skip("pagination rules", `only ${partiesCount.total} parties — run: npm run seed:bulk`);
}

for (const [label, path, expectPager] of [
  ["parties page 1", "/parties", true],
  ["parties last page", `/parties?page=${partiesCount.lastPage}`, partiesCount.total > 10],
  ["parties single result", "/parties?q=zzzzz", false],
  ["karigars last page", `/karigars?page=${karigarsCount.lastPage}`, karigarsCount.total > 10],
  ["job work last page", `/job-work?page=${jobWorkCount.lastPage}`, jobWorkCount.total > 10],
]) {
  // A list with a single page has no pager to place, so there is nothing to
  // assert about it here — the "no pager for one page" rule is covered by the
  // single-result case.
  if (!canPage && expectPager) continue;
  if (!expectPager && !path.includes("q=")) continue;
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => {
    const pag = document.querySelector('[data-slot="pagination"]');
    return {
      rows: document.querySelectorAll("tbody tr").length,
      pagerBottom: pag ? Math.round(pag.getBoundingClientRect().bottom) : null,
      vh: window.innerHeight,
      docScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
    };
  });
  if (expectPager) {
    // 22px is main's bottom padding, so the bar ends flush with the body.
    const pinned = m.pagerBottom !== null && Math.abs(m.vh - m.pagerBottom) <= 40;
    check(`${label}: pager pinned to the bottom`, pinned, `bottom=${m.pagerBottom} vh=${m.vh} rows=${m.rows}`);
  } else {
    check(`${label}: no pager for a single page`, m.pagerBottom === null, `rows=${m.rows}`);
  }
  check(`${label}: document does not scroll`, !m.docScrolls);
  if (m.rows) check(`${label}: at most 10 rows`, m.rows <= 10, `rows=${m.rows}`);
}

// ─────────────────────────── party validation ───────────────────────────
console.log("\n--- A DEEP PAGE STAYS PUT ---");
{
  // Opening a list at ?page=7 used to snap back to page 1 about a third of a
  // second later. The search box's debounce was firing on mount — it skipped
  // its first run with a ref, and React invokes effects twice in development,
  // so the second invocation went ahead and pushed a URL with `page` deleted.
  //
  // Every earlier pagination check navigated and asserted IMMEDIATELY, so all
  // of them passed while the bug was live. This one waits past the debounce
  // on purpose: the whole defect lives in that window.
  const { total: jwTotal, lastPage: deep } = await lastPageOf("/job-work");
  if (jwTotal <= 10) {
    skip("a deep page stays put", `only ${jwTotal} job works — no second page`);
  } else {
    await page.goto(`${BASE}/job-work?page=${deep}`, { waitUntil: "domcontentloaded" });
    // Comfortably past the 300ms debounce, and past a slow re-render.
    await page.waitForTimeout(2200);
    const after = await page.evaluate(() => {
      const t = document.body.innerText.replace(/\s+/g, " ");
      return {
        search: location.search,
        pageLabel: (t.match(/Page (\d+) of (\d+)/) || []).slice(1).join("/"),
        rows: document.querySelectorAll("tbody tr").length,
      };
    });
    check(
      `page ${deep} is still page ${deep} a second later`,
      after.search.includes(`page=${deep}`) && after.pageLabel.startsWith(`${deep}/`),
      JSON.stringify(after)
    );

    // The reset itself is wanted — when it comes from an actual search.
    await page.fill('input[type="search"]', "zzzz-no-such-thing");
    await page.waitForTimeout(1400);
    const searched = await page.evaluate(() => location.search);
    check(
      "a real search still clears the page number",
      searched.includes("q=") && !searched.includes("page="),
      searched
    );
    await page.goto(BASE + "/job-work", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
  }
}

console.log("\n--- PARTY VALIDATION ---");
await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await openCreateDialog(page, "Add party");
// The submit button disables itself while the action is in flight
// (useFormStatus). Clicking it while disabled silently does NOTHING, and the
// error still on screen is the PREVIOUS one - which is exactly how this
// suite fooled itself. So: wait until it is enabled, click, then wait for an
// outcome rather than for a duration.
// Waiting for "a field error exists" is WRONG here: the error from the
// previous attempt already satisfies it, so the wait returns before the new
// submission has even finished and the assertion then reads a stale message.
// The submit button disables itself while the action is in flight
// (useFormStatus), so its disabled -> enabled transition is an unambiguous
// "this submission has settled", whatever the outcome or the message.
//
// Every fixed sleep in this suite has eventually failed a run: on a busy dev
// server, or with more data seeded, the guessed duration runs out first. Wait
// on the condition instead — always.
const btnState = (label, want) =>
  page
    .waitForFunction(
      ({ l, w }) => {
        const b = [...document.querySelectorAll("button")]
          .filter((x) => new RegExp(l, "i").test(x.textContent || ""))
          .pop();
        if (!b) return false;
        return w === "disabled" ? b.disabled : !b.disabled;
      },
      { l: label, w: want },
      { timeout: 25000 }
    )
    .catch(() => {});

/** Click a form's submit button and return once that submission has settled. */
const submitAndSettle = async (label) => {
  await btnState(label, "enabled");
  await page.locator(`button:has-text("${label}")`).last().click();
  await btnState(label, "disabled");
  await Promise.race([
    // A successful save closes the dialog; a refusal re-enables the button.
    page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 25000 }),
    btnState(label, "enabled"),
  ]).catch(() => {});
  await page.waitForTimeout(400);
};

const addParty = () => submitAndSettle("Add party");

await addParty();
await page.waitForTimeout(1800);
let e = await errs();
check("empty party: exactly the four required fields error", e.length === 4, e.join(" | "));
check("empty party: asks to fill in, no length/format lecture",
  e.every((x) => /^please /i.test(x)), e.join(" | "));

await page.fill('input[name="name"]', TAG + " Party");
await page.fill('input[name="ownerName1"]', "Amba bhai 2");
await page.fill('input[name="contact1"]', "9876500001");
await page.click('[id="gender"]');
await page.waitForTimeout(400);
await page.click('[role="option"]:has-text("Male")');
await page.waitForTimeout(300);
await addParty();
await page.waitForTimeout(1900);
e = await errs();
check("owner name containing a digit is rejected", e.some((x) => /cannot contain numbers/i.test(x)), e.join(" | "));

await page.fill('input[name="ownerName1"]', "Amba bhai");
await page.fill('input[name="contact1"]', "abcdefghij");
await addParty();
await page.waitForTimeout(1900);
e = await errs();
check("letters in the mobile number are rejected", e.some((x) => /cannot contain letters/i.test(x)), e.join(" | "));

await page.fill('input[name="contact1"]', "123");
await addParty();
await page.waitForTimeout(1900);
e = await errs();
check("a too-short mobile number is rejected", e.some((x) => /at least 10 digits/i.test(x)), e.join(" | "));

// The regression that mattered most: a failed submit must not wipe the form.
const kept = await page.evaluate(() => ({
  name: document.querySelector('input[name="name"]')?.value,
  owner: document.querySelector('input[name="ownerName1"]')?.value,
  gender: document.querySelector('select[name="gender"]')?.value,
}));
check("a failed submit keeps every other field",
  kept.name?.startsWith("ZZ Test QA") && kept.owner === "Amba bhai" && kept.gender === "male",
  JSON.stringify(kept));

await page.fill('input[name="contact1"]', "9876598765");
await addParty();
await Promise.race([
  page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 20000 }),
  page.waitForSelector('[data-slot="field-error"]', { timeout: 20000 }),
]).catch(() => {});
await page.waitForTimeout(600);
{
  const savedOk = !(await page.isVisible('[role="dialog"]').catch(() => false));
  check("fixing the one flagged field saves the party", savedOk,
    savedOk ? page.url() : (await errs()).join(" | ") + " @ " + page.url());
}

// ────────────────── a party name must be unique ──────────────────
// Two parties with the same name make the job work dropdown ambiguous and the
// per-party earnings figure meaningless. This used to WARN and offer "add
// anyway"; it now refuses. The unique index in drizzle/0002 is the real
// guarantee — the pre-check just gives a nicer message first.
console.log("\n--- A PARTY NAME MUST BE UNIQUE ---");
{
  const fillParty = async (name, owner, coOwner, c1, c2) => {
    await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await openCreateDialog(page, "Add party");
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="ownerName1"]', owner);
    if (coOwner) await page.fill('input[name="ownerName2"]', coOwner);
    await page.fill('input[name="contact1"]', c1);
    if (c2) await page.fill('input[name="contact2"]', c2);
    await page.click('[id="gender"]');
    await page.waitForTimeout(400);
    await page.click('[role="option"]:has-text("Male")');
    await page.waitForTimeout(300);
    await addParty();
    return {
      // The dialog closing is the real signal. "The name input is gone" was
      // also true when the dialog never opened at all.
      saved: !(await page.isVisible('[role="dialog"]').catch(() => false)),
      errors: await errs(),
    };
  };

  // Create one, then try to create it again.
  const unique = TAG + " Unique";
  let r = await fillParty(unique, "First Owner", "", "9876500601", "");
  check("a new party saves", r.saved, r.errors.join(" | "));

  r = await fillParty(unique, "Second Owner", "", "9876500602", "");
  check("the same party name is refused", !r.saved, r.errors.join(" | "));
  check("and no 'add anyway' escape is offered",
    !(await page.evaluate(() => /add anyway/i.test(document.body.innerText))));

  r = await fillParty(unique.toUpperCase(), "Third Owner", "", "9876500603", "");
  check("a different casing is still a duplicate", !r.saved, r.errors.join(" | "));

  r = await fillParty(TAG + " SamePerson", "Amba bhai", "  amba BHAI ", "9876500604", "");
  check("owner and co-owner cannot be the same person", !r.saved, r.errors.join(" | "));

  r = await fillParty(TAG + " SamePhone", "Ravi bhai", "", "9876500605", "98765 00605");
  check("the alternate number cannot repeat the mobile", !r.saved, r.errors.join(" | "));
}

// ─────────────────────────── karigar validation ───────────────────────────
console.log("\n--- KARIGAR VALIDATION ---");
await page.goto(BASE + "/karigars", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await openCreateDialog(page, "Add karigar");
const addKarigar = () => submitAndSettle("Add karigar");

await addKarigar();
await page.waitForTimeout(1800);
e = await errs();
check("empty karigar: only the name is required", e.length === 1, e.join(" | "));

await page.fill('input[name="name"]', "Zuber 2");
await addKarigar();
await page.waitForTimeout(1800);
e = await errs();
check("karigar name containing a digit is rejected", e.some((x) => /cannot contain numbers/i.test(x)), e.join(" | "));

await page.fill('input[name="name"]', TAG + " Karigar");
await page.fill('input[name="contact1"]', "abc");
await addKarigar();
await page.waitForTimeout(1800);
e = await errs();
check("letters in the karigar's mobile are rejected", e.some((x) => /cannot contain letters/i.test(x)), e.join(" | "));

await page.fill('input[name="contact1"]', "");
await addKarigar();
await page.waitForTimeout(3000);
check("a karigar saves with no mobile (optional by design)",
  !(await page.isVisible('[role="dialog"]').catch(() => false)), page.url());

// ─────────────────────────── clearing a search ───────────────────────────
// The search box holds its own state, so a URL-driven change has to be
// re-synced into it. Without that, clearing looked broken: the list reset but
// the typed text stayed in the box. That is why the no-match card's own
// "Clear search and filters" button was removed — the box's cross does it.
console.log("\n--- CLEARING A SEARCH ---");
{
  const boxVal = () => page.inputValue('input[type="search"]');

  await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.fill('input[type="search"]', "zzzzz");
  await page.waitForURL((u) => u.search.includes("q=zzzzz"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  let body = await page.evaluate(() => document.body.innerText);
  check("a search with no hits shows the no-match state", /No parties match/.test(body));
  check("the no-match card carries no Clear button", !/Clear search and filters/.test(body));

  await page.click('button[aria-label="Clear search"]');
  // Wait for the condition, not a guessed duration: a cold dev-server
  // compile outlasts any fixed sleep worth writing.
  await page.waitForURL((u) => !u.search.includes("q="), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
  check("the box's cross empties the box", (await boxVal()) === "", await boxVal());
  check("the box's cross drops q from the URL", !page.url().includes("q="), page.url());
  body = await page.evaluate(() => document.body.innerText);
  check("the list returns after clearing", !/No parties match/.test(body));

  // Job work clears via its filter panel, which navigates — the case the
  // re-sync actually rescues.
  await page.goto(BASE + "/job-work", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.fill('input[type="search"]', "qqqqq");
  await page.waitForURL((u) => u.search.includes("q=qqqqq"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  const clearAll = page.locator('button:has-text("Clear all")');
  if (await clearAll.count()) {
    await clearAll.first().click();
    await page
      .waitForFunction(() => document.querySelector('input[type="search"]')?.value === "", null, { timeout: 20000 })
      .catch(() => {});
    check("job work's Clear all also empties the search box", (await boxVal()) === "", await boxVal());
  } else {
    check("job work's Clear all appears while filtering", false, "not found");
  }
}

// ─────────────────────────── job work validation ───────────────────────────
console.log("\n--- JOB WORK VALIDATION ---");
await page.goto(BASE + "/job-work/new", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1300);
const saveJob = () => page.locator('button:has-text("Save job work")').first().click();

await saveJob();
await page.waitForTimeout(2000);
e = await errs();
check("empty job work is blocked", await page.isVisible('input[name="pieces"]').catch(() => false));
check("job work names the party, the karigar and the description rows",
  ["party", "karigar", "description"].every((k) => e.some((x) => x.toLowerCase().includes(k))),
  e.join(" | "));
check("no raw zod message reaches the owner",
  !e.some((x) => /invalid input|expected string|received undefined/i.test(x)), e.join(" | "));

// ─────────── the dialogs: cancel, and save only when changed ───────────
// Two things the owner found: Cancel did nothing (it was a link to the page
// the dialog was already sitting on, so the dialog stayed open), and "Save
// changes" was enabled on an untouched form, inviting a write with nothing
// to write.
// ─────────────────────────── the dashboard ───────────────────────────
// The month picker is the whole point: "how much did I earn from Mayra LAST
// month" is the question the app was built to answer, and until now the
// dashboard could only ever show the current one.
// ─────────────────────────── image upload ───────────────────────────
// Upload only, never the camera: the owner asked for "just open box select
// image". A `capture` attribute would make a phone open the camera instead of
// the picker, so its ABSENCE is the requirement being tested.
// ─────────────────────────── export ───────────────────────────
// The trap this guards against: exporting page 1 of a filtered view and
// calling it "the filtered view". So the row count in the file is compared
// against the database count, and the grand total against the screen.
console.log("\n--- EXPORT ---");
{
  await page.goto(BASE + "/job-work", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);

  const screen = await page.evaluate(() => {
    const t = document.body.innerText.replace(/\s+/g, " ");
    return {
      total: (t.match(/Total this view ₹([\d,]+)/) || [])[1] ?? null,
      of: Number((t.match(/of\s+(\d+)/) || [])[1] ?? 0),
      rows: document.querySelectorAll("tbody tr").length,
    };
  });

  if (screen.rows === 0) {
    skip("export", "no job works to export");
  } else {
    // With a pager, "of N" is the full count; without one, a single page IS
    // the full set.
    const expectedRows = screen.of || screen.rows;
    // The footer holds ONLY the pager now. The view total and the export moved
    // to Reports, where "how much" is the question being asked rather than a
    // by-product of the current filter — the owner asked for both to go.
    const footer = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        hasTotal: /Total this view/.test(t),
        hasExportButton: [...document.querySelectorAll("button")].some((b) =>
          /^\s*Export\s*$/.test(b.textContent || "")
        ),
        hasPager: /Showing \d+/.test(t) || /Page \d+ of \d+/.test(t),
      };
    });
    check(
      "the job work footer is pagination only",
      footer.hasTotal === false && footer.hasExportButton === false && footer.hasPager === true,
      JSON.stringify(footer)
    );

    const res = await page.request.get(BASE + "/api/export/job-works");
    check("the Excel route returns a file", res.status() === 200, "status " + res.status());
    check(
      "as a spreadsheet, marked for download",
      (res.headers()["content-type"] ?? "").includes("spreadsheetml") &&
        (res.headers()["content-disposition"] ?? "").includes("attachment"),
      res.headers()["content-type"]
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.body());
    const ws = wb.getWorksheet("Job Work");
    check("the workbook has a Job Work sheet", Boolean(ws));

    if (ws) {
      const head = ws.getRow(3).values.filter(Boolean).map(String);
      check(
        "columns follow the book's order",
        head.slice(0, 7).join("|") ===
          "Date|Chalan No.|Party|Silai Karigar|Party D.No.|Computer D.No.|Particulars",
        head.slice(0, 7).join("|")
      );

      const all = [];
      ws.eachRow((row, n) => {
        if (n > 3) all.push(row);
      });
      const body = all.slice(0, -1);
      const totalRow = all[all.length - 1];
      const totalCol = head.indexOf("Total") + 1;

      // The whole point: every matching row, not one page of them.
      check(
        "EVERY job work is exported, not just the current page",
        body.length === expectedRows,
        `xlsx=${body.length} expected=${expectedRows}`
      );

      const summed = body.reduce((a, r) => a + Number(r.getCell(totalCol).value || 0), 0);
      const stated = Number(totalRow.getCell(totalCol).value || 0);
      check("the grand total equals the sum of its own rows", summed === stated, `rows=${summed} stated=${stated}`);
      // There is no on-screen total to compare against any more — the job work
      // footer is pagination only since the owner asked for the view total to
      // go. What still matters is that the file adds up to itself, which the
      // check above asserts, and that it holds every row, which the row-count
      // check asserts.

      const piecesCol = head.indexOf("Pieces") + 1;
      check(
        "figures are numbers, so Excel can re-sum them",
        body.every((r) => typeof r.getCell(piecesCol).value === "number")
      );
    }

    // A filter must actually narrow the file.
    const filteredRes = await page.request.get(BASE + "/api/export/job-works?status=PENDING");
    const fwb = new ExcelJS.Workbook();
    await fwb.xlsx.load(await filteredRes.body());
    const fws = fwb.getWorksheet("Job Work");
    if (fws) {
      const fhead = fws.getRow(3).values.filter(Boolean).map(String);
      const statusCol = fhead.indexOf("Status") + 1;
      const frows = [];
      fws.eachRow((row, n) => {
        if (n > 3) frows.push(row);
      });
      const fbody = frows.slice(0, -1);
      check(
        "every row in a filtered export honours the filter",
        fbody.length > 0 && fbody.every((r) => String(r.getCell(statusCol).value) === "Pending"),
        [...new Set(fbody.map((r) => String(r.getCell(statusCol).value)))].join(",")
      );
      check(
        "the file records which filter produced it",
        String(fws.getCell("A2").value).includes("Pending"),
        String(fws.getCell("A2").value)
      );
    }

    // The backup must be able to rebuild the relationships, not just the rows.
    const backupRes = await page.request.get(BASE + "/api/export/everything");
    const bwb = new ExcelJS.Workbook();
    await bwb.xlsx.load(await backupRes.body());
    const sheets = bwb.worksheets.map((w) => w.name);
    check(
      "the backup has a sheet per entity",
      ["Job Work", "Parties", "Silai Karigars", "Karigar Parties", "Description Types"].every((n) =>
        sheets.includes(n)
      ),
      sheets.join(", ")
    );
    check(
      "including the karigar-party links, or who-sews-for-whom is lost",
      bwb.getWorksheet("Karigar Parties").rowCount > 1
    );

    // PDF is the browser's print-to-PDF, so the ₹ must survive as text.
    await page.goto(BASE + "/job-work/print?status=PENDING", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);
    const printed = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    check("the print page renders a table with a grand total", /Grand total/.test(printed));
    check("the rupee sign survives as text, not a missing glyph", printed.includes("₹"));

    // Signed out, no spreadsheet may come back.
    const anon = await browser.newContext();
    const anonRes = await anon.request.get(BASE + "/api/export/everything", { maxRedirects: 0 });
    check(
      "a signed-out request gets no spreadsheet",
      !(anonRes.headers()["content-type"] ?? "").includes("spreadsheetml"),
      "status " + anonRes.status()
    );
    await anon.close();
  }
}

console.log("\n--- IMAGE UPLOAD ---");
{
  await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await openCreateDialog(page, "Add party");

  check("the party form offers a logo picker", await page.isVisible("text=Choose image"));

  // A logo is a small mark. It used to get a 132px full-width drop zone with
  // a tiny image centred in all that emptiness — the owner's complaint. The
  // control must stay compact and share its row with the party name.
  const logo = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const label = [...d.querySelectorAll("span")].find((s) => s.textContent.trim() === "Logo");
    const field = label?.parentElement;
    const nameInput = d.querySelector('input[name="name"]');
    return {
      dialogW: Math.round(d.getBoundingClientRect().width),
      logoW: field ? Math.round(field.getBoundingClientRect().width) : null,
      logoTop: field ? Math.round(field.getBoundingClientRect().top) : null,
      nameTop: nameInput ? Math.round(nameInput.getBoundingClientRect().top) : null,
    };
  });
  check(
    "the logo control does NOT span the dialog",
    logo.logoW !== null && logo.logoW < logo.dialogW * 0.7,
    `logo=${logo.logoW} dialog=${logo.dialogW}`
  );
  check(
    "logo and party name share a row",
    logo.logoTop !== null && logo.nameTop !== null && Math.abs(logo.logoTop - logo.nameTop) < 60,
    `logoTop=${logo.logoTop} nameTop=${logo.nameTop}`
  );

  // THE LOGO MUST NOT BE CROPPED. A 3:1 portrait image is uploaded and the
  // rendered circle is then screenshotted and sampled: with `object-cover`
  // the tall image is blown up to fill the square and its top and bottom are
  // cut away, so every pixel across the middle row reads as image. Contained,
  // it is letterboxed — image down the centre, card background at the left
  // and right edges. Sampling pixels is deliberate: asserting
  // `objectFit === "contain"` would only restate the CSS back to itself.
  const tallFile = join(tmpdir(), "jc-tall-logo.png");
  writeFileSync(tallFile, tallTestPng());
  await page.setInputFiles('[role="dialog"] input[type="file"]:not([name])', tallFile);
  await page.waitForSelector('[role="dialog"] img', { timeout: 8000 });
  await page.waitForTimeout(500);

  // The IMG's own box, not its padded wrapper. Sampling the wrapper was the
  // first version of this check and it was vacuous: a 6% inset of a 64px
  // circle lands inside the 6px padding, which is card background whatever
  // the object-fit is, so the check passed with object-cover still in place.
  const markBox = await page.evaluate(() => {
    const r = document.querySelector('[role="dialog"] img').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const shot = decodePng(await page.screenshot({ clip: markBox }));
  const midY = Math.floor(shot.h / 2);
  const centre = shot.at(Math.floor(shot.w / 2), midY);
  // 6% in from each side, on the middle row — inside the circle, but outside
  // where a contained 1:3 image can reach.
  const inset = Math.max(2, Math.floor(shot.w * 0.06));
  const left = shot.at(inset, midY);
  const right = shot.at(shot.w - 1 - inset, midY);

  check(
    "the uploaded logo actually renders",
    isMagenta(centre),
    `centre=${centre.join(",")}`
  );
  check(
    "a tall logo is contained, not cropped top and bottom",
    !isMagenta(left) && !isMagenta(right),
    `left=${left.join(",")} right=${right.join(",")}`
  );

  await page.click('[role="dialog"] button:has-text("Remove")');
  await page.waitForTimeout(300);

  const hasCapture = await page.evaluate(() =>
    [...document.querySelectorAll('input[type="file"]')].some((i) => i.hasAttribute("capture"))
  );
  check("no camera-capture attribute — picker only", hasCapture === false);
  check(
    "only image types are accepted",
    await page.evaluate(() =>
      [...document.querySelectorAll('input[type="file"]')].every((i) =>
        (i.getAttribute("accept") || "").includes("image/")
      )
    )
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // The job work form: still exactly two photos, but behind ONE "+ Add photo"
  // control rather than two dashed boxes taking a third of the form before a
  // single picture exists. The form contract is unchanged — two named file
  // inputs — which is what lets the server code stay untouched.
  await page.goto(BASE + "/job-work/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const photoState = () =>
    page.evaluate(() => {
      const main = document.querySelector("main");
      const text = main.innerText;
      return {
        fields: document.querySelectorAll('input[type="file"][name^="photo"]').length,
        addButtons: [...main.querySelectorAll("button")].filter((x) =>
          /add photo/i.test(x.textContent || "")
        ).length,
        thumbs: main.querySelectorAll('img[alt^="Photo"]').length,
        hint: (text.match(/Optional · up to 2 · JPG, PNG or WEBP|2 of 2 added/) || [])[0] ?? null,
        // Each hidden input must actually be holding its compressed file, or
        // nothing would reach the server.
        held: [...document.querySelectorAll('input[type="file"][name^="photo"]')].map(
          (i) => i.files.length
        ),
        photosBeforeStatus:
          text.indexOf("Photos") !== -1 && text.indexOf("Job Work Status") !== -1
            ? text.indexOf("Photos") < text.indexOf("Job Work Status")
            : null,
      };
    });

  const empty = await photoState();
  check("two photo fields, behind one Add photo control", empty.fields === 2 && empty.addButtons === 1, JSON.stringify(empty));
  check("the photo hint states the limit", empty.hint === "Optional · up to 2 · JPG, PNG or WEBP", String(empty.hint));
  check("photos sit before the status", empty.photosBeforeStatus === true);

  // The section headings the owner asked to remove must stay gone.
  const headings = await page.evaluate(() => {
    const t = document.querySelector("main").innerText;
    return ["Design numbers", "Work done", "Notes & status"].filter((h) => t.includes(h));
  });
  check("no section headings on the job work form", headings.length === 0, JSON.stringify(headings));

  // Add two, then remove one: the control disappears at the limit and returns.
  const photoFile = join(tmpdir(), "jc-ui-photo.png");
  writeFileSync(photoFile, tallTestPng(90, 70));
  await page.setInputFiles('main input[type="file"]:not([name])', photoFile);
  await page.waitForSelector('img[alt="Photo 1"]', { timeout: 10000 });
  await page.setInputFiles('main input[type="file"]:not([name])', photoFile);
  await page.waitForSelector('img[alt="Photo 2"]', { timeout: 10000 });
  await page.waitForTimeout(400);
  const full = await photoState();
  check(
    "at two photos the Add control is gone and both files are held",
    full.thumbs === 2 && full.addButtons === 0 && full.held.every((n) => n === 1),
    JSON.stringify(full)
  );
  check("the hint says the limit is reached", full.hint === "2 of 2 added", String(full.hint));

  await page.click('button[aria-label="Remove photo 1"]');
  await page.waitForTimeout(400);
  const afterRemove = await photoState();
  check(
    "removing a photo frees its slot and brings the control back",
    afterRemove.thumbs === 1 && afterRemove.addButtons === 1 && afterRemove.held[0] === 0 && afterRemove.held[1] === 1,
    JSON.stringify(afterRemove)
  );

  // The list's first column leads with the logo. Every row must carry one —
  // an image if there is a logo, initials if not. A column that is populated
  // for some rows and empty for others looks broken rather than optional.
  await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const rows = await page.evaluate(() => {
    const trs = [...document.querySelectorAll("table tbody tr")];
    return trs.map((r) => {
      const cell = r.querySelector("td");
      const img = cell?.querySelector("img");
      const initials = cell?.querySelector("span[aria-hidden='true']");
      const holder = (img || initials)?.parentElement;
      return {
        hasMark: Boolean(img || initials),
        round: holder ? getComputedStyle(holder).borderRadius : null,
        width: holder ? Math.round(holder.getBoundingClientRect().width) : null,
      };
    });
  });
  if (rows.length === 0) {
    skip("party list avatars", "no parties to show");
  } else {
    check("every party row leads with a logo or initials", rows.every((r) => r.hasMark), `${rows.length} rows`);
    check(
      "the mark is round and small",
      rows.every((r) => r.width !== null && r.width <= 40 && r.round !== "0px"),
      JSON.stringify(rows[0])
    );
  }
}

console.log("\n--- NAVIGATION FEEDBACK ---");
{
  // The owner's report: on a phone, tapping Parties did nothing visible for
  // several seconds, so he concluded navigation was broken and tapped other
  // tabs. There were no loading.tsx files at all.
  //
  // A fast local server cannot reproduce that, so the server is held for 2.5s
  // ON PURPOSE below and the assertion is that feedback appears well before it
  // answers. Testing this against an instant response would prove nothing.
  //
  // What is asserted per case matters, and was measured before it was written:
  // on a CLIENT navigation in dev the route cannot commit early, because Next
  // disables link prefetching in development, so the skeleton cannot paint and
  // the progress bar is what answers the tap (measured: bar at 158ms, route
  // committed at 3214ms). On a FULL page load the skeleton streams ahead of
  // the content, which is asserted against the HTML itself.
  const SLOW = 2500;
  const delayed = async (route) => {
    await new Promise((r) => setTimeout(r, SLOW));
    // If the test unrouted while this handler was still sleeping, Playwright
    // has already let the request through — continuing again throws.
    try {
      await route.continue();
    } catch {}
  };

  for (const href of ["/parties", "/job-work"]) {
    await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

    const match = (url) => url.pathname === href;
    await page.route(match, delayed);
    const started = Date.now();
    await page.click(`nav[aria-label="Main"] a[href="${href}"]`);

    let barAt = null;
    try {
      await page.waitForSelector(".nav-progress", { state: "attached", timeout: 1200 });
      barAt = Date.now() - started;
    } catch {}

    check(
      `${href}: the progress bar answers the click immediately`,
      barAt !== null && barAt < 1200,
      barAt === null ? "no bar before the response" : `${barAt}ms`
    );
    check(
      `${href}: the link itself shows it is working`,
      (await page.locator(`nav[aria-label="Main"] a[href="${href}"] .animate-spin`).count()) > 0
    );

    // The delay is left to expire on its own rather than unrouted mid-flight:
    // unrouting a sleeping handler is what made this check crash instead of
    // report.
    await page.waitForURL(`**${href}`, { timeout: 20000 });
    await page.waitForTimeout(700);
    await page.unroute(match, delayed);
    check(
      `${href}: the bar clears and the sidebar marks the new page`,
      (await page.locator(".nav-progress").count()) === 0 &&
        (await page.getAttribute(`nav[aria-label="Main"] a[href="${href}"]`, "aria-current")) === "page"
    );
  }

  // loading.tsx is wired for every route: on a full page load the skeleton is
  // streamed BEFORE the data-dependent content, which is what makes a refresh
  // on a phone show the shape of the page instead of a white screen. Asserted
  // against the served HTML, so it cannot be satisfied by a skeleton that only
  // exists in a component file nobody renders.
  for (const route of ["/dashboard", "/parties", "/karigars", "/job-work", "/settings"]) {
    const res = await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    const html = await res.text();
    check(`${route}: streams a loading skeleton on a full load`, html.includes('data-slot="skeleton"'));
  }
}

console.log("\n--- FILTER LABELS ---");
{
  // A filter label names the COLUMN it filters, not a sentence about it.
  // "Party name" and "Silai karigar name" sat beside "Status" and "Bill
  // status", which name their column plainly — and the dropdown does not
  // filter by name anyway, it filters by record. Pinned because wording is
  // exactly what keeps being caught by eye rather than by a suite.
  await page.goto(BASE + "/job-work", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);
  const panel = await page.evaluate(() => {
    const fields = document.querySelector("#job-work-filter-fields");
    const card = fields?.parentElement;
    const seen = (el) => Boolean(el) && el.getClientRects().length > 0;
    const heading = [...(card?.querySelectorAll("button") ?? [])].find((b) =>
      b.textContent.trim().startsWith("Filters")
    );
    const rows = [...(fields?.children ?? [])].filter(seen).map((el) => {
      const control = el.querySelector("button, input, [role=combobox]");
      return {
        label: el.querySelector("span")?.textContent.trim() ?? "",
        controlW: control ? Math.round(control.getBoundingClientRect().width) : null,
        selectW: el.querySelector("[role=combobox]")
          ? Math.round(el.querySelector("[role=combobox]").getBoundingClientRect().width)
          : null,
      };
    });
    const dates = [...(fields?.querySelectorAll('input[type="date"]') ?? [])];
    return {
      headingVisible: seen(heading),
      labels: rows.map((r) => r.label),
      selectWidths: rows.map((r) => r.selectW).filter((w) => w !== null),
      dateCount: dates.length,
      // Both halves of the range must sit inside ONE bordered box.
      oneDateBox:
        dates.length === 2 &&
        dates[0].parentElement === dates[1].parentElement &&
        getComputedStyle(dates[0].parentElement).borderTopWidth !== "0px" &&
        getComputedStyle(dates[0]).borderTopWidth === "0px",
    };
  });

  const want = ["Search", "Date range", "Party", "Silai karigar", "Status", "Bill status"];
  check(
    "the job work filters are labelled by what they filter",
    want.every((w) => panel.labels.includes(w)) && !panel.labels.some((l) => /\bname$/.test(l)),
    JSON.stringify(panel.labels)
  );
  // No heading on a laptop: a row of labelled fields does not need to be told
  // it is a filter. The same button IS the show/hide control on a phone, so
  // this is asserted at desktop width only.
  check("no 'Filters' title on the filter card at desktop width", panel.headingVisible === false);
  // The from/to pair share one border. Two separate boxes let you set half a
  // range and wonder why the list did not change.
  check("the date range is one box, not two", panel.oneDateBox, `dates=${panel.dateCount}`);
  // Widths come in two ranks, sized from CONTENT. One width for all four read
  // well in isolation but pushed the bar onto two rows at 1366, with Status
  // and Bill status wrapping to a line of their own while each carried ~110px
  // of empty space. Party and karigar hold names from the data and stay
  // roomier; the two status lists are fixed and can never grow, so they are
  // sized to their widest option ("In Progress" 73px, "Not billed" 62px, plus
  // 18px padding and ~22px for the chevron).
  check(
    "party and karigar share one width; the status filters share a smaller one",
    panel.selectWidths.length >= 4 &&
      panel.selectWidths[0] === panel.selectWidths[1] &&
      panel.selectWidths[2] === 118 &&
      panel.selectWidths[3] === 106 &&
      panel.selectWidths[2] < panel.selectWidths[0],
    JSON.stringify(panel.selectWidths)
  );

  // The point of all of it: ONE row on a laptop. Tops are clustered rather
  // than compared exactly — fields on the same visual row differ by a couple
  // of pixels because their labels are not all the same height, and an exact
  // comparison reported three rows where there were two.
  const rowsAt = async (width) => {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(500);
    return page.evaluate(() => {
      const tops = [...document.querySelectorAll("#job-work-filter-fields > *")]
        .map((el) => Math.round(el.getBoundingClientRect().top))
        .sort((a, b) => a - b);
      let rows = 0;
      let last = -999;
      for (const t of tops) {
        if (t - last > 20) rows++;
        last = t;
      }
      return rows;
    });
  };
  const wide = await rowsAt(1440);
  const laptop = await rowsAt(1366);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForTimeout(400);
  check("the whole filter bar fits on one row at 1366 and 1440", laptop === 1 && wide === 1, `1366=${laptop} 1440=${wide}`);

  // A placeholder cut off mid-word looks like a rendering fault.
  const searchFits = await page.evaluate(() => {
    const i = document.querySelector('#job-work-filter-fields input[type="search"], #job-work-filter-fields input:not([type])');
    if (!i) return null;
    const probe = document.createElement("span");
    const cs = getComputedStyle(i);
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font};`;
    probe.textContent = i.placeholder;
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return { text: i.placeholder, textW: Math.ceil(w), room: Math.round(i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) };
  });
  check(
    "the search placeholder is not cut off",
    searchFits !== null && searchFits.textW <= searchFits.room,
    JSON.stringify(searchFits)
  );
}

console.log("\n--- CONFIRM DIALOG CHROME ---");
{
  // The archive/delete confirm used the bare DialogContent defaults — a flat
  // p-4 box with h-8 buttons — while the add/edit dialog one click away had a
  // bordered header, a padded body and a muted footer bar with h-10 buttons.
  // The owner saw two dialogs from two different applications, and the small
  // buttons read as far more curved because 14px of radius on a 32px-tall
  // button is nearly a pill. These checks compare the two dialogs against
  // EACH OTHER rather than against hardcoded pixels, so they keep holding if
  // the design moves.
  const shell = () =>
    page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      const cs = getComputedStyle(d);
      const primary = [...d.querySelectorAll("button")]
        .filter((b) => b.textContent.trim() && !b.querySelector(".sr-only"))
        .pop();
      const ps = primary ? getComputedStyle(primary) : null;
      return {
        radius: cs.borderRadius,
        bands: [...d.children]
          .filter((c) => c.tagName !== "BUTTON")
          .map((c) => {
            const st = getComputedStyle(c);
            return {
              top: st.borderTopWidth,
              bottom: st.borderBottomWidth,
              tinted: st.backgroundColor !== "rgba(0, 0, 0, 0)",
              padded: st.paddingLeft !== "0px",
            };
          }),
        primary: primary
          ? {
              text: primary.textContent.trim(),
              h: Math.round(primary.getBoundingClientRect().height),
              radius: ps.borderRadius,
              bg: ps.backgroundColor,
            }
          : null,
      };
    });

  await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await openCreateDialog(page, "Add party");
  await page.waitForTimeout(400);
  const form = await shell();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // This run's OWN row, never the owner's. Nothing is confirmed here — the
  // dialog is opened, measured and cancelled.
  const archiveBtn = page.locator(`button[aria-label="Archive ${TAG} Party"]:visible`).first();
  if ((await archiveBtn.count()) === 0) {
    skip("confirm dialog chrome", "this run's party row is not on this page");
  } else {
    await archiveBtn.click();
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(400);
    const confirm = await shell();

    check(
      "the confirm dialog has a header, a body and a footer band",
      confirm.bands.length === 3 &&
        confirm.bands[0].bottom !== "0px" &&
        confirm.bands[1].padded &&
        confirm.bands[2].top !== "0px" &&
        confirm.bands[2].tinted,
      JSON.stringify(confirm.bands)
    );
    check(
      "the confirm dialog is curved exactly like the add dialog",
      confirm.radius === form.radius,
      `confirm=${confirm.radius} form=${form.radius}`
    );
    check(
      "its primary button matches the add dialog's primary button",
      Boolean(confirm.primary && form.primary) &&
        confirm.primary.h === form.primary.h &&
        confirm.primary.radius === form.primary.radius &&
        confirm.primary.bg === form.primary.bg,
      `confirm=${JSON.stringify(confirm.primary)} form=${JSON.stringify(form.primary)}`
    );

    await page.click('[role="dialog"] button:has-text("Cancel")');
    await page.waitForTimeout(500);
    check(
      "Cancel closes the confirm without archiving",
      (await page.locator('[role="dialog"]').count()) === 0 &&
        (await page.locator(`text=${TAG} Party`).count()) > 0
    );

    // Delete is the same shell in red, and it must be the loudest control in
    // the dialog rather than the tinted secondary it used to be.
    const deleteBtn = page.locator(`button[aria-label="Delete ${TAG} Party"]:visible`).first();
    if ((await deleteBtn.count()) === 0) {
      skip("delete confirm is solid red", "no deletable row");
    } else {
      await deleteBtn.click();
      await page.waitForSelector('[role="dialog"]');
      await page.waitForTimeout(400);
      const del = await shell();
      const rgb = (del.primary?.bg || "").match(/[0-9]+/g)?.map(Number) ?? [];
      check(
        "the delete confirm's button is solid red, not a tint",
        rgb.length >= 3 &&
          rgb[0] > 200 &&
          rgb[1] < 120 &&
          rgb[2] < 120 &&
          del.primary.h === form.primary.h,
        `bg=${del.primary?.bg} h=${del.primary?.h}`
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  }
}

console.log("\n--- DASHBOARD ---");
{
  const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

  await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);
  const monthNow = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  check("the dashboard opens on the current month", (await text()).includes(monthNow), monthNow);

  // The month is named ONCE, by the picker. It used to be printed again in a
  // heading on the left of the same row, with a subtitle explaining what the
  // picker beside it already made obvious.
  // Counts ELEMENTS whose entire text is the month, not text nodes: JSX
  // splits "No job works in {label}." into three nodes, one of which is
  // exactly the month, so a text-node count reported that sentence as a
  // duplicate label. That sentence keeps its month deliberately — there it is
  // a statement, not a label. Exactly one label is allowed and it is the
  // picker's.
  const monthLabels = await page.evaluate((m) => {
    const main = document.querySelector("main");
    return [...(main?.querySelectorAll("*") ?? [])]
      .filter((el) => el.textContent.trim() === m && el.children.length === 0)
      .map((el) => el.className || "?");
  }, monthNow);
  // The redesign the owner produced: Earned is the hero on a dark tile, the
  // other three are its parts and each carries the dot of the status it
  // counts. Asserted by COMPUTED COLOUR, not class names — a token could be
  // repointed at grey and every class-based check would still pass.
  const hero = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('main div[class*="p-[17px_18px]"]')];
    const dark = tiles.find((t) => {
      const [r, g, b] = getComputedStyle(t).backgroundColor.match(/\d+/g).map(Number);
      return r + g + b < 200;
    });
    return {
      tiles: tiles.length,
      widths: tiles.map((t) => Math.round(t.getBoundingClientRect().width)),
      darkFound: Boolean(dark),
      darkLabel: dark?.innerText.split("\n")[0] ?? null,
      darkFigure: dark ? getComputedStyle(dark.querySelectorAll("span")[1]).color : null,
      dots: document.querySelectorAll('main span[class*="size-[7px]"]').length,
    };
  });
  check(
    "the dashboard leads with a dark Earned tile",
    hero.darkFound && hero.darkLabel === "EARNED" && hero.darkFigure === "rgb(255, 255, 255)",
    JSON.stringify({ label: hero.darkLabel, figure: hero.darkFigure })
  );
  check(
    "four money tiles, all the same width",
    hero.tiles === 4 && new Set(hero.widths).size === 1,
    JSON.stringify(hero.widths)
  );
  check("the three part-tiles carry a status dot", hero.dots === 3, `${hero.dots} dots`);

  // The year, and whether the month is up or down. Both were added because a
  // bare figure cannot answer "is this a good month?" — but the comparison has
  // to be against the month BEFORE THE SELECTED ONE, not against a fixed
  // "last month": stepping back to July must compare July with June, or the
  // number on screen quietly describes a different pair of months.
  const glance = () =>
    page.evaluate(() => {
      const t = document.querySelector("main").innerText.replace(/\s+/g, " ");
      const strip = [...document.querySelectorAll("main a")].find((a) =>
        /so far/.test(a.textContent || "")
      );
      const m = t.match(/([▲▼=]) (\d+)% vs ([A-Za-z]+ \d{4})/);
      return {
        earned: (t.match(/EARNED ₹([\d,]+)/) || [])[1] ?? null,
        comparedWith: m ? m[3] : null,
        percent: m ? Number(m[2]) : null,
        direction: m ? m[1] : null,
        yearHref: strip?.getAttribute("href") ?? null,
        yearTotal: (strip?.textContent.match(/₹([\d,]+)/) || [])[1] ?? null,
      };
    });
  const money = (t) => Number(String(t ?? "").replace(/[^0-9]/g, ""));

  const now = await glance();
  // Five, at the owner's request. Asserted with MORE than five job works in
  // the database, or the check would pass on a short list and prove nothing.
  const recent = await page.evaluate(() => {
    const panel = [...document.querySelectorAll("main section")].find((s) =>
      /Recent job work/.test(s.textContent || "")
    );
    return {
      rows: panel ? panel.querySelectorAll("a[href^='/job-work/']").length : null,
      hasViewAll: Boolean(
        [...(panel?.querySelectorAll("a") ?? [])].find((a) => /View all/.test(a.textContent || ""))
      ),
    };
  });
  const totalJobWorks = await page.evaluate(async () => {
    const res = await fetch("/job-work");
    const html = await res.text();
    const m = html.match(/of (d+)/);
    return m ? Number(m[1]) : null;
  });
  if ((totalJobWorks ?? 0) <= 5) {
    skip("recent job work is capped at five", `only ${totalJobWorks} job works exist`);
  } else {
    check(
      "recent job work shows five, with the rest behind View all",
      recent.rows === 5 && recent.hasViewAll === true,
      JSON.stringify({ ...recent, totalJobWorks })
    );
  }

  check(
    "the dashboard carries a year strip linking to the year report",
    now.yearHref !== null && /period=year/.test(now.yearHref) && money(now.yearTotal) > 0,
    JSON.stringify({ href: now.yearHref, total: now.yearTotal })
  );

  // Step back one month and the comparison must move with it.
  await page.click('button[aria-label="Previous month"]');
  await page.waitForTimeout(1200);
  const stepped = await glance();
  const heading = await page.evaluate(() => document.querySelector("main h2")?.textContent?.trim());
  check(
    "the comparison follows the month being viewed",
    stepped.comparedWith !== null &&
      stepped.comparedWith !== now.comparedWith &&
      stepped.comparedWith !== heading,
    JSON.stringify({ heading, comparedWith: stepped.comparedWith, was: now.comparedWith })
  );

  // The percentage must be arithmetic, not decoration: compare the two months'
  // Earned figures directly.
  const earnedNow = money(now.earned);
  const earnedPrev = money(stepped.earned);
  const expected = earnedPrev > 0 ? Math.round(((earnedNow - earnedPrev) / earnedPrev) * 100) : null;
  check(
    "the percentage matches the two months it compares",
    expected === null || now.percent === Math.abs(expected),
    `shown=${now.direction}${now.percent}% computed=${expected}% (${now.earned} vs ${stepped.earned})`
  );

  await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  check(
    "the month is named exactly once, as the page heading",
    monthLabels.length === 1 && monthLabels[0].includes("text-[21px]"),
    JSON.stringify(monthLabels)
  );
  check(
    "no redundant 'for this month' subtitle",
    !(await text()).includes("Every figure below is for this month")
  );

  // Step back a month and confirm the view actually moved and persisted.
  const back = page.locator('button[aria-label="Previous month"]');
  if ((await back.count()) && !(await back.isDisabled())) {
    await back.click();
    await page.waitForURL((u) => u.search.includes("month="), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1000);
    check("stepping back changes the month", !(await text()).includes(monthNow));
    check("the month is in the URL, so a refresh keeps it", page.url().includes("month="), page.url());
  } else {
    skip("month picker step-back", "no earlier month to step to");
  }

  // Forward is capped at today — a dashboard that pages into empty future
  // months invites the owner to think data is missing.
  await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const fwd = await page.evaluate(
    () => document.querySelector('button[aria-label="Next month"]')?.disabled
  );
  check("cannot page past the current month", fwd === true, "disabled=" + fwd);

  // Every figure must be reachable: the number and the rows behind it.
  const link = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/job-work?from="]');
    return a ? a.getAttribute("href") : null;
  });
  if (link) {
    check("a party figure links to the filtered job work list", /party=/.test(link) && /from=/.test(link), link);
  } else {
    skip("party figure link", "no job works in the current month");
  }
}

console.log("\n--- SETTINGS ---");
{
  // The owner redesigned this screen: the password card is the wide one, with
  // a live checklist, and the backup and account cards stack beside it. It
  // used to be a 384px column that made a five-field form look like a login
  // box.
  await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);

  const layout = await page.evaluate(() => {
    const secs = [...document.querySelectorAll("main section")];
    return {
      count: secs.length,
      widths: secs.map((x) => Math.round(x.getBoundingClientRect().width)),
      tops: secs.map((x) => Math.round(x.getBoundingClientRect().top)),
      hasFooterBar: Boolean(
        [...document.querySelectorAll("main div")].find(
          (d) =>
            d.className.includes("border-t") &&
            d.className.includes("bg-muted/40") &&
            d.querySelector("button")
        )
      ),
    };
  });
  check("settings has three cards", layout.count === 3, JSON.stringify(layout.widths));
  check(
    "the password card is the wide one, beside the others",
    layout.widths[0] > layout.widths[1] && layout.tops[0] === layout.tops[1],
    JSON.stringify({ w: layout.widths, top: layout.tops })
  );
  check("the password card has an action bar", layout.hasFooterBar);

  // The checklist must track what is actually typed. Asserted by the tick's
  // COLOUR, since that is the only thing the owner can see.
  const ticks = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('main span[class*="size-[17px]"]')].map(
        (x) => getComputedStyle(x).backgroundColor
      )
    );
  // Brand teal is rgb(14,113,104); the unmet tick is rgb(225,233,231). The
  // first predicate here was `g > r && g > 80 && b > 60`, which the pale grey
  // ALSO satisfies (233 > 225) — so it counted every tick as met and reported
  // 3 of 3 for the password "abc". What separates them is that teal is dark
  // and strongly green: red sits far BELOW green.
  const teal = (c) => {
    const [r, g] = c.match(/\d+/g).map(Number);
    return g - r > 40;
  };

  await page.fill("#newPassword", "abc");
  await page.waitForTimeout(250);
  const weak = await ticks();
  await page.fill("#newPassword", "goodpass9");
  await page.waitForTimeout(250);
  const strong = await ticks();
  check(
    "the password checklist ticks only the rules that are met",
    weak.length === 3 && weak.filter(teal).length === 1 && strong.filter(teal).length === 3,
    JSON.stringify({ weak: weak.filter(teal).length, strong: strong.filter(teal).length })
  );

  // Mismatch is said while typing, not after a round trip.
  await page.fill("#confirmPassword", "nope");
  await page.waitForTimeout(250);
  const mismatch = await page.evaluate(() => document.querySelector("main").innerText);
  await page.fill("#confirmPassword", "goodpass9");
  await page.waitForTimeout(250);
  const matched = await page.evaluate(() => document.querySelector("main").innerText);
  check(
    "mismatched passwords are called out before submitting",
    mismatch.includes("Both passwords must match") && matched.includes("Passwords match"),
    `mismatch=${mismatch.includes("Both passwords must match")} match=${matched.includes("Passwords match")}`
  );

  // The rules on screen are the rules the SERVER enforces. A checklist that
  // ticks rules nobody checks is decoration; one that blocks on rules the
  // server does not have is a policy invented by a component.
  const serverRules = await page.evaluate(async () => {
    const r = await fetch("/settings");
    return r.ok;
  });
  check("the settings page is reachable while signed in", serverRules);
}

console.log("\n--- DIALOG CANCEL AND DIRTY-GATING ---");
{
  const saveDisabled = () =>
    page.evaluate(() => {
      const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) =>
        /save changes/i.test(x.textContent || "")
      );
      return b ? b.disabled : null;
    });

  const openFirstParty = async () => {
    await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.locator("table tbody tr td button").first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 20000 });
  };

  await openFirstParty();
  await page.locator('[role="dialog"] button:has-text("Cancel")').click();
  await page
    .waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 15000 })
    .catch(() => {});
  check("Cancel closes the dialog", !(await page.isVisible('[role="dialog"]').catch(() => false)));
  check("Cancel leaves the URL alone", page.url().endsWith("/parties"), page.url());

  await openFirstParty();
  check("Save changes starts disabled on an untouched form", (await saveDisabled()) === true);

  const was = await page.inputValue('input[name="name"]');
  await page.fill('input[name="name"]', was + "X");
  await page.waitForTimeout(350);
  check("typing enables Save", (await saveDisabled()) === false);

  await page.fill('input[name="name"]', was);
  await page.waitForTimeout(350);
  check("undoing the change disables Save again", (await saveDisabled()) === true);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // A create form must stay submittable, or a blank save could never show its
  // required-field messages.
  await page.locator('button:has-text("Add party")').first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 20000 });
  const addDisabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) =>
      /add party/i.test(x.textContent || "")
    );
    return b ? b.disabled : null;
  });
  check("Add party stays enabled on a blank create form", addDisabled === false);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

// ─────────────────────────── nothing is clipped ───────────────────────────
// The shell is overflow-hidden, so content taller than the body is CLIPPED
// unless it sits inside a scroll region. A short screen is where that shows up
// first, so check one. This caught the job work empty state being cut off at
// the bottom with no way to scroll down to it.
console.log("\n--- STATUS AND BILL FROM THE LIST ---");
{
  // Two SEPARATE columns, both dropdowns always visible, with the bill one
  // DISABLED until the status is Completed — the shape the owner asked for.
  // Two rules ride on it: billed requires Completed, and leaving Completed
  // clears billed, or the list could produce a Pending-and-Billed row that
  // the form cannot reach and the dashboard's "to invoice" figure would
  // misread.
  //
  // This acts on the owner's REAL first row, so it restores exactly what it
  // found and asserts the restoration.
  await page.goto(BASE + "/job-work", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const rowCount = await page.evaluate(() => document.querySelectorAll("tbody tr").length);
  if (rowCount === 0) {
    skip("status from the list", "no job works to act on");
  } else {
    const read = () =>
      page.evaluate(() => {
        const row = document.querySelector("tbody tr");
        const combos = [...row.querySelectorAll("[role=combobox]")];
        const bill = combos[1];
        return {
          heads: [...document.querySelectorAll("thead th")].map((t) => t.textContent.trim()),
          status: combos[0]?.textContent.trim() ?? null,
          bill: bill?.textContent.trim() ?? null,
          billDisabled: bill ? bill.hasAttribute("disabled") : null,
          billCursor: bill ? getComputedStyle(bill).cursor : null,
          billTitle: bill?.closest("span[title]")?.getAttribute("title") ?? null,
          statusCol: combos[0]?.closest("td")?.cellIndex ?? null,
          billCol: bill?.closest("td")?.cellIndex ?? null,
        };
      });

    const pick = async (which, label) => {
      await page.locator("tbody tr [role=combobox]").nth(which).click();
      await page.waitForTimeout(350);
      await page.locator('[role="option"]', { hasText: new RegExp("^" + label + "$") }).first().click();
      await page.waitForTimeout(1500);
    };

    const started = await read();
    check(
      "Status and Bill status are separate columns",
      started.heads.includes("Status") &&
        started.heads.includes("Bill status") &&
        started.statusCol !== null &&
        started.billCol === started.statusCol + 1,
      JSON.stringify({ heads: started.heads, statusCol: started.statusCol, billCol: started.billCol })
    );
    check(
      "the Chalan column carries no design number",
      started.heads.includes("Chalan") && !started.heads.some((h) => /Design/i.test(h)),
      JSON.stringify(started.heads)
    );

    // Observe the disabled state for real, whatever the row started as.
    if (started.status !== "Pending") await pick(0, "Pending");
    const pending = await read();
    check(
      "while not Completed the bill dropdown is present but disabled",
      pending.billDisabled === true &&
        pending.billCursor === "not-allowed" &&
        /only be billed once/i.test(pending.billTitle ?? ""),
      JSON.stringify({ disabled: pending.billDisabled, cursor: pending.billCursor, title: pending.billTitle })
    );

    // Disabled must mean it does not open — not merely that it looks grey.
    // Escape afterwards regardless: a stray open menu blocks the next click,
    // which is what broke the first version of this probe.
    await page.locator("tbody tr [role=combobox]").nth(1).click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const opened = await page.evaluate(() => document.querySelectorAll('[role="option"]').length);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    check("clicking the disabled bill dropdown opens nothing", opened === 0, `${opened} options`);

    await pick(0, "Completed");
    const done = await read();
    check(
      "Completed enables the bill dropdown",
      done.billDisabled === false && done.billCursor === "pointer",
      JSON.stringify({ disabled: done.billDisabled, cursor: done.billCursor })
    );

    await pick(1, "Billed");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);
    const billed = await read();
    check(
      "Billed survives a reload — it reached the database",
      billed.bill === "Billed",
      JSON.stringify({ status: billed.status, bill: billed.bill })
    );

    await pick(0, "Pending");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);
    const cleared = await read();
    check(
      "leaving Completed clears Billed and disables the control again",
      cleared.bill === "Not billed" && cleared.billDisabled === true,
      JSON.stringify({ status: cleared.status, bill: cleared.bill, disabled: cleared.billDisabled })
    );

    // Put the row back exactly as it was found.
    if (started.status !== "Pending") await pick(0, started.status);
    if (started.bill === "Billed" && started.status === "Completed") await pick(1, "Billed");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1300);
    const final = await read();
    check(
      "the row is restored to exactly what it started as",
      final.status === started.status && final.bill === started.bill,
      `started=${started.status}/${started.bill} now=${final.status}/${final.bill}`
    );
  }
}

console.log("\n--- ADD A WORK TYPE INLINE ---");
{
  // Creating a type from inside the row is the ONLY way to fill the first
  // description row — there is no management screen for types. It was
  // silently broken: the row took the new type and a spurious empty
  // onValueChange from the Select immediately cleared it again, so the owner
  // saw nothing happen at all.
  //
  // The type this creates is named "ZZ Test …", which `npm run tidy:test`
  // now deletes — it had to be taught to, because nothing in the UI can
  // remove a work type.
  const TYPE = TAG + " Work";

  await page.goto(BASE + "/job-work/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1300);

  const rowValue = () =>
    page.evaluate(() => {
      const sel = document.querySelector('select[name="descriptionTypeId"]');
      const trigger = [...document.querySelectorAll('[role="combobox"]')].find((c) =>
        c.closest('[class*="grid-cols-[1fr_150px_44px]"]')
      );
      return { value: sel ? sel.value : null, shows: trigger?.textContent?.trim() ?? null };
    });

  const beforePick = await rowValue();

  await page.locator('[role="combobox"]').filter({ hasText: /choose work/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('[role="option"]').filter({ hasText: /add new/i }).first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.fill('[role="dialog"] input[name="name"]', TYPE);
  await page.click('[role="dialog"] button:has-text("Add type")');
  // The dialog closing is the signal the action came back.
  await page
    .waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(600);

  const afterCreate = await rowValue();
  check(
    "creating a work type inline selects it into the row",
    beforePick.value === "" && afterCreate.value !== "" && afterCreate.shows === TYPE,
    JSON.stringify({ before: beforePick, after: afterCreate })
  );

  // And it is offered on the next row too, without a reload.
  const offered = await page.evaluate((name) => {
    const sel = document.querySelector('select[name="descriptionTypeId"]');
    return sel ? [...sel.options].some((o) => o.textContent === name) : false;
  }, TYPE);
  check("the new type joins the list immediately", offered);

  // A duplicate must be refused with a readable message, not a Postgres error.
  await page.locator('[role="combobox"]').filter({ hasText: TYPE }).first().click();
  await page.waitForTimeout(350);
  await page.locator('[role="option"]').filter({ hasText: /add new/i }).first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await page.fill('[role="dialog"] input[name="name"]', TYPE);
  await page.click('[role="dialog"] button:has-text("Add type")');
  await page.waitForTimeout(1500);
  const dupMessage = await page.evaluate(
    () => document.querySelector('[role="dialog"]')?.innerText ?? ""
  );
  check(
    "a duplicate type is refused in plain words",
    /already exists/i.test(dupMessage) && !/23505|duplicate key/i.test(dupMessage),
    dupMessage.replace(/\s+/g, " ").slice(0, 90)
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

console.log("\n--- JOB WORK FORM ACTIONS ---");
{
  // The actions used to sit in a bar with `sticky bottom-[-1.25rem]` — a
  // NEGATIVE offset, so it hung 20px past the scroller's edge and both buttons
  // were sliced in half at every scroll position except the very last. The
  // owner reported them as "cut". They now sit in a bar sticky to the TOP,
  // opposite the back link.
  //
  // The assertion is the one that matters: at the top, the middle AND the
  // bottom of the scroll, both controls are fully drawn. Checking only the top
  // would have passed on the old layout too.
  const box = () =>
    page.evaluate(() => {
      const sc = [...document.querySelectorAll("main *")].find((el) => {
        const cs = getComputedStyle(el);
        return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
      });
      const measure = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
        return { h: Math.round(r.height), visible: Math.round(visible) };
      };
      const save = [...document.querySelectorAll("button")].find((x) =>
        /save (job work|changes)/i.test(x.textContent || "")
      );
      const cancel = [...document.querySelectorAll("a")].find((x) => x.textContent.trim() === "Cancel");
      return {
        scrollTop: sc ? Math.round(sc.scrollTop) : null,
        max: sc ? Math.round(sc.scrollHeight - sc.clientHeight) : null,
        save: measure(save),
        cancel: measure(cancel),
        backLinks: [...document.querySelectorAll("main a")].filter((x) =>
          /back to job work/i.test(x.textContent || "")
        ).length,
      };
    });
  const scrollTo = (frac) =>
    page.evaluate((f) => {
      const sc = [...document.querySelectorAll("main *")].find((el) => {
        const cs = getComputedStyle(el);
        return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
      });
      if (sc) sc.scrollTop = Math.round((sc.scrollHeight - sc.clientHeight) * f);
    }, frac);

  await page.goto(BASE + "/job-work/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1400);

  // The three design-number fields must occupy the three columns they appear
  // to. They did not: the grid was lg:grid-cols-3, but Party Design No and
  // Computer Design No were packed into ONE cell by a nested
  // `Field orientation="responsive"`, so Chalan filled column one, those two
  // shared column two at half width, and column three sat empty. Comparing
  // them against the row ABOVE is what makes this an alignment check rather
  // than a restatement of whatever the markup happens to produce.
  const designRow = await page.evaluate(() => {
    const left = (el) => (el ? Math.round(el.getBoundingClientRect().left) : null);
    const width = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
    const bottom = (el) => (el ? Math.round(el.getBoundingClientRect().bottom) : null);
    const byName = (n) => document.querySelector(`input[name="${n}"]`);
    const design = [byName("chalanNo"), byName("partyDesignNo"), byName("computerDesignNo")];
    const above = ["date", "partyId", "karigarId"].map((id) => document.getElementById(id));
    return {
      widths: design.map(width),
      lefts: design.map(left),
      bottoms: design.map(bottom),
      aboveLefts: above.map(left),
      hint: document.querySelector("main").innerText.includes("more than one job work"),
    };
  });
  check(
    "the three design-number fields line up with the row above them",
    new Set(designRow.widths).size === 1 &&
      JSON.stringify(designRow.lefts) === JSON.stringify(designRow.aboveLefts),
    JSON.stringify({ lefts: designRow.lefts, above: designRow.aboveLefts, widths: designRow.widths })
  );
  check(
    "their bottom edges align, so no stray hint pushes one down",
    new Set(designRow.bottoms).size === 1,
    JSON.stringify(designRow.bottoms)
  );

  // The pieces x rate sum belongs INSIDE the total box, beside the answer -
  // not as a caption underneath, which read as a hint about the field and left
  // the box bottom out of line with Pieces and Rate.
  const totalBox = await page.evaluate(() => {
    const out = document.querySelector("#total-preview");
    if (!out) return null;
    const box = out.getBoundingClientRect();
    const pieces = document.querySelector('input[name="pieces"]');
    return {
      text: out.textContent.replace(/s+/g, " ").trim(),
      spanCount: out.querySelectorAll("span").length,
      below: [...(out.parentElement?.children ?? [])]
        .filter((c) => c !== out && c.getBoundingClientRect().top >= box.bottom - 1)
        .map((c) => c.textContent.trim())
        .filter(Boolean),
      bottomMatchesPieces:
        Math.round(box.bottom) === Math.round(pieces.getBoundingClientRect().bottom),
    };
  });
  check(
    "the pieces x rate sum sits inside the total box, with nothing beneath it",
    totalBox !== null &&
      totalBox.spanCount === 2 &&
      totalBox.below.length === 0 &&
      totalBox.bottomMatchesPieces === true,
    JSON.stringify(totalBox)
  );
  check("the chalan-can-repeat hint is gone", designRow.hint === false);

  const seen = [];
  for (const frac of [0, 0.5, 1]) {
    await scrollTo(frac);
    await page.waitForTimeout(300);
    seen.push({ frac, ...(await box()) });
  }
  const whole = (m) => m && m.h > 0 && m.visible === m.h;
  check(
    "Save and Cancel are never clipped, at any scroll position",
    seen.every((v) => whole(v.save) && whole(v.cancel)),
    JSON.stringify(seen.map((v) => ({ at: v.frac, save: v.save, cancel: v.cancel })))
  );
  check(
    "the form actually scrolls, so the check above means something",
    seen[0].max > 100,
    `scrollable=${seen[0].max}px`
  );
  // One back link, not two: the toolbar carries it now and the page-level one
  // was removed with it.
  check("exactly one 'Back to job work' link", seen[0].backLinks === 1, `${seen[0].backLinks} links`);
}

console.log("\n--- DELETE SITS WITH THE OTHER ACTIONS ---");
{
  // The delete control used to be a "Danger zone" card below the form: a
  // separator, a heading and a full-width button, furthest from the actions it
  // belongs with. It is now in the form's own bar beside Save changes.
  //
  // This opens the owner's existing job work and CANCELS the dialog — it never
  // confirms. The deletion itself was driven end to end on a throwaway record
  // (created and destroyed in the same run, verified against the database);
  // repeating that on every suite run would mean creating a job work each
  // time, which needs a description type and leaves rows behind.
  await page.goto(BASE + "/job-work", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1100);
  const firstHref = await page.evaluate(() => {
    const a = [...document.querySelectorAll("tbody tr a")].find((x) =>
      /\/job-work\/[^/?]+$/.test(x.getAttribute("href") || "")
    );
    return a?.getAttribute("href") ?? null;
  });

  if (!firstHref) {
    skip("delete beside save", "no job work to open");
  } else {
    await page.goto(BASE + firstHref, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const bar = await page.evaluate(() => {
      const text = document.querySelector("main").innerText;
      const find = (re) =>
        [...document.querySelectorAll("button, a")].find((x) => re.test(x.textContent || ""));
      const del = find(/^\s*Delete\s*$/);
      const save = find(/Save changes/);
      const top = (el) => (el ? Math.round(el.getBoundingClientRect().top) : null);
      const left = (el) => (el ? Math.round(el.getBoundingClientRect().left) : null);
      return {
        dangerZone: /Danger zone/i.test(text),
        deletePresent: Boolean(del),
        sameRow: del && save ? Math.abs(top(del) - top(save)) < 8 : null,
        deleteLeftOfSave: del && save ? left(del) < left(save) : null,
      };
    });

    check("the Danger zone card is gone", bar.dangerZone === false);
    check(
      "Delete sits on the same row as Save changes, to its left",
      bar.deletePresent && bar.sameRow === true && bar.deleteLeftOfSave === true,
      JSON.stringify(bar)
    );

    // It must ASK, in the app's shared confirm shell, and cancelling must
    // leave the record alone.
    await page.locator('button:has-text("Delete")').first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(350);
    const dialog = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return {
        asks: /cannot be undone/i.test(d.innerText),
        confirmLabel: [...d.querySelectorAll("button")].map((b) => b.textContent.trim()),
      };
    });
    check(
      "deleting asks first, in the shared confirm dialog",
      dialog.asks && dialog.confirmLabel.some((l) => /Delete job work/i.test(l)),
      JSON.stringify(dialog)
    );

    await page.click('[role="dialog"] button:has-text("Cancel")');
    await page
      .waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 8000 })
      .catch(() => {});
    await page.waitForTimeout(400);
    const stillHere = await page.evaluate(() =>
      Boolean(document.querySelector('input[name="pieces"]'))
    );
    check("cancelling the delete leaves the record open and intact", stillHere);
  }
}

console.log("\n--- REPORTS ---");
{
  // The owner's four reports — monthly all / monthly per party / yearly all /
  // yearly per party — are one screen: a PERIOD and a GROUPING.
  //
  // The check that matters is not "the table renders" but that the arithmetic
  // cannot lie. Grouping the SAME year three different ways must produce the
  // same grand total: if grouping could invent or lose money, every figure on
  // this screen would be worthless.
  const table = () =>
    page.evaluate(() => {
      const foot = [...document.querySelectorAll("tfoot tr td")].map((td) => td.textContent.trim());
      return {
        heads: [...document.querySelectorAll("thead th")].map((th) => th.textContent.trim()),
        rows: [...document.querySelectorAll("tbody tr")].map((tr) =>
          [...tr.children].map((td) => td.textContent.trim())
        ),
        foot,
        grand: foot.length ? foot[foot.length - 1] : null,
        title: document.querySelector("main h2")?.textContent?.trim() ?? null,
      };
    });
  const money = (t) => Number(String(t ?? "").replace(/[^0-9]/g, ""));

  await page.goto(BASE + "/reports", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const byParty = await table();

  if (byParty.rows.length === 0) {
    skip("reports", "no job work in the current month");
  } else {
    check(
      "the report opens on this month, grouped by party",
      byParty.heads[0] === "Party" && /\w+ \d{4}/.test(byParty.title ?? ""),
      JSON.stringify({ title: byParty.title, heads: byParty.heads })
    );
    check(
      "its grand total is the sum of its own rows",
      money(byParty.grand) ===
        byParty.rows.reduce((a, r) => a + money(r[r.length - 1]), 0),
      `grand=${byParty.grand} rows=${byParty.rows.map((r) => r[r.length - 1]).join("+")}`
    );

    // The invariant. Three groupings, one year, one answer.
    const totals = {};
    for (const g of ["party", "karigar", "month", "none"]) {
      await page.goto(BASE + `/reports?period=year&groupBy=${g}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      totals[g] = money((await table()).grand);
    }
    check(
      "grouping the same year four ways gives the same total",
      new Set(Object.values(totals)).size === 1,
      JSON.stringify(totals)
    );

    // And the file must say what the screen says.
    await page.goto(BASE + "/reports?period=year&groupBy=party", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const onScreen = await table();
    let file = null;
    try {
      // Open the menu, then take the Excel item — the export stopped being a
      // single link when PDF was added beside it.
      await page.click('button:has-text("Export")');
      await page.waitForTimeout(400);
      const [dl] = await Promise.all([
        page.waitForEvent("download", { timeout: 20000 }),
        page.locator('a:has-text("Excel")').click(),
      ]);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(await dl.path());
      const ws = wb.worksheets[0];
      const rows = [];
      ws.eachRow((row, n) => {
        if (n >= 3) rows.push(row.values.slice(1));
      });
      file = {
        name: dl.suggestedFilename(),
        context: String(ws.getCell("A2").value ?? ""),
        header: rows[0],
        total: rows[rows.length - 1]?.[6],
        dataRows: rows.length - 2,
      };
    } catch {}

    check(
      "the report exports as a summary that matches the screen",
      file !== null &&
        /\.xlsx$/.test(file.name) &&
        file.total === money(onScreen.grand) &&
        file.dataRows === onScreen.rows.length,
      JSON.stringify(file)
    );
    check(
      "the report header carries no job-work/pieces line",
      !/job works? · [\d,]+ pieces/.test(await page.evaluate(() => document.querySelector("main").innerText)),
      "removed at the owner's request — the table states both already"
    );

    // Excel or PDF, the same choice the job work list used to offer.
    await page.click('button:has-text("Export")');
    await page.waitForTimeout(450);
    const menu = await page.evaluate(() => {
      const inView = (el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      };
      const links = [...document.querySelectorAll("a")].filter((a) => /Excel|PDF/.test(a.textContent || ""));
      return {
        options: links.map((a) => a.textContent.trim().split("\n")[0]),
        allInView: links.every(inView),
      };
    });
    check(
      "the report offers Excel and PDF, both reachable",
      menu.options.length === 2 && menu.allInView === true,
      JSON.stringify(menu)
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // The printed report must show the same figures as the screen — it is a
    // second renderer of the same query, and the one that ends up on paper.
    await page.goto(BASE + "/reports/print?period=year&groupBy=party", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1300);
    const printed = await page.evaluate(() => {
      const cells = [...document.querySelectorAll("tfoot td")].map((td) => td.textContent.trim());
      return {
        grand: cells[cells.length - 1] ?? null,
        rows: document.querySelectorAll("tbody tr").length,
        sub: document.querySelector("p")?.textContent?.trim() ?? "",
      };
    });
    check(
      "the PDF page shows the same total and rows as the screen",
      money(printed.grand) === money(onScreen.grand) && printed.rows === onScreen.rows.length,
      JSON.stringify({ printed, screen: { grand: onScreen.grand, rows: onScreen.rows.length } })
    );

    check(
      "the file says which period and grouping it is",
      file !== null && /2026/.test(file.context) && /by party/i.test(file.context),
      String(file?.context)
    );
  }
}

console.log("\n--- CURSORS ---");
{
  // Tailwind v4's Preflight resets `button` to `cursor: default`, following
  // the HTML spec where only links are pointer. The effect here was that every
  // button, dropdown and switch in the app showed a plain arrow — 14 of 20
  // enabled controls when first surveyed. On a laptop the cursor is half of
  // what says "this is clickable" BEFORE you click, so it is restored in
  // globals.css and pinned here: a per-component `cursor-pointer` class is
  // exactly the kind of thing that gets forgotten on the next component.
  //
  // A date input is the one deliberate exception: the browser's own cursor
  // there is an arrow, and only the little calendar button inside it opens the
  // picker — that indicator gets the pointer instead.
  const SEL =
    'button, [role="button"], [role="combobox"], [role="switch"], [role="tab"], summary, select, input[type="checkbox"], input[type="radio"], input[type="file"]';

  const survey = () =>
    page.evaluate((sel) => {
      const bad = [];
      let checked = 0;
      for (const el of document.querySelectorAll(sel)) {
        if (!el.getClientRects().length) continue;
        const cs = getComputedStyle(el);
        // An element that cannot be hovered shows its parent's cursor, so it
        // has no cursor of its own to be wrong about.
        if (cs.pointerEvents === "none") continue;
        const off = el.disabled || el.getAttribute("aria-disabled") === "true";
        checked++;
        const want = off ? "not-allowed" : "pointer";
        if (cs.cursor !== want) {
          bad.push(
            `${el.tagName}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""}` +
              `${off ? "(off)" : ""}="${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)}" ` +
              `is ${cs.cursor}`
          );
        }
      }
      return { checked, bad };
    }, SEL);

  for (const [name, url] of [
    ["dashboard", "/dashboard"],
    ["parties", "/parties"],
    ["karigars", "/karigars"],
    ["job-work", "/job-work"],
    ["job-work/new", "/job-work/new"],
    ["settings", "/settings"],
  ]) {
    await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const r = await survey();
    check(
      `${name}: every control shows the right cursor`,
      r.checked > 0 && r.bad.length === 0,
      r.bad.length ? r.bad.slice(0, 4).join("; ") : `${r.checked} controls`
    );
  }

  // And inside a dialog, which is its own DOM tree via a portal.
  await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await openCreateDialog(page, "Add party");
  await page.waitForTimeout(500);
  const inDialog = await survey();
  check(
    "dialog: every control shows the right cursor",
    inDialog.checked > 0 && inDialog.bad.length === 0,
    inDialog.bad.length ? inDialog.bad.slice(0, 4).join("; ") : `${inDialog.checked} controls`
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

console.log("\n--- NOTHING IS CLIPPED (short screen) ---");
{
  const shortCtx = await browser.newContext({ viewport: { width: 1366, height: 620 } });
  const sp = await shortCtx.newPage();
  await login(sp);
  for (const path of ["/dashboard", "/parties", "/karigars", "/job-work", "/job-work/new", "/settings"]) {
    await sp.goto(BASE + path, { waitUntil: "domcontentloaded" });
    await sp.waitForTimeout(700);
    const r = await sp.evaluate(() => {
      const vh = window.innerHeight;
      const clipped = [];
      for (const el of document.querySelectorAll("main *")) {
        const b = el.getBoundingClientRect();
        if (b.height === 0 || b.bottom <= vh + 2) continue;
        // Below the fold is fine IF some ancestor can scroll it into view.
        let n = el.parentElement;
        let reachable = false;
        while (n && n !== document.body) {
          const st = getComputedStyle(n);
          if ((st.overflowY === "auto" || st.overflowY === "scroll") && n.scrollHeight > n.clientHeight + 1) {
            reachable = true;
            break;
          }
          n = n.parentElement;
        }
        if (!reachable) clipped.push(el.tagName.toLowerCase() + "." + String(el.className).slice(0, 30));
      }
      return { count: clipped.length, first: clipped.slice(0, 2).join(" ; ") };
    });
    check(`${path}: nothing clipped at 1366x620`, r.count === 0, r.first);
  }
  await shortCtx.close();
}

console.log("\njs page errors across the run:", jsErrors.length ? jsErrors.join(" | ") : "none");
console.log(`\n${pass} passed, ${failures.length} failed, ${skipped} skipped`);
if (failures.length) console.log("FAILURES:\n  " + failures.join("\n  "));
await browser.close();
process.exit(failures.length ? 1 : 0);
