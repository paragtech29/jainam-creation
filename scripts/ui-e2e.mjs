// The core flow, end to end, in a real browser: record a job work the way the
// owner would - pick the party, pick the karigar it unlocks, add a description
// row, let the rate derive, enter the pieces - then confirm the total matches
// the arithmetic in his book. 126 x 162 = 20412, from the real register page.
//
// The dev server must be running.  npm run ui:e2e
//
// It leaves ONE job work behind (Mayra / Zuber / chalan 767). Remove it from
// the job work list, or run npm run reset:data -- --yes to clear all records.
import { chromium } from "playwright";
const BASE = "http://localhost:3000";

let pass = 0; const fails = [];
const check = (l, ok, d = "") => { if (ok) pass++; else fails.push(l + " " + d); console.log(`${ok ? "PASS" : "FAIL"} - ${l}${d ? "  (" + d + ")" : ""}`); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
const jsErr = [];
page.on("pageerror", (e) => jsErr.push(String(e.message).slice(0, 140)));

await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await page.fill('input[name="username"]', "testowner");
await page.fill('input[name="password"]', "newpass456");
await page.click('button[type="submit"]');
await page.waitForTimeout(1600);

await page.goto(BASE + "/job-work/new", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1400);

// Date
await page.fill('input[name="date"]', "2026-08-14");

// Party -> then karigar becomes selectable (the dependent dropdown).
await page.click('[id="partyId"]');
await page.waitForTimeout(500);
await page.click('[role="option"]:has-text("Mayra")');
await page.waitForTimeout(900);

const karigarEnabled = await page.evaluate(() => {
  const t = document.querySelector('[id="karigarId"]');
  return t ? !(t.getAttribute("disabled") !== null || /choose a party first/i.test(t.textContent || "")) : false;
});
check("choosing a party unlocks the karigar dropdown", karigarEnabled);

await page.click('[id="karigarId"]');
await page.waitForTimeout(500);
await page.click('[role="option"]:has-text("Zuber")');
await page.waitForTimeout(500);

// One description row: pick a type, type a price.
await page.click('[id="descriptionTypeId"], [name="descriptionTypeId"]').catch(async () => {
  await page.locator('button:has-text("Choose work")').first().click();
});
await page.waitForTimeout(600);
await page.locator('[role="option"]').first().click();
await page.waitForTimeout(400);
await page.fill('input[name="price"]', "162");
await page.waitForTimeout(700);

// Rate should now derive from the row price.
const derived = await page.inputValue('input[name="rate"]');
check("rate derives from the description row", derived === "162", "rate=" + derived);

await page.fill('input[name="pieces"]', "126");
await page.waitForTimeout(600);

const shown = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
check("the form previews the book total 20,412", /20,?412/.test(shown));

await page.fill('input[name="chalanNo"]', "767");
await page.locator('button:has-text("Save job work")').first().click();
// Wait for the redirect rather than guessing at a sleep: a cold dev-server
// compile can take longer than any fixed timeout worth writing.
await page
  .waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 30000 })
  .catch(() => {});
await page.waitForTimeout(500);

const savedUrl = page.url();
check("job work saves and leaves the form", !savedUrl.includes("/new"), savedUrl);

await page.goto(BASE + "/job-work", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const listText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
check("the new row shows in the list with the right total", /20,412/.test(listText) && /Mayra/.test(listText), listText.slice(0, 160));
check("126 x 162 is shown as recorded", /126/.test(listText) && /162/.test(listText));

console.log("\njs errors:", jsErr.length ? jsErr.join(" | ") : "none");
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) console.log("FAILED:\n  " + fails.join("\n  "));
await browser.close();
