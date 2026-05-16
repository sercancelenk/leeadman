<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# Leeadman

**A local-first leadership workspace — teams, people, tasks, notes, goals, feedback, 1:1s, reminders.**

[![Release](https://github.com/sercancelenk/leeadman/actions/workflows/release.yml/badge.svg)](https://github.com/sercancelenk/leeadman/actions/workflows/release.yml)
[![CI](https://github.com/sercancelenk/leeadman/actions/workflows/ci.yml/badge.svg)](https://github.com/sercancelenk/leeadman/actions/workflows/ci.yml)
[![Pages](https://github.com/sercancelenk/leeadman/actions/workflows/pages.yml/badge.svg)](https://github.com/sercancelenk/leeadman/actions/workflows/pages.yml)
[![Latest release](https://img.shields.io/github/v/release/sercancelenk/leeadman?display_name=tag&sort=semver)](https://github.com/sercancelenk/leeadman/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)

</div>

Leeadman is an Electron + React desktop app that helps people leaders run the boring, important parts of their job — 1:1 follow-ups, goal tracking, feedback logs, structured notes for every direct report, and personal to-dos — **without sending any data to a server**. Everything lives on your machine in JSON files under your user folder. No accounts in the cloud, no telemetry.

The same React bundle also deploys to GitHub Pages as a **mobile PWA**, so you can capture quick to-dos from your phone.

---

## What's in the box

| | |
|---|---|
| **Desktop** | Signed + notarized macOS DMG (Apple Silicon & Intel), auto-updates via GitHub Releases. Optional PIN lock at launch. |
| **Mobile** | Installable PWA (Add to Home Screen) deployed automatically to GitHub Pages. Offline-capable. Optimized for the To-dos screen. |
| **Workspaces** | Multi-team, per-team Me / My-leader workspaces, per-person pages with tasks, goals, notes, **feedback** and documents. |
| **1:1 Mode** | A dedicated meeting view per person with a persistent markdown agenda and an archive of past meetings; unchecked action items carry over. |
| **Person Timeline** | Chronological feed of every item attached to a person, grouped by day, filterable by kind. Killer feature for review prep. |
| **Agenda** | Unified Today / This-week view combining reminders + due tasks + personal to-dos, plus an "Overdue" bucket. |
| **⌘K Command Palette** | Fuzzy search across navigation, teams, people, items and to-dos with keyboard navigation. |
| **Markdown everywhere** | Notes, scratchpads, item bodies and 1:1 agendas use GitHub-flavored markdown (checklists, tables, code, links). |
| **Recurring reminders** | Daily / weekly / monthly cadence for any reminder, auto-advances after firing. |
| **Smart to-do lists** | Pin to top, archive, move up/down, mark-all-complete, clear-completed, search, count badges. |

---

## Table of contents

- [Install](#install)
- [Getting started](#getting-started)
- [Concepts](#concepts)
- [Power features](#power-features)
  - [⌘K command palette](#k-command-palette)
  - [Markdown editing](#markdown-editing)
  - [Person Timeline](#person-timeline)
  - [1:1 Mode](#11-mode)
  - [Agenda](#agenda)
  - [Recurring reminders](#recurring-reminders)
  - [Feedback log](#feedback-log)
  - [Smart to-do lists](#smart-to-do-lists)
- [Mobile / PWA](#mobile--pwa)
- [Keyboard & native menus](#keyboard--native-menus)
- [Data, privacy and backups](#data-privacy-and-backups)
- [Auto-updates](#auto-updates)
- [Building from source](#building-from-source)
- [Releasing](#releasing)
- [macOS code signing & notarization](#macos-code-signing--notarization)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Install

### macOS desktop (signed + notarized)

1. Go to the [latest release](https://github.com/sercancelenk/leeadman/releases/latest).
2. Download the right DMG:
   - `Leeadman-<version>-arm64.dmg` — Apple Silicon (M1/M2/M3/M4)
   - `Leeadman-<version>-x64.dmg` — Intel Macs
3. Open the DMG and drag `Leeadman.app` into `Applications`.
4. Launch from Launchpad or Spotlight (⌘ + Space → "Leeadman").

Because the DMG is signed with a **Developer ID Application** certificate **and** notarized by Apple, you will not see any "damaged" or "unidentified developer" warning.

### Mobile (PWA on iOS / Android)

1. On your phone, open `https://sercancelenk.github.io/leeadman/` in **Safari** (iOS) or **Chrome** (Android).
2. **iOS:** tap the **Share** button → **Add to Home Screen**.
   **Android:** tap **⋮** → **Install app**.
3. Launch from the home-screen icon. The app opens full-screen and jumps straight to the To-dos page.

> **Mobile data is separate.** The PWA stores its own data in the phone's `localStorage`. Use *Settings → Export JSON / Import JSON* on the desktop and again on the phone if you need to move data between them. Real cross-device sync is on the roadmap.

### Unsigned local builds

If you build a DMG yourself **without** code signing, macOS quarantines it ("… is damaged"). Bypass once with:

```bash
xattr -dr com.apple.quarantine /Applications/Leeadman.app
```

The official Releases DMG never needs this.

---

## Getting started

1. Launch Leeadman.
2. Click **Create one** under the sign-in card. Pick an email, display name and a password (8+ chars). The account exists **only on this device**.
3. You land on the Home screen. From there you can:
   - Open the auto-created **My first team**.
   - Create new teams from the *Teams* page.
   - Manage personal lists in *To-dos*.
   - See everything due today/this week in *Agenda*.
4. Press <kbd>⌘ K</kbd> (or <kbd>Ctrl K</kbd>) anywhere to jump to people, items or pages instantly.

> Tip: install Leeadman on a second machine and use *Settings → Backup → Export JSON / Import JSON* to move your data.

---

## Concepts

```
Account
└── App data file (JSON)
    └── Teams[]
        ├── Me              (auto-created per team)
        ├── My leader       (auto-created per team)
        └── People[]
            ├── Profile + scratchpad (markdown)
            ├── 1:1 agenda (markdown, archivable)
            └── Items[]
                ├── Task          (due date, reminders)
                ├── Goal          (status, start, deadline)
                ├── Note          (markdown body)
                ├── Feedback      (praise / coaching / concern)
                └── Document      (URL)

Personal
└── To-do lists (pin, archive, search, bulk ops)
```

- **Account** — local user; password is stored as a salted scrypt hash.
- **Team** — a workspace boundary. Mark teams as Active / Paused / Archived and pin favourites.
- **Me** — your personal space inside a team.
- **My leader** — a dedicated workspace for the relationship with your manager.
- **People** — direct reports / peers; each one has a profile, scratchpad, 1:1 agenda and items.
- **Items** — task, goal, note, **feedback**, document. All can carry markdown body and reminders.
- **To-dos** — personal lists, fully decoupled from teams.

The complete data model is in [`src/model.ts`](./src/model.ts).

---

## Power features

### ⌘K command palette

Press <kbd>⌘ K</kbd> (macOS) or <kbd>Ctrl K</kbd> (Windows / Linux) to open a global fuzzy-search palette:

- **Navigate** — Home, Teams, To-dos, Agenda, Profile, Settings.
- **Teams** — jump straight to any team or its People page.
- **People** — every person across every team.
- **Items** — every task / goal / note / feedback / document by title.
- **To-dos** — every personal task.

Arrow keys to move, <kbd>Enter</kbd> to open, <kbd>Esc</kbd> to close.

### Markdown editing

Notes, item bodies, person scratchpads and 1:1 agendas all use **GitHub-flavored markdown** with a Write / Preview toggle:

- Headings, bold/italic, lists, blockquotes, code blocks.
- Checklists (`- [ ]` / `- [x]`).
- Tables, autolinks, strikethrough.
- External links open in your default browser.

### Person Timeline

Every person page has a **Timeline** tab that shows a chronological feed of *every* item attached to that person — tasks, goals, notes, feedback, documents — grouped by day (Today / Yesterday / Friday / …) and filterable by kind. Designed for review prep ("what happened with Alice in Q3?").

### 1:1 Mode

Every person also has a **1:1 Mode** tab with two halves:

1. **Current agenda** — a persistent markdown document seeded with sections (Wins / Blockers / Action items / Notes). Use `- [ ]` for action items.
2. **Past meetings** — when you click **Archive meeting**, the current agenda becomes a dated note (`1:1 · 15 May 2026`) attached to that person, and the agenda resets. Any unchecked action items are carried over into the new agenda automatically.

The archived meetings are regular notes, so they also show up in the Person Timeline.

### Agenda

The `/agenda` page is a global, **unified view** of:

- **Overdue** — anything past its due date / reminder still open.
- **Today** — always shown, even when empty.
- **The next 6 days** — only shown when they have entries.

It mixes team-item reminders + due dates with personal to-do dues, marks each entry with its origin team / person, and lets you mark-complete or jump to its workspace inline.

### Recurring reminders

Any item reminder can be made **daily / weekly / monthly**. When the reminder fires, the next occurrence is computed and assigned automatically — you never have to recreate weekly 1:1 reminders.

### Feedback log

Every person has a dedicated **Feedback log** alongside Tasks/Goals/Notes/Documents. Each entry is tagged with one of:

- **Praise** (green)
- **Coaching** (blue)
- **Concern** (red)

This makes performance-review prep and growth-conversation prep trivial — open the person's Timeline, filter to Feedback, and you have your talking points.

### Smart to-do lists

The `/todos` page scales as your lists grow:

- **Pin to top** — star a list to keep it above the rest.
- **Archive** — hide a list without losing data; toggle "Show archived" to bring them back.
- **Move up / Move down** — re-order pinned and unpinned groups independently.
- **Mark all complete** / **Clear completed** — bulk operations with confirmations.
- **Search** — filter tasks across all lists in real time.
- **Inline rename** — click the list title to edit.
- **Counts** — every list shows `<open> / <total>` at a glance.

---

## Mobile / PWA

Leeadman ships as a **Progressive Web App** in addition to the desktop Electron build. The same React bundle is deployed to GitHub Pages and installable on iOS/Android.

### Setup (repository owner — one-time)

1. **Settings → Pages → Source: GitHub Actions**.
2. Push to `main`. The [`pages.yml`](.github/workflows/pages.yml) workflow runs, builds with `LEEADMAN_PWA=1`, and publishes to `https://<user>.github.io/leeadman/`.

### Install on your phone

1. Open the URL above in Safari (iOS) or Chrome (Android).
2. **Share → Add to Home Screen** / **⋮ → Install app**.
3. The app installs with its own icon and launches full-screen, going straight to the To-dos page.

### What works offline

- The app shell (HTML / CSS / JS / icons) is cached on first visit.
- All your data lives in the phone's `localStorage`, so reads and edits work fully offline.
- New deploys are picked up silently the next time the device is online (service worker uses *network-first* for navigation, *stale-while-revalidate* for hashed assets).

### Building the PWA locally

```bash
# Regenerate icons after editing public/icon.svg
npm run icons

# Build for GitHub Pages (sets base path to /leeadman/)
npm run build:pwa
```

### Mobile-specific UX

- Phones with ≤640 px width get tighter spacing, 40 px touch targets, full-screen command palette, and a single-column to-do row layout.
- Launching from the home-screen shortcut auto-redirects `/` → `/todos` (the primary mobile use-case).
- iOS safe-area padding is honoured (status bar / home indicator).

### Files added for PWA support

```
public/
  manifest.webmanifest      # PWA metadata
  sw.js                     # Service worker (offline cache, auto-update)
  icon.svg                  # Source vector logo
  icon-192.png              # Manifest icon (any)
  icon-512.png              # Manifest icon (any) + splash
  icon-maskable-512.png     # Adaptive icon for Android (safe-zone padded)
  apple-touch-icon.png      # 180×180 iOS home-screen icon
  favicon-32.png            # Browser tab icon
scripts/
  generate-pwa-icons.mjs    # sharp-powered icon rasteriser
src/pwa.ts                  # SW registration (skipped under Electron/file://)
.github/workflows/pages.yml # Automated Pages deploy
```

---

## Keyboard & native menus

Leeadman ships with a native menu bar (English):

- **Leeadman** — About, Check for Updates…, Quit
- **File** — Close window / Quit
- **Edit** — Undo / Redo / Cut / Copy / Paste / Select All
- **View** — Reload, Zoom, Toggle Full Screen
- **Window** — Minimize, Zoom
- **Help** — Project on GitHub, Report an Issue

Standard shortcuts apply (⌘ Q, ⌘ W, ⌘ R, ⌘ F, ⌘ , …). The global **⌘ K** opens the command palette from anywhere.

---

## Data, privacy and backups

- **Where data lives** (macOS): `~/Library/Application Support/Leeadman/`
  - `leeadman-accounts.json` — user list (emails + salted scrypt hashes).
  - `leeadman-session.json` — id of the signed-in user.
  - `leeadman-data-<userId>.json` — your workspace data, per account.
  - `auth-lock.json` — optional PIN hash.
- **Mobile PWA**: data lives in the browser's `localStorage` for the Pages origin.
- **No telemetry, no analytics, no remote sync.**
- **PIN protection** is a launch-time barrier; it does **not** encrypt the data file. For real privacy enable full-disk encryption (macOS FileVault, Windows BitLocker, Linux LUKS).
- **Backups**: use *Settings → Backup → Export JSON* periodically. The file is plain JSON, easy to diff and migrate. Use *Import JSON* to restore — it replaces your current data.

---

## Auto-updates

The packaged desktop app checks GitHub Releases on launch via [`electron-updater`](https://www.electron.build/auto-update). When a new version is published, it is downloaded in the background and applied on next quit (or via *Leeadman → Check for Updates…*). Development builds (`npm run dev`) skip the check.

The PWA "updates" itself silently via the service worker — the next time the device is online and you reopen the app, the new build is fetched and applied on the following navigation.

---

## Building from source

### Requirements

- Node.js 20+
- npm 10+
- macOS 12+ (only for producing a macOS DMG)

### Install

```bash
git clone https://github.com/sercancelenk/leeadman.git
cd leeadman
npm install
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts Vite at `http://localhost:5173` and launches Electron pointed at it with hot reload. |
| `npm run build:web` | Builds the Electron-targeted React bundle (`base: ./`) into `dist/`. |
| `npm run build:pwa` | Builds the GitHub-Pages-targeted PWA bundle (`base: /leeadman/`) into `dist/`. |
| `npm run build` | `build:web` + `electron-builder` (local desktop bundle). |
| `npm run build:release` | `build:web` + `electron-builder --publish always` (used by the release workflow). |
| `npm run icons` | Regenerates PWA icons from `public/icon.svg` (uses `sharp`). |
| `npm run preview` | Vite preview server for the last build. |

### Local DMG without Apple credentials

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build
```

---

## Releasing

A push to `main` (or a manual *Release* workflow run) triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml):

1. Sets the version to `0.2.<run_number>`.
2. Runs `vite build` → `electron-builder --publish always`.
3. Signs `.app` with the Developer ID Application certificate.
4. Notarizes with Apple's `notarytool`, then staples the ticket onto the `.app`.
5. Publishes the signed/notarized DMG + ZIP to a new GitHub Release.

The Pages workflow ([`pages.yml`](.github/workflows/pages.yml)) runs independently on the same push and publishes the PWA.

Required repository permissions: **Settings → Actions → General → Workflow permissions = Read and write**.

---

## macOS code signing & notarization

For DMGs to open without the "… is damaged and can't be opened" Gatekeeper error on someone else's Mac, the build **must** be:

1. Signed with a **Developer ID Application** certificate from a paid Apple Developer Program account, and
2. Notarized by Apple's `notarytool` service.

This repo's release workflow does both automatically. You only need to set up the secrets once.

### 1. Create a Developer ID Application certificate

1. In **Keychain Access**, open *Certificate Assistant → Request a Certificate From a Certificate Authority…*. Save the CSR to disk.
2. In [developer.apple.com → Certificates](https://developer.apple.com/account/resources/certificates/list), click **+**, choose **Developer ID Application** under *Software*, then *G2 Sub-CA (Xcode 11.4.1 or later)*.
3. Upload the CSR, download the resulting `.cer`, and double-click to install it into the **login** keychain.
4. In *Keychain Access → My Certificates*, verify that "Developer ID Application: \<Your Name\> (\<TEAM\_ID\>)" appears with a private key under it.

### 2. Export the certificate as `.p12`

1. Right-click the certificate → **Export…** → format **Personal Information Exchange (.p12)**.
2. Set a strong export password (this becomes `CSC_KEY_PASSWORD` below).
3. Save as `developer-id.p12`.

### 3. Create an App-Specific Password

1. Go to <https://appleid.apple.com>.
2. *Sign-In and Security → App-Specific Passwords → +*.
3. Save the generated `xxxx-xxxx-xxxx-xxxx` password.

### 4. Add GitHub repository secrets

In **Settings → Secrets and variables → Actions**, add:

| Secret name                   | Value                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| `CSC_LINK`                    | base64 of `developer-id.p12` — `base64 -i developer-id.p12 \| pbcopy` |
| `CSC_KEY_PASSWORD`            | `.p12` export password                                                |
| `APPLE_ID`                    | Apple Developer account email                                         |
| `APPLE_APP_SPECIFIC_PASSWORD` | the `xxxx-xxxx-xxxx-xxxx` password                                    |
| `APPLE_TEAM_ID`               | 10-character Team ID (e.g. `ME5ER9CA9Q`)                              |

The Team ID is also configured in `package.json` under `build.mac.notarize.teamId` — update it there if you fork this project.

### 5. Verify locally

After installing a signed build:

```bash
codesign -dv --verbose=4 /Applications/Leeadman.app
spctl -a -t exec -vv /Applications/Leeadman.app
xcrun stapler validate /Applications/Leeadman.app
```

`spctl` should respond with `accepted source=Notarized Developer ID`. If it does, every user can install your DMG without any warning.

### Entitlements

The signed binary uses the entitlements at [`build/entitlements.mac.plist`](./build/entitlements.mac.plist):

- `com.apple.security.cs.allow-jit` — required by V8 in Electron.
- `com.apple.security.cs.allow-unsigned-executable-memory` — JIT support.
- `com.apple.security.cs.disable-library-validation` — load Electron framework dylibs.
- `com.apple.security.cs.allow-dyld-environment-variables` — used by Electron's bootstrap.
- `com.apple.security.network.client` / `server` — outbound update checks and IPC.

---

## Project structure

```
.
├── electron/
│   ├── main.cjs                    # Main process: window, menu, IPC, auth, CSP, updater
│   └── preload.cjs                 # contextBridge surface exposed as window.leeadman
├── src/
│   ├── App.tsx                     # Router + protected shells, PWA-launch redirect
│   ├── main.tsx                    # React entry; StrictMode + ErrorBoundary + SW
│   ├── pwa.ts                      # Service-worker registration (web build only)
│   ├── AccountContext.tsx          # Account sign-in/up state
│   ├── AuthContext.tsx             # PIN lock state
│   ├── AppDataContext.tsx          # Workspace data, debounce-save, reminder watcher
│   ├── ThemeContext.tsx            # Dark / light theme
│   ├── actions.ts                  # Pure reducers operating on AppData
│   ├── model.ts                    # Domain types + migrations + normalization
│   ├── components/
│   │   ├── AppSidebar.tsx
│   │   ├── CommandPalette.tsx      # ⌘K palette
│   │   ├── ErrorBoundary.tsx
│   │   ├── Layout.tsx / TeamLayout.tsx / TopBar.tsx
│   │   ├── icons.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       └── MarkdownEditor.tsx  # GFM markdown editor + viewer
│   ├── lib/                        # Pure helpers (datetime, routes, sorting, categories…)
│   └── views/
│       ├── HomePage.tsx
│       ├── HomeTeams.tsx
│       ├── TodosPage.tsx           # Smart to-do lists (pin, archive, bulk ops, search)
│       ├── AgendaPage.tsx          # Today / This-week unified agenda
│       ├── People.tsx              # Person workspace + Timeline + 1:1 Mode tabs
│       ├── ProfilePage.tsx / Settings.tsx
│       └── LoginPage.tsx / RegisterPage.tsx
├── public/                         # PWA static assets (manifest, sw.js, icons)
├── build/
│   └── entitlements.mac.plist
├── scripts/
│   ├── generate-pwa-icons.mjs      # sharp-powered icon rasteriser
│   └── patch-publish.mjs           # Rewrites build.publish.owner at build time
├── .github/workflows/
│   ├── ci.yml
│   ├── release.yml                 # macOS signed + notarized release pipeline
│   └── pages.yml                   # PWA → GitHub Pages
├── vite.config.ts                  # Env-aware base path (Electron vs Pages)
├── package.json
└── README.md
```

---

## Troubleshooting

<details>
<summary><strong>macOS says "Leeadman.app is damaged and can't be opened"</strong></summary>

For official releases this should not happen — they are signed + notarized. If it does, the file was likely tampered with in transit; download again from the [releases page](https://github.com/sercancelenk/leeadman/releases). For DIY (unsigned) builds, run:

```bash
xattr -dr com.apple.quarantine /Applications/Leeadman.app
```

</details>

<details>
<summary><strong>The app opens but the window is blank</strong></summary>

That usually means the renderer crashed before painting. The ErrorBoundary should display the stack trace; please file an issue with that text. In development you can open DevTools with <kbd>⌘ ⌥ I</kbd>.

</details>

<details>
<summary><strong>"Update check failed: net::ERR_NAME_NOT_RESOLVED"</strong></summary>

You're offline or behind a captive portal. Auto-update will retry on next launch; nothing to fix.

</details>

<details>
<summary><strong>The PWA shows a stale build after I deployed a new one</strong></summary>

The service worker uses network-first for navigation, so a second visit when online should fetch the new shell. If you want to force-refresh: from the installed PWA, pull-to-refresh or close-and-reopen the app. From a browser, hard-refresh and clear site data once.

</details>

<details>
<summary><strong>I forgot my account password</strong></summary>

Passwords are not recoverable (they're stored as salted scrypt hashes locally). You can edit `leeadman-accounts.json` in `~/Library/Application Support/Leeadman/` and remove the user entry, then sign up again. Your workspace JSON file is named `leeadman-data-<userId>.json` — keep it if you want to import it into the new account.

</details>

---

## Roadmap

### ✅ Tier 1 — shipped

| # | Feature |
|---|---|
| 1.1 | Markdown editor for notes, scratchpads, item bodies and 1:1 agendas |
| 1.2 | Feedback log (praise / coaching / concern item kind) |
| 1.3 | Recurring reminders (daily / weekly / monthly cadence) |
| 1.4 | Person Timeline — chronological feed per person, filterable by kind |
| 1.5 | Today / This-week unified Agenda page |
| 1.6 | 1:1 Mode — persistent agenda + archive + carry-over |
| 1.7 | ⌘K command palette + global search |
| 1.8 | Smart to-do list management (pin, archive, move, bulk ops, search) |
| 1.9 | Mobile PWA build + GitHub Pages deploy |

### Tier 2 — next

| # | Feature | Why it matters |
|---|---|---|
| 2.1 | Cycle / Quarter scope for goals + progress % | OKR support: parent/child (Objective → Key Result), quarter tagging, progress with history. |
| 2.2 | Templates (1:1, skip-level, perf review, onboarding) | Apply a template to a new note/meeting and get a structured outline instantly. |
| 2.3 | Person attributes | Start date, timezone, location, level, manager (dotted-line), pronouns, skills. Auto-computed tenure. |
| 2.4 | iCal (`.ics`) export | Read-only feed so macOS Calendar / Google Calendar can subscribe. |
| 2.5 | Encrypted vault | Optional passphrase-derived AES-GCM encryption for the data file. |
| 2.6 | Real cross-device sync | iCloud Drive / Dropbox folder, or a small LAN server inside Electron, so the mobile PWA shares the desktop's data. |

### Tier 3 — nice to have

| # | Feature |
|---|---|
| 3.1 | Cadence heatmap (1:1 / feedback frequency per person, 12-week strip) |
| 3.2 | Tags + saved filter views (`#growth`, `#blocker`, "All overdue tasks") |
| 3.3 | Decisions log (team-level ADRs) |
| 3.4 | Kanban view for tasks (Today / This week / Later / Done) |
| 3.5 | Watch-folder mode — write notes as real `.md` files for Obsidian compatibility |
| 3.6 | Bulk operations on items (multi-select → mass reschedule / move / delete) |
| 3.7 | Charts & metrics (tasks closed per week, goal progress over time) |
| 3.8 | Drag-and-drop reordering for to-do lists (replaces current move-up/down) |

### Long-term

- Per-person reminders with timezone-aware scheduling
- Windows MSI + Linux AppImage signed builds
- i18n framework (English is the primary language; community translations welcome)

---

## Contributing

Issues and pull requests are welcome. Please:

1. Use Node 20+, install with `npm install`, and run `npm run dev`.
2. Keep all UI strings in English (no in-code i18n yet).
3. Before sending a PR, run:
   - `npx tsc --noEmit` — strict type-check.
   - `npm run build:web` — Electron-targeted Vite build.
   - `npm run build:pwa` — Pages-targeted Vite build.

---

## License

MIT © Sercan Çelenk

See [LICENSE](./LICENSE) if present, otherwise refer to the [MIT License](https://opensource.org/licenses/MIT).
