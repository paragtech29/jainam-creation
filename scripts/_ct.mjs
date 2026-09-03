import { chromium } from "playwright";
const BASE = "http://localhost:3000";
let pass = 0; const fails = [];
const ck = (l, ok, d = "") => { if (ok) pass++; else fails.push(l); console.log(`${ok ? "PASS" : "FAIL"} - ${l}${d ? "  (" + d + ")" : ""}`); };

const b = await chromium.launch({ headless: true });
const c = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await c.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e.message).slice(0, 140)));
await p.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await p.fill('input[name="username"]', "testowner");
await p.fill('input[name="password"]', "newpass456");
await p.click('button[type="submit"]');
await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});

const saveDisabled = () => p.evaluate(() => {
  const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /save changes/i.test(x.textContent || ""));
  return b ? b.disabled : null;
});
const openFirstParty = async () => {
  await p.goto(BASE + "/parties", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(900);
  await p.locator("table tbody tr td button").first().click();
  await p.waitForSelector('[role="dialog"]', { timeout: 15000 });
};

// ---- CANCEL ----
await openFirstParty();
await p.locator('[role="dialog"] button:has-text("Cancel")').click();
await p.waitForTimeout(700);
ck("Cancel closes the edit dialog", !(await p.isVisible('[role="dialog"]').catch(() => false)));

await p.locator('button:has-text("Add party")').first().click();
await p.waitForSelector('[role="dialog"]', { timeout: 15000 });
await p.locator('[role="dialog"] button:has-text("Cancel")').click();
await p.waitForTimeout(700);
ck("Cancel closes the create dialog too", !(await p.isVisible('[role="dialog"]').catch(() => false)));
ck("Cancel leaves the URL alone", p.url().endsWith("/parties"), p.url());

// ---- SAVE ENABLED ONLY WHEN CHANGED ----
await openFirstParty();
ck("Save changes starts DISABLED on an untouched form", (await saveDisabled()) === true);

const nameNow = await p.inputValue('input[name="name"]');
await p.fill('input[name="name"]', nameNow + "X");
await p.waitForTimeout(400);
ck("typing enables Save", (await saveDisabled()) === false);

await p.fill('input[name="name"]', nameNow);
await p.waitForTimeout(400);
ck("undoing the edit disables it again", (await saveDisabled()) === true);

// A dropdown change must count too.
await p.locator('[role="dialog"] [id="gender"]').click();
await p.waitForTimeout(400);
const opts = await p.locator('[role="option"]').allTextContents();
const other = opts.find((o) => !/choose/i.test(o));
await p.getByRole("option", { name: other, exact: true }).click();
await p.waitForTimeout(500);
ck("changing the gender dropdown enables Save", (await saveDisabled()) === false, "picked " + other);
await p.keyboard.press("Escape");

// ---- CREATE stays enabled (so blank submit shows validation) ----
await p.locator('button:has-text("Add party")').first().click();
await p.waitForSelector('[role="dialog"]', { timeout: 15000 });
const addDisabled = await p.evaluate(() => {
  const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => /add party/i.test(x.textContent || ""));
  return b ? b.disabled : null;
});
ck("Add party stays enabled on a blank create form", addDisabled === false);
await p.keyboard.press("Escape");

// ---- KARIGAR ----
await p.goto(BASE + "/karigars", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(900);
await p.locator("table tbody tr td button").first().click();
await p.waitForSelector('[role="dialog"]', { timeout: 15000 });
ck("karigar Save starts DISABLED", (await saveDisabled()) === true);
const kn = await p.inputValue('input[name="name"]');
await p.fill('input[name="name"]', kn + "Y");
await p.waitForTimeout(400);
ck("typing enables the karigar Save", (await saveDisabled()) === false);
await p.fill('input[name="name"]', kn);
await p.waitForTimeout(400);
ck("undo disables it again", (await saveDisabled()) === true);

// Ticking a party in the checklist must count as a change.
// The MultiSelect trigger shows the placeholder when empty and "N selected"
// once something is ticked, so match either.
const trigger = p.locator('[role="dialog"] button').filter({ hasText: /selected|Select parties/i }).first();
if (await trigger.count()) {
  await trigger.click();
  await p.waitForTimeout(500);
  const opt = p.locator('[role="option"], [role="dialog"] [cmdk-item]').first();
  if (await opt.count()) {
    await opt.click();
    await p.waitForTimeout(500);
    ck("ticking a party enables Save", (await saveDisabled()) === false);
  } else ck("party checklist had options", false, "none found");
} else ck("party checklist trigger found", false, "not found");

console.log(`\n${pass} passed, ${fails.length} failed`);
await b.close();
process.exit(fails.length ? 1 : 0);
