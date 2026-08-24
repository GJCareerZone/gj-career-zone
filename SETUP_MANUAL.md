# GJ Career Zone — setup manual

Everything here is free. No domain, no server, no paid plan. GitHub Pages
serves the site; Firebase stores the data and handles sign-in.

Budget about 45 minutes for the first run-through.

---

## What you are building

| Piece | Tool | Cost |
|---|---|---|
| Website (HTML/CSS/JS, no build step) | GitHub Pages | Free |
| Sign-in for students, faculty, office | Firebase Authentication | Free |
| Database for all three forms | Cloud Firestore | Free (Spark plan) |
| Access control | Firestore security rules | Free |

The site is plain files. There is nothing to compile, no `npm install`, and
nothing that expires.

---

## Before you start

You need:

1. A **GitHub account** — github.com, free.
2. A **Google account** for the Firebase console.
3. A text editor. VS Code is convenient but Notepad works.
4. Optional but recommended: **Git** installed locally, or just use GitHub's
   web uploader.

---

## Step 1 — Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in.
2. **Add project** → name it `gj-career-zone` → Continue.
3. Google Analytics: **turn it off**. You do not need it, and it keeps the
   privacy story simple for a counselling system.
4. Wait for the project to be created → Continue.

Stay on the **Spark (free) plan**. Do not upgrade. Nothing in this project
needs Blaze.

---

## Step 2 — Register a web app and copy the keys

1. On the project home screen, click the **`</>` (Web)** icon.
2. App nickname: `GJ Career Zone Web`. Do **not** tick "Firebase Hosting" —
   GitHub Pages is doing that job.
3. Register app. Firebase shows a `firebaseConfig = { ... }` block.
4. Open `assets/js/firebase-config.js` in this project and replace every
   `PASTE_...` value with the matching value from that block.

```js
export const firebaseConfig = {
  apiKey: "AIzaSy…",
  authDomain: "gj-career-zone.firebaseapp.com",
  projectId: "gj-career-zone",
  storageBucket: "gj-career-zone.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123"
};
```

**These keys are not secrets.** Every Firebase web app ships them to the
browser; they identify the project, they do not grant access. Access is
decided by the rules in Step 4. Do not skip Step 4.

While you are in this file, correct the `INSTITUTE` block if any contact
detail has changed.

---

## Step 3 — Turn on Authentication

1. Left sidebar → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → Enable the first toggle
   (leave "Email link / passwordless" off) → Save.

That is all. Students self-register; faculty accounts are created by an
admin from inside the app; the first admin is made in Step 6.

---

## Step 4 — Create Firestore and publish the rules

1. Left sidebar → **Build → Firestore Database → Create database**.
2. Choose **Start in production mode** (locked down — correct).
3. Location: `asia-south1 (Mumbai)` for Indian users. **This cannot be
   changed later**, so pick it carefully.
4. Once created, open the **Rules** tab.
5. Delete whatever is there, paste the entire contents of `firestore.rules`
   from this project, and click **Publish**.

Read the comments in that file at least once. In plain terms:

- a student can read and write only their own records;
- a mentor can read only the students assigned to them;
- the office (admin) can see everything;
- the activity log can be appended to but never edited or deleted;
- registration can only ever create a *student*, so nobody can sign
  themselves up as an admin.

Collections are created automatically the first time a document is written.
You do not need to create them by hand.

---

## Step 5 — Put the site on GitHub Pages

### Option A — GitHub web interface (no Git required)

1. GitHub → **New repository** → name it `gj-career-zone` → **Public** →
   Create. (Pages needs the repository to be public on a free account.)
2. On the empty repository page → **uploading an existing file**.
3. Drag in **the contents** of this project folder — `index.html`,
   `student.html`, `faculty.html`, `admin.html`, the `assets` folder, and
   the rest. Upload the *contents*, not the folder itself, so that
   `index.html` sits at the top level of the repository.
4. Commit.
5. Repository **Settings → Pages** → Source: **Deploy from a branch**;
   Branch: `main`, folder `/ (root)` → Save.
6. Wait 1–3 minutes. Your site is live at
   `https://<your-username>.github.io/gj-career-zone/`.

### Option B — Git on your machine

```bash
cd gj-career-zone
git init
git add .
git commit -m "GJ Career Zone counselling platform"
git branch -M main
git remote add origin https://github.com/<your-username>/gj-career-zone.git
git push -u origin main
```

Then do step 5 above (Settings → Pages).

### Then authorise the domain in Firebase

Firebase blocks sign-in from domains it does not know.

