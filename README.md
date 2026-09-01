# \u2764\uFE0F Our Space \u2014 Version 1

A private, mobile-first web app for two: a WhatsApp-style chat, love notes,
a memories gallery, and a relationship timeline, wrapped in one warm, quiet
space that belongs only to the two of you.

This is **Version 1** \u2014 a fully working frontend prototype with demo data.
There is no real backend yet; everything is stored locally in your browser
so the experience can be built and refined before Firebase is wired in.

---

## What's here

- **Chat** \u2014 a one-to-one messenger with grouped bubbles, timestamps, and
  read receipts, styled after familiar messaging apps but with its own
  identity.
- **Love Notes** \u2014 short, personal notes separate from the chat stream,
  including a locked-note concept for future date-based reveals.
- **Memories** \u2014 a responsive photo gallery (placeholder gradients for
  now) with a lightbox for each memory.
- **Our Journey** \u2014 a vertical timeline of relationship milestones with a
  live "together for" counter, folded into the Us page.
- **Us** \u2014 the couple profile: names, favourite things, "our song"
  placeholder, and settings (dark mode, log out).

---

## Folder structure

```
/
\u251c\u2500\u2500 index.html
\u251c\u2500\u2500 css/
\u2502   \u251c\u2500\u2500 style.css        # design tokens, layout, components
\u2502   \u2514\u2500\u2500 responsive.css   # tablet/desktop overrides
\u251c\u2500\u2500 js/
\u2502   \u251c\u2500\u2500 config.js        # names, dates, theme \u2014 the one file to edit
\u2502   \u251c\u2500\u2500 storage.js       # the only file that touches localStorage
\u2502   \u251c\u2500\u2500 auth.js          # demo login/logout
\u2502   \u251c\u2500\u2500 router.js        # hash-based client routing
\u2502   \u251c\u2500\u2500 chat.js          # chat feature module
\u2502   \u251c\u2500\u2500 notes.js         # love notes feature module
\u2502   \u251c\u2500\u2500 memories.js      # memories gallery feature module
\u2502   \u251c\u2500\u2500 journey.js       # timeline + relationship counter
\u2502   \u251c\u2500\u2500 us.js            # couple profile page, pulls journey.js in
\u2502   \u2514\u2500\u2500 app.js           # bootstraps the app, login screen, theme, toast
\u2514\u2500\u2500 assets/
    \u251c\u2500\u2500 images/
    \u2514\u2500\u2500 icons/
```

No build step, no bundler, no framework \u2014 open `index.html` and it runs.

---

## Running it locally

Because the app uses ES-module-free, plain `<script>` tags, you can open
`index.html` directly in a browser. If your browser blocks local file
access for any reason, serve the folder instead:

```bash
# from inside the project folder
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, go to **Settings \u2192 Pages**.
3. Under **Source**, choose the branch (usually `main`) and the root
   folder (`/`).
4. Save. GitHub will publish the site at
   `https://<your-username>.github.io/<repo-name>/`.

No server, no environment variables, no build step are required for
Version 1.

---

## Where configuration lives

Everything you're likely to want to change \u2014 the app name, both display
names, the relationship start date, favourite things \u2014 lives in one place:
`js/config.js`. Nothing else in the codebase hard-codes these values, so
updating that file updates the whole app.

---

## How localStorage is used right now

`js/storage.js` is the **only** file that talks to `localStorage` directly.
Every feature module (chat, notes, memories, journey) calls functions like
`Storage.getMessages()` / `Storage.setMessages()` instead of touching the
browser API itself. Data currently stored:

- Session (which demo user is "logged in")
- Chat messages
- Love notes
- Memories
- Journey timeline events
- Theme preference (light/dark)

This is demo-only storage: it lives in one browser, on one device, and
isn't shared between the two of you yet. That's expected for Version 1.

---

## How Firebase will replace this later

Because `storage.js` is the single point of contact with persistence, the
plan for Version 2 is to swap its internals \u2014 not its shape:

| Now (V1)                     | Later (V2)                          |
|-------------------------------|--------------------------------------|
| `localStorage` via `storage.js` | Firebase Firestore, same function names |
| Demo login in `auth.js`       | Firebase Authentication              |
| Gradient placeholders         | Firebase Storage for real photos     |

Feature modules (`chat.js`, `notes.js`, etc.) call `Storage.get...()` and
`Storage.set...()` and never localStorage directly, so this swap shouldn't
require rewriting the UI layer.

---

## Security considerations

- Version 1 intentionally has **no real password check**. It's a two-person
  prototype with placeholder demo data, not a production login.
- Nothing in this repository should ever contain real private messages,
  real photos, or real credentials \u2014 keep V1 data as demo data only.
- When Firebase is introduced, real protection comes from **Firebase
  Authentication + Firestore Security Rules**, restricting reads and
  writes to exactly the two authorised accounts. A public URL is never a
  substitute for that.
- Firebase config keys (when added) should be treated as public
  identifiers, not secrets \u2014 actual access control lives in the security
  rules, not in hiding the config.

---

## Version 2 roadmap (not built yet)

- Firebase Authentication (real accounts for the two of you)
- Firestore for messages, notes, memories, and journey events
- Firebase Storage for real photo uploads
- Real-time sync between devices
- Image sharing and voice messages in chat
- Typing indicators and live online status
- Message reactions
- Date-based and countdown-based note unlocking
- Push notifications
- Shared playlist for "Our Song"
- Deeper relationship stats and memory organisation

Version 1 was built with this roadmap in mind: the separation between
UI, storage, and auth should make each of these an addition, not a
rewrite.
