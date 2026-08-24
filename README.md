# GJ Career Zone

An online counselling desk for Gian Jyoti Institute of Management and
Technology. Students raise a request, the Career Zone office assigns a
faculty mentor and fixes a slot, the mentor files a review after the
session — and every one of those steps stays on record.

Static site on GitHub Pages, Cloud Firestore behind it. No build step, no
server, no paid plan.

---

## The three forms

| Form | Filled by | When | Goes to |
|---|---|---|---|
| Student profiling form | Student | Once, after registering | Career Zone office |
| Counselling request | Student | Whenever they need to talk | Career Zone office |
| Mentor–mentee review | Faculty mentor | After each session | Office and the student |

Every request moves through five stages, shown on every card:

`Submitted → Assigned → Scheduled → Reviewed → Closed`

## Who can do what

| | Student | Faculty mentor | Office (admin) |
|---|---|---|---|
| Register themselves | Yes | No — created by the office | No — promoted once, in the console |
| Profiling form | Fill and update their own | Read, for students assigned to them | Read all, delete |
| Counselling request | Raise any number, track their own | Read the ones assigned to them | Read all, assign, schedule, close, delete |
| Mentor review | Read their own | File and read their own | Read all, delete |
| Faculty accounts | — | — | Create, deactivate, promote |
| Activity log | — | — | Read (nobody can edit it) |

## Getting it running

Follow **[SETUP_MANUAL.md](SETUP_MANUAL.md)** — Firebase project, security
rules, GitHub Pages, first admin. About 45 minutes.

Day-to-day instructions for each role are in
**[USER_GUIDE.md](USER_GUIDE.md)**.

## Stack

- Vanilla HTML, CSS and ES modules — nothing to compile, nothing to update
- Firebase Authentication (email and password)
- Cloud Firestore, with access enforced by `firestore.rules`
- GitHub Pages for hosting

## Local development

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

ES modules will not load over `file://`, so a local server is required.

## Editing the forms

`assets/js/forms.js` holds every option list, every field label and the
renderers for the repeated controls. Change an option there and it changes
in the form, in the admin view and in the CSV export at once.

`assets/js/data.js` holds every read and write to Firestore. If you ever
move off Firebase, that one file is what you rewrite.

## Licence

MIT. The GJIMT name, logo and NAAC mark are not covered by it.