**Firebase console → Authentication → Settings → Authorized domains → Add
domain** → `<your-username>.github.io`

Miss this and every sign-in fails with `auth/unauthorized-domain`.

---

## Step 6 — Create the first admin

There is deliberately no "register as admin" button. Make the first one by
hand, once:

1. Open your live site and register as if you were a student, using the
   office email — say `careerzone@gjimt.com`.
2. Firebase console → **Firestore Database → Data → `users`** collection.
3. Find the document whose `email` matches. Its id is the user's uid.
4. Change the `role` field from `student` to `admin`. Save.
5. Back on the site, sign out and sign in again. You land on the office
   dashboard.

Every later admin can be promoted from the app: **Faculty tab → Make
admin**.

Optionally delete the `profilingForms` document for that account if one was
created — the office account is not a real student.

---

## Step 7 — Add your faculty mentors

Sign in as the admin → **Faculty** tab → fill the form → **Create mentor
account**.

You set a temporary password and pass it to the mentor. They sign in with
it and can change it from the sign-in page using **Forgot password?**.

Faculty cannot self-register: the sign-up form only ever creates students,
and the security rules enforce the same thing on the server.

---

## Step 8 — Walk the whole workflow once

Do this before you announce the platform. Use two browsers, or one normal
window and one private window, so you can be two people at once.

1. **Student** registers → fills the profiling form → the office is alerted.
2. **Student** raises a counselling request → the office is alerted.
3. **Admin** → Counselling requests → **Assign a mentor**, pick a faculty
   member, set date, time, mode and room → Assign and notify.
4. **Student** sees the meeting on their dashboard and gets an alert.
5. **Faculty** signs in → Assigned to me → **Record this session** → fills
   the mentor–mentee review → files it.
6. **Student** sees the action plan under Session records.
7. **Admin** sees the review under Mentor reviews, and the whole trail under
   Activity log.

If all seven happen, you are live.

---

## Running it locally while you edit

The pages use JavaScript modules, which browsers refuse to load from
`file://`. Open a tiny local server instead:

```bash
cd gj-career-zone
python3 -m http.server 8000
# then visit http://localhost:8000
```

Add `localhost` to Firebase → Authentication → Settings → Authorized
domains so sign-in works locally too.

---

## What is where

```
gj-career-zone/
├── index.html              sign in + student registration
├── student.html            student dashboard
├── faculty.html            mentor dashboard
├── admin.html              Career Zone office dashboard
├── 404.html
├── firestore.rules         ← publish this in the Firebase console
├── firestore.indexes.json
├── firebase.json           only needed if you use the Firebase CLI
├── assets/
│   ├── css/styles.css
│   ├── img/logo.jpg
│   └── js/
│       ├── firebase-config.js   your project keys + institute details
│       ├── firebase-init.js     starts the SDK
│       ├── auth.js              sign-in, roles, page guards
│       ├── data.js              every read and write to Firestore
│       ├── forms.js             the three forms expressed as data
│       ├── ui.js                shared DOM helpers
│       ├── student.js
│       ├── faculty.js
│       └── admin.js
├── SETUP_MANUAL.md         this file
├── USER_GUIDE.md           one page each for students, mentors, the office
└── README.md
```

---

## Data model

| Collection | Document id | Written by | Holds |
|---|---|---|---|
| `users` | auth uid | self on registration, admin for faculty | name, role, roll no., programme, active flag |
| `profilingForms` | student uid | student | the entire student profiling form — one per student |
| `counsellingRequests` | auto | student, then admin/faculty updates | the request, its stage, assigned mentor, meeting details |
| `mentorForms` | auto | faculty | mentor–mentee review, one per session |
| `notifications` | auto | any signed-in user | in-app alerts, one per recipient per event |
| `auditLogs` | auto | any signed-in user | append-only trail of submissions, assignments, deletions |

A request moves through five stages: `submitted → assigned → scheduled →
reviewed → closed`. That sequence is the strip you see on every card.

Changing a form field means changing three places at most: the HTML input,
the `LABELS` map in `forms.js`, and — if it is a list of options — the
matching array at the top of `forms.js`. Nothing else needs to know.

---

## Free-tier limits, honestly

The Spark plan gives you, per day: 50,000 document reads, 20,000 writes,
20,000 deletes, 1 GiB stored. A college of 1,500 students filing a few forms
each will not come close. The dashboards read whole collections, which is
fine at this size; if you ever cross a few thousand requests, add
pagination to `listAllRequests()`.

Firebase pauses a Spark project only if you exceed quota; it never charges
you without an explicit upgrade.

