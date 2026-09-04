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
console.log("\n--- IMAGE UPLOAD ---");
{
  await page.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await openCreateDialog(page, "Add party");

  check("the party form offers a logo box", await page.isVisible("text=Choose an image"));
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
