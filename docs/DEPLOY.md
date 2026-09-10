# Putting Jainam Creation online (Vercel)

Everything here is free. No card, no subscription, no API key — the same rule
the project started with.

You need three things, and two of them already exist:

| | |
|---|---|
| The code | already on GitHub — `paragtech29/jainam-creation` |
| The database | already on Neon — the same one the app uses now |
| A Vercel account | free, sign in with GitHub |

---

## Before you start: which branch?

All the work is on the **`dev`** branch. Vercel deploys `main` by default, so
either merge first (recommended) or tell Vercel to use `dev`.

**Merge `dev` into `main`:**

```bash
git checkout main
git merge dev
git push origin main
git checkout dev
```

If `main` does not exist yet on GitHub, `git push -u origin main` creates it.

---

## Step 1 — Create the Vercel project

1. Go to **vercel.com** and click **Sign Up** → **Continue with GitHub**.
2. On the dashboard, click **Add New… → Project**.
3. Find **jainam-creation** in the repository list and click **Import**.
   - If it is not listed, click **Adjust GitHub App Permissions** and give
     Vercel access to that repository.
4. Leave every build setting alone. Vercel detects Next.js by itself:
   - Framework: **Next.js**
   - Build command: `next build`
   - Output: `.next`

**Do not click Deploy yet** — add the environment variables first (Step 2), or
the first build will fail with a database error.

---

## Step 2 — Environment variables

Still on the import screen, open **Environment Variables** and add these
three. The values are in your `.env.local` file on this machine — open it and
copy each one exactly.

| Name | Where the value comes from |
|---|---|
| `DATABASE_URL` | the Neon connection string, from `.env.local` |
| `AUTH_SECRET` | from `.env.local` — the value that signs login cookies |
| `AUTH_TRUST_HOST` | type `true` |

Three things worth knowing:

- **Copy `DATABASE_URL` whole**, including everything after the `?`. Neon needs
  the `sslmode` part; without it the app cannot connect.
- **Keep `AUTH_SECRET` the same** as the one you already have. Changing it is
  not dangerous, it simply signs everyone out.
- **Never paste these into a chat, a screenshot, or a file in the repository.**
  `.env.local` is git-ignored on purpose. Anyone with `DATABASE_URL` has your
  brother's entire register.

Set all three for **Production, Preview and Development** (the three tick
boxes). Then click **Deploy**.

The first build takes two to three minutes.

---

## Step 3 — Check it works

Vercel gives you a link like `https://jainam-creation.vercel.app`.

Open it and check, in this order:

1. The login page appears.
2. Signing in as **Nilesh** works.
3. The dashboard loads and says ₹0 — the register is empty, which is correct.
4. Add one party, then one silai karigar, then one job work.
5. Open it on your **phone**, sign in, and add a job work there. This is the
   one that matters: the whole point is recording work from the market.

If the login page appears but signing in fails, `AUTH_SECRET` or
`AUTH_TRUST_HOST` is missing. If the page itself errors, `DATABASE_URL` is
wrong — Vercel's **Deployments → the deployment → Runtime Logs** will say
which.

---

## Step 4 — Hand it to your brother

Send him the link. He signs in with:

- **Username:** `Nilesh`
- **Password:** the one you chose

Tell him to **change the password** on first use: **Settings → Change
password**. You will not be able to see the new one, which is the point.

On a phone, Chrome's **⋮ → Add to Home screen** puts an icon on his home
screen that opens straight into the app.

---

## After it is live

**Every push to `main` redeploys automatically.** Push a change, wait two
minutes, refresh.

**Backups.** There is no database console in this app. Once a month, open
**Settings → Download all data** and keep the Excel file somewhere safe. It
includes which karigars work for which parties, so it can rebuild the whole
register.

**If he forgets his password**, on this machine:

```bash
npm run user:reset-password -- Nilesh <a new password>
```

**Neon's free tier sleeps** after a period with no traffic. The first page load
after a quiet spell takes a few seconds while the database wakes; everything
after that is normal. Nothing is lost.

**Vercel's free plan is for non-commercial use.** This is a tool for one
family business rather than a product being sold, but it is worth knowing that
the limit exists.

---

## Running the test suite after handover

`npm run ui:test` needs an account of its own. It **creates and deletes** rows
as it runs — parties, karigars and work types named `ZZ Test …` — so pointing
it at your brother's account would write test data into live records.

```bash
npm run user:create -- uitest <a password>
set UI_USER=uitest & set UI_PASS=<that password> & npm run ui:test
```

The suite cleans up its own rows when it finishes, pass or fail.