---

## Backups

There is no automatic backup on the free tier. Two workable habits:

- **Weekly CSV export.** Every admin tab has an *Export CSV* button. Keep
  the files on the department drive. This also gives you the data you need
  for NAAC or AICTE reporting.
- **Manual JSON export** via the Firebase CLI if you install it:
  `firebase firestore:export` requires Blaze, so on the free plan the CSV
  route is the practical one.

---

## Troubleshooting

| What you see | What it means | Fix |
|---|---|---|
| Red bar: "Firebase is not configured yet" | Step 2 not done | Paste your keys into `assets/js/firebase-config.js` |
| `auth/unauthorized-domain` | GitHub Pages domain not authorised | Firebase → Authentication → Settings → Authorized domains |
| `Missing or insufficient permissions` | Rules not published, or the account's `role` is wrong | Re-publish `firestore.rules`; check the `users` document |
| Blank dashboard, console shows a CORS or module error | Opened via `file://` | Serve over `http://localhost:8000` |
| Signed in but bounced back to the sign-in page | No `users` document for that uid | Create one in Firestore with the right `role` |
| Admin creates a mentor and gets logged out | Old copy of `auth.js` | The shipped version uses a second Firebase app instance to avoid this |
| Site shows an old version after a push | GitHub Pages cache | Wait a minute, then hard refresh (Ctrl+Shift+R) |
| "The email address is already in use" | An account exists for that email | Use *Forgot password?*, or delete the user in Firebase → Authentication |

Keep the browser console open (F12) while testing. Firebase errors are
specific and usually name the exact rule that refused you.

---

## If you would rather not use Firebase

| Option | Why you might | Why you might not |
|---|---|---|
| **Firebase** (this build) | Free tier is generous, auth and rules included, zero server | Google-hosted; export is manual on the free plan |
| **Supabase** | Real Postgres, SQL you can teach with, row-level security, free tier, easy CSV/SQL export | Free projects pause after a week of inactivity; you must remember to wake them |
| **Appwrite Cloud** | Open source, similar feature set | Smaller free tier, fewer tutorials |
| **PocketBase** | Single Go binary, SQLite, fully self-hosted | Needs a machine that is always on — an on-campus server would do |
| **Google Sheets + Apps Script** | Familiar to non-programmers | No real access control; unsuitable for confidential counselling records |

For a college project that must stay free, run without maintenance, and
keep counselling notes private, Firebase is the right default. If the
department has a server and you want the data to stay on campus,
PocketBase is the honest alternative — the front end here would need only
its data layer (`assets/js/data.js`) rewritten.

---

## Before real students use it

Counselling records are sensitive. A few things are worth settling on paper
before you switch this on:

1. **Who gets admin.** Keep it to two or three people in the Career Zone
   office. Admins can read every request.
2. **A crisis protocol.** The system is not a helpline. Decide what a
   mentor does when a student's request suggests immediate risk, write it
   down, and put the phone number of the campus counsellor and a national
   helpline on the student dashboard. Add it to the banner in
   `student.js` if you want it always visible.
3. **A retention rule.** Decide how long records are kept — one year past
   graduation is a common choice — and who deletes them.
4. **A consent line.** The request form already carries one. Have your
   institute's wording reviewed and replace it in `student.html` if needed.
5. **Tell students what admins can see.** Being straight about it is what
   makes them use the platform honestly.

---

## Ideas worth adding next

Roughly in order of value for effort:

- **Email alerts.** Sign up for EmailJS (free tier, 200 emails/month) and
  call it from the same places `notify()` is called in `admin.js` and
  `faculty.js`. Students check email more often than a dashboard.
- **Anonymous concern box.** A form that reaches the office without a name
  attached. Some students will only ever use that door.
- **Feedback after each session.** A one-question rating from the student
  once a review is filed, so the office can see which mentoring is working.
- **Slot booking.** Let each mentor publish free slots and have students
  pick one, instead of the office fixing every time by hand.
- **Reports tab.** Counts by area of concern, by programme, by month —
  useful for NAAC criteria and for spotting an exam-stress spike early.
- **PDF export** of a completed form using the browser's own print dialog;
  the print stylesheet is already in `styles.css`.
- **Bulk student import** from a CSV of roll numbers, so first-years arrive
  pre-registered.
- **Hindi and Punjabi labels**, kept in `forms.js` alongside the English
  ones.

---

Questions from a colleague picking this up later are best answered by
`data.js` and `forms.js` — between them they describe the entire system in
about 400 lines.
