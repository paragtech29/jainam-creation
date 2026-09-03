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
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const USER = process.env.UI_USER || "testowner";
const PASS = process.env.UI_PASS || "newpass456";
const MODE = process.argv[2] || "test";
// Letters only: a person name legitimately rejects digits.
// The "ZZ Test" prefix is what `npm run seed:bulk -- --wipe` removes, so
// rows this suite creates are cleaned up by that one command.
const TAG = "ZZ Test QA " + (Math.random().toString(36).slice(2, 7).replace(/[^a-z]/gi, "") || "qa");

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  laptop: { width: 1366, height: 768 },
  wide: { width: 1920, height: 1080 },
};

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["parties", "/parties"],
  ["parties-new", "/parties?new=1"],
  ["parties-nomatch", "/parties?q=zzzzz"],
  ["karigars", "/karigars"],
  ["karigars-new", "/karigars?new=1"],
  ["jobwork", "/job-work"],
  ["jobwork-new", "/job-work/new"],
  ["settings", "/settings"],
];

let pass = 0;
let skipped = 0;
const failures = [];

// A pagination rule cannot be tested with three records. Skipping loudly is
// honest; reporting a pass or a failure would both be lies.
function skip(label, why) {
  skipped++;
  console.log(`SKIP - ${label}  (${why})`);
}
function check(label, ok, detail = "") {
  if (ok) pass++;
  else failures.push(label + (detail ? "  (" + detail + ")" : ""));
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${detail ? "  (" + detail + ")" : ""}`);
}

async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="username"]', USER);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1600);
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

// These rules cannot be tested with three records. Detect that and skip
// loudly — reporting a pass or a failure would both be dishonest.
await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const totalParties = await page.evaluate(() => {
  const m = document.body.innerText.match(/of\s+(\d+)/);
  return m ? Number(m[1]) : document.querySelectorAll("tbody tr").length;
});
const canPage = totalParties > 10;
if (!canPage) skip("pagination rules", `only ${totalParties} records — run: npm run seed:bulk`);

for (const [label, path, expectPager] of [
  ["parties page 1", "/parties", true],
  ["parties last page", "/parties?page=3", true],
  ["parties single result", "/parties?q=zzzzz", false],
  ["karigars last page", "/karigars?page=3", true],
  ["job work last page", "/job-work?page=3", true],
]) {
  if (!canPage && expectPager) continue;
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
await page.goto(BASE + "/parties?new=1", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1100);
const addParty = () => page.locator('button:has-text("Add party")').last().click();

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
await page.waitForTimeout(3000);
check("fixing the one flagged field saves the party",
  !(await page.isVisible('input[name="name"]').catch(() => false)), page.url());

// ─────────────────────────── karigar validation ───────────────────────────
console.log("\n--- KARIGAR VALIDATION ---");
await page.goto(BASE + "/karigars?new=1", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1100);
const addKarigar = () => page.locator('button:has-text("Add karigar")').last().click();

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
  !(await page.isVisible('input[name="name"]').catch(() => false)), page.url());

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
