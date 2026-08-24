import { requireRole, logout } from "./auth.js";
import { INSTITUTE } from "./firebase-config.js";
import {
  $, $$, esc, toast, busy, collectForm, fillForm, wireTabs, renderAppbar,
  spine, fmtDate, fmtDateTime, ago, empty, dump, openModal
} from "./ui.js";
import { hydrateControls, LABELS, STATUS_META, actionPlanView } from "./forms.js";
import {
  saveProfilingForm, getProfilingForm, createCounsellingRequest, listRequestsByStudent,
  listMentorForms, listNotifications, markNotificationRead, markAllNotificationsRead,
  notify, audit, listUsers, updateUser
} from "./data.js";

const profile = await requireRole("student");
let showTab;
let myProfilingForm = null;
let myRequests = [];

renderAppbar($("#appbar"), profile, { onSignOut: logout });
hydrateControls(document);
showTab = wireTabs();
$("#bellBtn").addEventListener("click", () => showTab("alerts"));
$("#crisisNote").textContent = INSTITUTE.crisisNote || "";

/* ---------------- profiling form ---------------- */
const profilingForm = $("#profilingForm");

async function loadProfilingForm() {
  myProfilingForm = await getProfilingForm(profile.uid);
  if (myProfilingForm) {
    fillForm(profilingForm, myProfilingForm);
    $("#profileStatusChip").textContent = `Submitted ${fmtDate(myProfilingForm.updatedAt)}`;
    $("#profileStatusChip").className = "chip ok";
  } else {
    fillForm(profilingForm, {
      name: profile.name, email: profile.email, phone: profile.phone,
      yearSem: profile.yearSem, courseBatch: profile.programme
    });
  }
  togglePlacementReason();
  renderRequestGate();
}

function togglePlacementReason() {
  const picked = profilingForm.querySelector("input[name=placementConsent]:checked");
  $("#noPlacementWrap").hidden = !picked || picked.value !== "I will arrange my own placement";
}

profilingForm.addEventListener("change", (e) => {
  if (e.target.name === "placementConsent") togglePlacementReason();
});

profilingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  busy(btn, true);
  try {
    const data = collectForm(profilingForm);
    const first = !myProfilingForm;
    await saveProfilingForm(profile.uid, data);
    await updateUser(profile.uid, { profileComplete: true, name: data.name, phone: data.phone });
    const admins = await listUsers("admin");
    await Promise.all(admins.map((a) => notify(a.uid, {
      title: first ? "New profiling form" : "Profiling form updated",
      message: `${data.name} (${profile.rollNo || "roll no. not set"}) ${first ? "submitted" : "updated"} the student profiling form.`,
      link: "admin.html#profiles"
    })));
    audit(profile, first ? "submit" : "update", "profilingForm", profile.uid);
    toast(first ? "Profiling form sent to the Career Zone office." : "Profiling form updated.", "ok");
    await loadProfilingForm();
    if (first) showTab("request");
  } catch (err) {
    console.error(err);
    toast("Could not save the form. Check your connection and try again.", "err");
  } finally {
    busy(btn, false);
  }
});

$("#printProfile").addEventListener("click", () => window.print());

/* ---------------- counselling request ---------------- */
function renderRequestGate() {
  const gate = $("#requestGate");
  const card = $("#requestCard");
  if (myProfilingForm) {
    gate.classList.add("hidden");
    card.classList.remove("hidden");
  } else {
    gate.classList.remove("hidden");
    card.classList.add("hidden");
    gate.innerHTML = `<div class="banner warn">
      <h3>Fill the profiling form first</h3>
      <p>The Career Zone office needs your profile on file before it can act on a counselling request.
         It takes about five minutes and you only do it once.</p>
      <p style="margin-top:.8rem"><button class="btn small" id="goProfile" type="button">Open the profiling form</button></p>
    </div>`;
    $("#goProfile").addEventListener("click", () => showTab("profile"));
  }
}

