# ❤️ Our Space — Version 1

A private, mobile-first web app for two: a WhatsApp-style chat, love notes,
a memories gallery, and a relationship timeline, wrapped in one warm, quiet
space that belongs only to the two of you.

This is **Version 1** — a fully working frontend prototype with demo data.
There is no real backend yet; everything is stored locally in your browser
so the experience can be built and refined before Firebase is wired in.

---

## What's here

- **Chat**: day separators, emoji picker, photos from the gallery or camera
  (an in-app camera on laptops), voice notes up to two minutes with a
  waveform player and 1x/1.5x/2x speed, double tap to heart, swipe a message
  to reply to it, real read receipts, and "online / last seen".
- **Thinking of you**: one tap sends a heartbeat that fills the other
  person's screen when they have the app open.
- **Love Notes**: letters readable right away, sealed "open when…" notes,
  or notes sealed until a date.
- **Memories**: Polaroids with real photos, plus "On this day" when
  something happened on this date in an earlier year.
- **Together**: three keepsake rituals built in 3D.
  - *Love jar*: a glass jar of folded slips. Add reasons you love each other;
    "Pick one" shakes the jar and a slip from the other person unfolds.
    Unread slips come first.
  - *Time capsules*: ribbon-wrapped boxes on a shelf, sealed with wax until
    the day you choose. On the day, the lid swings open and the letter rises.
  - *Shared lists*: index cards for a bucket list, date ideas, films and
    more, with live updates, an inked strike-through and a burst of hearts.
- **3D details**: Polaroids, letters and envelopes tilt toward your mouse or
  finger with a soft sheen (off when reduced motion is on).
- **Chat wallpaper**: eight designs (Paper, Letter, Linen, Hearts, Pressed
  flowers, Night sky, Watercolour, Postmarks) or your own photo with dim and
  blur. Each phone picks its own, or "Set for both of us".
- **Us**: the "together for" counter, a shared countdown to your next time
  together (also shown in chat), your timeline, Our Song and favourite things.
  Tap the date at the top to change when it all began; it updates for both
  of you.
- **Profile photos**: set yours from Settings or the Us page with a
  circular cropper (drag and pinch to frame it). It shows everywhere: chat,
  sidebar, sign-in, Settings and side by side on the Us page.
- **Little comforts**: unread badge on the Chat tab (and the Home Screen
  icon where iOS allows), press and hold a message to reply, heart, copy or
  delete it, a jump-to-latest button, offline and "new version ready"
  banners, and "Show earlier messages" for long histories.
- **Passcode lock**: an optional 4-digit code per phone, asked on opening
  and after a minute away. The app switcher shows only a wax seal.
- **iPhone app**: add it to your Home Screen for a proper icon, launch
  screen, full-screen layout and offline opening.

Everything runs on Firebase's free Spark plan. Nothing here needs a card.

---

## Folder structure

