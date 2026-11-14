# Sign in with GitHub — one-time setup

The admin tools save straight to this repository. GitHub only gives a sign-in key in exchange for a
secret, and a secret can't live in a public website, so a tiny free Cloudflare Worker (this folder)
holds it. You set this up once; after that, "Sign in with GitHub" on the site's Admin page just works.

Who is an admin is decided on GitHub: anyone who can write to the repository. To add an admin later,
add them as a collaborator on GitHub.

## 1. Create the GitHub App (about 3 minutes)

1. Open <https://github.com/settings/apps/new>.
2. Fill in:
   - **GitHub App name:** `Kirtan Guide Admin` (any free name)
   - **Homepage URL:** `https://desillusionist.github.io/sri-gitanjali/`
   - **Callback URL:** leave for now (filled in at step 3)
   - **Expire user authorization tokens:** keep ticked
   - **Webhook → Active:** untick
   - **Repository permissions → Contents:** *Read and write* (Metadata becomes *Read-only* by itself)
   - **Where can this GitHub App be installed?** *Only on this account*
3. Create it. On its page, note the **Client ID**, then **Generate a new client secret** and copy it.
4. In the left menu, **Install App** → install it on **Only select repositories → sri-gitanjali**.

## 2. Deploy the Worker (about 5 minutes)

You need a free Cloudflare account (<https://dash.cloudflare.com/sign-up>). Then, in this folder:

```bash
cd workers/github-auth
npx wrangler login
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put STATE_SECRET
npx wrangler deploy
```

For `STATE_SECRET`, type any long random text. `deploy` prints the Worker's address, like
`https://kirtan-guide-auth.<your-name>.workers.dev`.

## 3. Connect the pieces

1. Back on the GitHub App's page, set **Callback URL** to the Worker's address + `/callback`, e.g.
   `https://kirtan-guide-auth.<your-name>.workers.dev/callback`, and save.
2. Put the Worker's address (without `/callback`) in `client/src/data/admin.json` as `authUrl`, and
   push. (Or send it to Claude.)

That's all: open the site → Vaiṣṇavas → Admin → **Sign in with GitHub**.
