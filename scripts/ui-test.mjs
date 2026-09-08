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
const ctx = await browser.newContext({ viewport: VIEWPORTS.laptop });
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
    crashed: /Application error|Unhandled Runtime/i.test(document.body.innerText),
  }));
  check(`${name}: renders clean`, jsErrors.length === before && !m.crashed && !m.hScroll,
    `js=${jsErrors.length - before} hScroll=${m.hScroll}`);
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
    check("an Export button is on the job work list", await page.isVisible('button:has-text("Export")'));

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
        body.length === screen.of,
        `xlsx=${body.length} db=${screen.of}`
      );

      const summed = body.reduce((a, r) => a + Number(r.getCell(totalCol).value || 0), 0);
      const stated = Number(totalRow.getCell(totalCol).value || 0);
      check("the grand total equals the sum of its own rows", summed === stated, `rows=${summed} stated=${stated}`);
      check(
        "and equals the total shown on screen",
        stated === Number((screen.total ?? "0").replace(/,/g, "")),
        `xlsx=${stated} screen=${screen.total}`
      );

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

  // The job work form carries two, per the owner's fixed count.
  await page.goto(BASE + "/job-work/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const boxes = await page.evaluate(
    () => document.querySelectorAll('input[type="file"][name^="photo"]').length
  );
  check("the job work form has exactly two photo fields", boxes === 2, "found " + boxes);

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
  // Equal widths: the containers matched before this check existed while the
  // select TRIGGERS inside them sized to their own text (106/113/110/68px
  // measured), which is exactly the raggedness the owner saw.
  check(
    "every filter dropdown is the same width",
    panel.selectWidths.length >= 4 && new Set(panel.selectWidths).size === 1,
    JSON.stringify(panel.selectWidths)
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