$("#counsellingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector("button[type=submit]");
  const data = collectForm(form);
  if (!data.areas.length && !data.otherArea) {
    toast("Pick at least one area, or describe it under “Something not on the list”.", "err");
    return;
  }
  busy(btn, true, "Sending…");
  try {
    data.consent = true;
    const created = await createCounsellingRequest(profile, data);
    const admins = await listUsers("admin");
    await Promise.all(admins.map((a) => notify(a.uid, {
      title: data.urgency.startsWith("Immediately") ? "Urgent counselling request" : "New counselling request",
      message: `${profile.name} raised request ${created.requestId}.`,
      link: "admin.html#requests",
      kind: data.urgency.startsWith("Immediately") ? "urgent" : "info"
    })));
    audit(profile, "submit", "counsellingRequest", created.id, created.requestId);
    form.reset();
    toast(`Request ${created.requestId} sent. You will be notified once a mentor is assigned.`, "ok");
    await loadRequests();
    showTab("records");
  } catch (err) {
    console.error(err);
    toast("Could not send the request. Try again in a moment.", "err");
  } finally {
    busy(btn, false);
  }
});

/* ---------------- my requests ---------------- */
function requestCard(r) {
  const meta = STATUS_META[r.status] || STATUS_META.submitted;
  const detail = {
    submitted: fmtDate(r.createdAt),
    assigned: r.assignedFacultyName || "",
    scheduled: r.meetingAt ? fmtDateTime(r.meetingAt) : "",
    reviewed: r.reviewedAt ? fmtDate(r.reviewedAt) : "",
    closed: r.closedAt ? fmtDate(r.closedAt) : ""
  };
  return `<article class="record">
    <div class="record-top">
      <span class="id">${esc(r.requestId)}</span>
      <span class="name">${esc((r.areas || []).slice(0, 2).join(", ") || r.otherArea || "Counselling request")}</span>
      <div class="spacer"></div>
      <span class="chip ${meta.chip}">${esc(meta.label)}</span>
      ${r.priority === "immediate" ? '<span class="chip urgent">Urgent</span>' : ""}
    </div>
    ${spine(r.status, detail)}
    <p class="meta">${esc(r.description || "")}</p>
    ${r.assignedFacultyName ? `<p class="meta"><strong>Mentor:</strong> ${esc(r.assignedFacultyName)}</p>` : ""}
    ${r.meetingAt ? `<p class="meta"><strong>Meeting:</strong> ${esc(fmtDateTime(r.meetingAt))} · ${esc(r.meetingMode || "")} ${r.meetingVenue ? "· " + esc(r.meetingVenue) : ""}</p>` : ""}
    ${r.studentMessage ? `<p class="meta"><strong>Note from the office:</strong> ${esc(r.studentMessage)}</p>` : ""}
    <div class="actions"><button class="btn ghost small" data-view="${esc(r.id)}" type="button">View full request</button></div>
  </article>`;
}

async function loadRequests() {
  myRequests = await listRequestsByStudent(profile.uid);
  renderRequests();
  renderOverview();
}

function renderRequests() {
  const filter = $("#recordFilter").value;
  const list = filter ? myRequests.filter((r) => r.status === filter) : myRequests;
  const host = $("#requestList");
  host.className = "";
  host.innerHTML = list.length
    ? list.map(requestCard).join("")
    : empty("Nothing here yet", "Requests you raise will be listed here with their current stage.");
  $$("[data-view]", host).forEach((b) =>
    b.addEventListener("click", () => {
      const r = myRequests.find((x) => x.id === b.dataset.view);
      openModal(`<span class="eyebrow">${esc(r.requestId)}</span><h2>Counselling request</h2>
        ${dump(r, LABELS, ["studentName", "rollNo", "programme", "yearSem", "priority", "assignedFacultyId", "status"])}
        <div class="modal-actions"><button class="btn neutral" data-close type="button">Close</button></div>`);
    })
  );
}

$("#recordFilter").addEventListener("change", renderRequests);

/* ---------------- session records ---------------- */
async function loadSessions() {
  const forms = await listMentorForms({ studentId: profile.uid });
  const host = $("#sessionList");
  host.className = "";
  if (!forms.length) {
    host.innerHTML = empty("No sessions recorded yet", "After a counselling meeting, your mentor files a short review here.");
    return;
  }
  host.innerHTML = forms.map((f) => `<article class="record">
    <div class="record-top">
      <span class="id">${esc(f.requestId || "session")}</span>
      <span class="name">Review on ${esc(fmtDate(f.reviewDate || f.createdAt))}</span>
      <div class="spacer"></div>
      <span class="chip">${esc(f.mentorName || "")}</span>
    </div>
    <p class="meta"><strong>Issues reviewed:</strong> ${(f.issues || []).map((i) => `<span class="tag">${esc(i)}</span>`).join("") || "—"}</p>
    <p class="meta"><strong>Status of the issue:</strong> ${esc(f.issueStatus || "—")}</p>
    ${f.fbSupportNeeded ? `<p class="meta"><strong>Support you asked for:</strong> ${esc(f.fbSupportNeeded)}</p>` : ""}
    <div style="margin-top:.7rem">${actionPlanView(f.actionPlan)}</div>
    <p class="meta"><strong>Next review:</strong> ${esc(f.nextReviewDate ? fmtDate(f.nextReviewDate) : "to be decided")}
       ${f.decision ? `· <strong>Decision:</strong> ${esc(f.decision)}` : ""}</p>
  </article>`).join("");
}