```
/
├── index.html
├── firestore.rules      # database security rules (paste into Firebase)
├── manifest.webmanifest # Home Screen app details
├── sw.js                # offline support (bump VERSION when shipping)
├── assets/icons, splash # app icon, wax seal, iPhone launch screens
├── css/
│   ├── style.css        # design tokens, layout, components
│   └── responsive.css   # tablet/desktop overrides
├── js/
│   ├── config.js        # names, dates, theme — the one file to edit
│   ├── storage.js       # the only file that touches localStorage
│   ├── ui.js            # shared helpers: icons, modals, dates, image resizing
│   ├── media.js         # photo/voice store: safe, lazy, cached
│   ├── avatars.js       # profile photos and the cropper
│   ├── cloud.js         # Firebase sign-in, live sync and presence
│   ├── auth.js          # demo login/logout
│   ├── router.js        # hash-based client routing
│   ├── lock.js          # optional passcode lock
│   ├── countdown.js     # "next time together" countdown
│   ├── wallpaper.js     # chat wallpapers and picker
│   ├── voice.js         # voice note recording and playback
│   ├── camera.js        # in-app camera for laptops
│   ├── chat.js          # chat feature module
│   ├── notes.js         # love notes feature module
│   ├── memories.js      # memories gallery feature module
│   ├── journey.js       # timeline + relationship counter
│   ├── together.js      # love jar, time capsules, shared lists
│   ├── tilt.js          # 3D tilt + sheen for paper objects
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

## Connecting Firebase (so you both see the same space)

The app has two modes and switches automatically:

- **Demo mode** (default): everything is saved in this one browser.
- **Shared mode**: as soon as Firebase details are added to `js/config.js`,
  you each sign in with your own password and everything syncs live
  between your devices: chat (with real read receipts and "online / last
  seen"), notes, memories, milestones, your song and favourite things.

Everything stays on Firebase's free Spark plan. Photos are stored inside
the database (resized to well under 1 MB each), so you don't need Firebase
Storage or a billing account.

### One-time setup (about 10 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com),
   click **Create a project**, give it any name, and skip Google Analytics.
2. **Add a web app**: on the project home page click the **</>** icon, give
   it a nickname, and register it (no hosting needed). Copy the
   `firebaseConfig` values it shows.
3. **Turn on sign-in**: *Build → Authentication → Get started →
   Email/Password → Enable → Save*.
4. **Create your two accounts**: *Authentication → Users → Add user*. Add
   one for each of you with an email and a password you'll remember.
5. **Create the database**: *Build → Firestore Database → Create database*.
   Pick a location close to you and start in **production mode**.
6. **Lock it to the two of you**: copy `firestore.rules` from this repo,
   replace the two placeholder emails with your real ones (lowercase),
   then paste it into *Firestore → Rules* and click **Publish**.
7. **Allow your website**: *Authentication → Settings → Authorized domains
   → Add domain*, and add your site's domain (for GitHub Pages that's
   `<your-username>.github.io`).
8. In `js/config.js`, paste the values from step 2 into `firebase: { ... }`.
   Under `users`, set each person's `emailHash`: the SHA-256 of their
   login email in lowercase. Only this fingerprint goes in the code, so
   your emails never appear in the public repository. To make one, run
   `printf '%s' 'you@example.com' | shasum -a 256` (macOS/Linux).

Sign in with your email and password; your phone can remember both.
Keep the real emails in `firestore.rules` only inside the Firebase
console, not in the copy committed here.

Publish, open the site on both phones, and sign in. Your shared space
starts empty and fresh; the demo content never gets copied across.

### Where things live in Firestore

```
spaces/us/messages/{id}
spaces/us/notes/{id}
spaces/us/memories/{id}
spaces/us/journey/{id}
spaces/us/jar/{id}
spaces/us/capsules/{id}
spaces/us/lists/{id}
spaces/us/listItems/{id}
spaces/us/meta/favourites
spaces/us/media/{id}       photos and voice notes, fetched only when needed
spaces/us/meta/avatars     profile photos (small)
spaces/us/meta/song
spaces/us/meta/countdown
spaces/us/meta/profile
spaces/us/meta/wallpaper
spaces/us/meta/presence
```

`js/storage.js` is still the only file feature modules talk to. In shared
mode it keeps a live in-memory copy that `js/cloud.js` fills from Firestore
listeners, so reads stay instant and writes sync in the background. The
offline cache means the app opens quickly and keeps working with no signal,
syncing again when you're back online.

---

## Security considerations

- `firestore.rules` lets only your two accounts in, and each of you can
  only write in your own name. You can't create a message, note, reason or
  capsule as the other person, change what they wrote, change a sealed
  capsule's date, or change their profile photo or "last seen". Their items
  only accept the small things you're meant to change (read receipts,
  hearts, "opened", "read"). The rules are covered by 49 emulator tests.
- Photos and voice notes are only ever displayed if they're genuine
  image/audio data, so a tampered database value can't inject code.
- In the Firebase console it's worth also turning off new sign-ups
  (Authentication > Settings > User actions) and restricting the API key to
  your website (Google Cloud console > Credentials).

- Demo mode has **no real password check**; it's for trying the app on one
  device. Shared mode uses real Firebase Authentication passwords.
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

- Voice messages in chat
- Typing indicators
- Push notifications (for example when a sealed note opens)
- Shared playlist for "Our Song"
- Deeper relationship stats and memory organisation

Version 1 was built with this roadmap in mind: the separation between
UI, storage, and auth should make each of these an addition, not a
rewrite.
