# ❤️ Our Space — Version 1

A private, mobile-first web app for two: a WhatsApp-style chat, love notes,
a memories gallery, and a relationship timeline, wrapped in one warm, quiet
space that belongs only to the two of you.

This is **Version 1** — a fully working frontend prototype with demo data.
There is no real backend yet; everything is stored locally in your browser
so the experience can be built and refined before Firebase is wired in.

---

## What's here

- **Chat**: a one-to-one messenger with day separators, grouped bubbles,
  read receipts, an emoji picker, photo sharing (gallery or camera), and
  double-tap to heart a message.
- **Love Notes**: write notes for each other, readable right away, sealed
  as "open when…" notes the reader opens in their own moment, or sealed
  until a date when they unlock by themselves.
- **Memories**: a responsive gallery. Add a memory with a real photo (or a
  soft colour), browse with arrows, swipe, or the keyboard, and remove ones
  you no longer want.
- **Our Journey**: a live "together for" counter with total days and the
  next anniversary, plus a timeline you can add milestones to.
- **Us**: the couple profile with quick stats, an editable "Our Song" with
  a listening link, editable favourite things, and settings (dark mode that
  follows the device by default, log out).

---

## Folder structure

```
/
├── index.html
├── css/
│   ├── style.css        # design tokens, layout, components
│   └── responsive.css   # tablet/desktop overrides
├── js/
│   ├── config.js        # names, dates, theme — the one file to edit
│   ├── storage.js       # the only file that touches localStorage
│   ├── ui.js            # shared helpers: icons, modals, dates, image resizing
│   ├── auth.js          # demo login/logout
│   ├── router.js        # hash-based client routing
│   ├── chat.js          # chat feature module
│   ├── notes.js         # love notes feature module
│   ├── memories.js      # memories gallery feature module
│   ├── journey.js       # timeline + relationship counter
│   ├── us.js            # couple profile page, pulls journey.js in
│   └── app.js           # bootstraps the app, login screen, theme, toast
```

No build step, no bundler, no framework — open `index.html` and it runs.

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
2. In the repository, go to **Settings → Pages**.
3. Under **Source**, choose the branch (usually `main`) and the root
   folder (`/`).
4. Save. GitHub will publish the site at
   `https://<your-username>.github.io/<repo-name>/`.

No server, no environment variables, no build step are required for
Version 1.

---

## Where configuration lives

Everything you're likely to want to change — the app name, both display
names, the relationship start date, favourite things — lives in one place:
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
- Favourite things and Our Song
- Theme preference (light, dark, or following the device)

Photos added in chat or Memories are resized in the browser before saving
so they fit comfortably within the browser's storage allowance. If storage
does fill up, the app tells you instead of failing silently.

This is demo-only storage: it lives in one browser, on one device, and
isn't shared between the two of you yet. That's expected for Version 1.

---

## How Firebase will replace this later

Because `storage.js` is the single point of contact with persistence, the
plan for Version 2 is to swap its internals — not its shape:

| Now (V1)                     | Later (V2)                          |
|-------------------------------|--------------------------------------|
| `localStorage` via `storage.js` | Firebase Firestore, same function names |
| Demo login in `auth.js`       | Firebase Authentication              |
| Photos saved in the browser   | Firebase Storage for real photos     |

Feature modules (`chat.js`, `notes.js`, etc.) call `Storage.get...()` and
`Storage.set...()` and never localStorage directly, so this swap shouldn't
require rewriting the UI layer.

---

## Security considerations

- Version 1 intentionally has **no real password check**. It's a two-person
  prototype with placeholder demo data, not a production login.
- Nothing in this repository should ever contain real private messages,
  real photos, or real credentials — keep V1 data as demo data only.
- When Firebase is introduced, real protection comes from **Firebase
  Authentication + Firestore Security Rules**, restricting reads and
  writes to exactly the two authorised accounts. A public URL is never a
  substitute for that.
- Firebase config keys (when added) should be treated as public
  identifiers, not secrets — actual access control lives in the security
  rules, not in hiding the config.

---

## Version 2 roadmap (not built yet)

- Firebase Authentication (real accounts for the two of you)
- Firestore for messages, notes, memories, and journey events
- Firebase Storage for photos shared across both devices
- Real-time sync between devices
- Voice messages in chat
- Typing indicators and live online status
- Push notifications (for example when a sealed note opens)
- Shared playlist for "Our Song"
- Deeper relationship stats and memory organisation

Version 1 was built with this roadmap in mind: the separation between
UI, storage, and auth should make each of these an addition, not a
rewrite.