/* ---------------- alerts ---------------- */
async function loadAlerts() {
  const list = await listNotifications(profile.uid);
  const unread = list.filter((n) => !n.read).length;
  const count = $("#bellCount");
  count.textContent = unread;
  count.classList.toggle("hidden", unread === 0);

  const host = $("#alertList");
  host.className = "";
  host.innerHTML = list.length
    ? list.map((n) => `<div class="notice ${n.read ? "read" : ""}" data-note="${esc(n.id)}">
        <strong>${esc(n.title)}</strong><div>${esc(n.message)}</div>
        <time>${esc(fmtDateTime(n.createdAt))} · ${esc(ago(n.createdAt))}</time>
      </div>`).join("")
    : empty("No alerts", "You will be told here when a mentor is assigned or a meeting is fixed.");

  $$("[data-note]", host).forEach((el) =>
    el.addEventListener("click", async () => {
      await markNotificationRead(el.dataset.note);
      el.classList.add("read");
      loadAlerts();
    })
  );

  $("#overviewAlerts").className = "";
  $("#overviewAlerts").innerHTML = list.slice(0, 3).map((n) =>
    `<div class="notice ${n.read ? "read" : ""}"><strong>${esc(n.title)}</strong><div class="small">${esc(n.message)}</div><time>${esc(ago(n.createdAt))}</time></div>`
  ).join("") || "<p class='muted small'>Nothing yet.</p>";
}

$("#markAllRead").addEventListener("click", async () => {
  await markAllNotificationsRead(profile.uid);
  loadAlerts();
  toast("All alerts marked as read.", "ok");
});

/* ---------------- overview ---------------- */
function renderOverview() {
  const open = myRequests.filter((r) => !["closed"].includes(r.status));
  const next = myRequests.find((r) => r.meetingAt && r.status === "scheduled");

  $("#overviewBanner").innerHTML = !myProfilingForm
    ? `<div class="banner warn"><h3>Start with your profiling form</h3>
        <p>One form, filled once. It unlocks counselling requests and gives your mentor the background.</p></div>`
    : next
      ? `<div class="banner ok"><h3>You have a session coming up</h3>
          <p>${esc(fmtDateTime(next.meetingAt))} with ${esc(next.assignedFacultyName)} · ${esc(next.meetingMode || "mode to be confirmed")}
          ${next.meetingVenue ? " · " + esc(next.meetingVenue) : ""}</p></div>`
      : `<div class="banner"><h3>Hello, ${esc(profile.name.split(" ")[0])}</h3>
          <p>Raise a counselling request whenever you need to talk to someone. There is no limit.</p></div>`;

  $("#overviewStats").innerHTML = [
    ["Requests raised", myRequests.length],
    ["Still open", open.length],
    ["Sessions reviewed", myRequests.filter((r) => ["reviewed", "closed"].includes(r.status)).length],
    ["Profile", myProfilingForm ? "On file" : "Pending"]
  ].map(([k, n]) => `<div class="stat"><span class="n">${esc(n)}</span><span class="k">${esc(k)}</span></div>`).join("");

  const latest = myRequests[0];
  const host = $("#overviewLatest");
  host.className = "";
  host.innerHTML = latest
    ? `<div class="record-top"><span class="id">${esc(latest.requestId)}</span>
        <span class="chip ${(STATUS_META[latest.status] || {}).chip || ""}">${esc((STATUS_META[latest.status] || {}).label || latest.status)}</span></div>
       ${spine(latest.status)}
       <p class="meta small">${esc((latest.description || "").slice(0, 160))}</p>`
    : "<p class='muted small'>No requests yet.</p>";
}

/* ---------------- boot ---------------- */
await loadProfilingForm();
await loadRequests();
await loadSessions();
await loadAlerts();
