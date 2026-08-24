import { requireRole, logout, createFacultyAccount, readableAuthError } from "./auth.js";
import {
  $, $$, esc, toast, busy, collectForm, wireTabs, renderAppbar, spine,
  fmtDate, fmtDateTime, ago, empty, dump, openModal, confirmAction
} from "./ui.js";
import { LABELS, STATUS_META, actionPlanView } from "./forms.js";
import {
  listAllRequests, updateRequest, deleteRequest, listProfilingForms, deleteProfilingForm,
  listMentorForms, deleteMentorForm, listUsers, updateUser, deleteUserRecord,
  listNotifications, markNotificationRead, notify, audit, listAudit
} from "./data.js";

const profile = await requireRole("admin");
let showTab;
let requests = [], profiles = [], mentorForms = [], faculty = [], students = [], logs = [];

renderAppbar($("#appbar"), profile, { onSignOut: logout });
showTab = wireTabs();
$("#bellBtn").addEventListener("click", () => showTab("requests"));

/* ---------------- shared ---------------- */
async function refreshAll() {
  [requests, profiles, mentorForms, faculty, students] = await Promise.all([
    listAllRequests(), listProfilingForms(), listMentorForms(), listUsers("faculty"), listUsers("student")
  ]);
  renderRequests();
  renderProfiles();
  renderMentorForms();
  renderFaculty();
  renderStudents();
  renderOverview();
  refreshBell();
}

async function refreshBell() {
  const list = await listNotifications(profile.uid);
  const unread = list.filter((n) => !n.read).length;
  const count = $("#bellCount");
  count.textContent = unread;
  count.classList.toggle("hidden", unread === 0);
}

function downloadCSV(filename, rows) {
  if (!rows.length) { toast("Nothing to export yet.", "err"); return; }
  const columns = Array.from(rows.reduce((set, r) => { Object.keys(r).forEach((k) => set.add(k)); return set; }, new Set()));
  const cell = (v) => {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) v = v.join("; ");
    else if (typeof v === "object") v = v.toDate ? v.toDate().toISOString() : JSON.stringify(v);
    return `"${String(v).replace(/"/g, '""')}"`;
  };
  const csv = [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  audit(profile, "export", "csv", filename, `${rows.length} rows`);
}

/* ---------------- requests ---------------- */
function requestRow(r) {
  const meta = STATUS_META[r.status] || STATUS_META.submitted;
  const review = mentorForms.find((m) => m.requestDocId === r.id);
  return `<article class="record">
    <div class="record-top">
      <span class="id">${esc(r.requestId)}</span>
      <span class="name">${esc(r.studentName)}</span>
      <span class="mono muted">${esc(r.rollNo || "")} · ${esc(r.programme || "")} ${esc(r.yearSem || "")}</span>
      <div class="spacer"></div>
      ${r.priority === "immediate" ? '<span class="chip urgent">Urgent</span>' : ""}
      ${r.needsEscalation ? '<span class="chip urgent">Escalation asked</span>' : ""}
      <span class="chip ${meta.chip}">${esc(meta.label)}</span>
    </div>
    ${spine(r.status, {
      submitted: fmtDate(r.createdAt),
      assigned: r.assignedFacultyName || "",
      scheduled: r.meetingAt ? fmtDateTime(r.meetingAt) : "",
      reviewed: r.reviewedAt ? fmtDate(r.reviewedAt) : "",
      closed: r.closedAt ? fmtDate(r.closedAt) : ""
    })}
    <p class="meta">${(r.areas || []).map((a) => `<span class="tag">${esc(a)}</span>`).join("")}
      ${r.otherArea ? `<span class="tag">${esc(r.otherArea)}</span>` : ""}</p>
    <p class="meta">${esc((r.description || "").slice(0, 220))}</p>
    <p class="meta small muted">Raised ${esc(fmtDateTime(r.createdAt))} · wants support ${esc(r.urgency || "—")} · prefers ${esc(r.mode || "—")}
      ${r.preferredTime ? " · " + esc(r.preferredTime) : ""}</p>
    <div class="actions">
      <button class="btn small" data-assign="${esc(r.id)}" type="button">${r.assignedFacultyId ? "Reassign or reschedule" : "Assign a mentor"}</button>
      <button class="btn ghost small" data-view="${esc(r.id)}" type="button">Full request</button>
      ${review ? `<button class="btn ghost small" data-review="${esc(review.id)}" type="button">Mentor review</button>` : ""}
      ${r.status !== "closed" ? `<button class="btn ghost small" data-close-case="${esc(r.id)}" type="button">Close case</button>` : ""}
      <button class="btn ghost small" data-delete="${esc(r.id)}" type="button">Delete</button>
    </div>
  </article>`;
}

function renderRequests() {
  const term = ($("#requestSearch").value || "").toLowerCase();
  const f = $("#requestFilter").value;
  let list = requests;
  if (f === "pending") list = list.filter((r) => ["submitted", "assigned", "scheduled"].includes(r.status));
  else if (f) list = list.filter((r) => r.status === f);
  if (term) {
    list = list.filter((r) =>
      [r.studentName, r.rollNo, r.requestId, r.assignedFacultyName].join(" ").toLowerCase().includes(term)
    );
  }
  /* urgent first, then oldest first — the office works a queue, not a feed */
  list = [...list].sort((a, b) => {
    if ((b.priority === "immediate") - (a.priority === "immediate")) return (b.priority === "immediate") - (a.priority === "immediate");
    const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return at - bt;
  });

  const host = $("#adminRequestList");
  host.className = "";
  host.innerHTML = list.length ? list.map(requestRow).join("") : empty("Queue is clear", "No requests match this filter.");

  $$("[data-assign]", host).forEach((b) => b.addEventListener("click", () => openAssign(requests.find((r) => r.id === b.dataset.assign))));
  $$("[data-view]", host).forEach((b) => b.addEventListener("click", () => {
    const r = requests.find((x) => x.id === b.dataset.view);
    openModal(`<span class="eyebrow">${esc(r.requestId)}</span><h2>${esc(r.studentName)}</h2>${dump(r, LABELS)}
      <div class="modal-actions"><button class="btn neutral" data-close type="button">Close</button></div>`);
  }));
  $$("[data-review]", host).forEach((b) => b.addEventListener("click", () => openReview(mentorForms.find((m) => m.id === b.dataset.review))));
  $$("[data-close-case]", host).forEach((b) => b.addEventListener("click", async () => {
    const r = requests.find((x) => x.id === b.dataset.closeCase);
    if (!(await confirmAction(`Close ${r.requestId} for ${r.studentName}? The student will be told the case is closed.`, { danger: false, confirmLabel: "Close case" }))) return;
    await updateRequest(r.id, { status: "closed", closedAt: new Date().toISOString() });
    await notify(r.studentId, { title: "Request closed", message: `${r.requestId} has been marked closed by the Career Zone office.`, link: "student.html#records" });
    audit(profile, "close", "counsellingRequest", r.id, r.requestId);
    toast("Case closed.", "ok");
    refreshAll();
  }));
  $$("[data-delete]", host).forEach((b) => b.addEventListener("click", async () => {
    const r = requests.find((x) => x.id === b.dataset.delete);
    if (!(await confirmAction(`Delete ${r.requestId} permanently? The student's copy disappears too and this cannot be undone. Closing the case is usually the better choice.`, { confirmLabel: "Delete for good" }))) return;
    await deleteRequest(r.id);
    audit(profile, "delete", "counsellingRequest", r.id, r.requestId);
    toast("Request deleted.", "ok");
    refreshAll();
  }));
}

$("#requestSearch").addEventListener("input", renderRequests);
$("#requestFilter").addEventListener("change", renderRequests);
$("#exportRequests").addEventListener("click", () => downloadCSV("counselling-requests.csv", requests));

function openAssign(r) {
  const options = faculty.filter((f) => f.active !== false)
    .map((f) => `<option value="${esc(f.uid)}" ${f.uid === r.assignedFacultyId ? "selected" : ""}>${esc(f.name)}${f.department ? " — " + esc(f.department) : ""} (${caseload(f.uid)} open)</option>`)
    .join("");

  openModal(`
    <span class="eyebrow">${esc(r.requestId)} · ${esc(r.studentName)}</span>
    <h2>Assign a mentor and fix the meeting</h2>
    <p class="muted small">${esc((r.areas || []).join(", "))} · wants support ${esc(r.urgency || "")} · prefers ${esc(r.mode || "")} ${r.preferredTime ? "· " + esc(r.preferredTime) : ""}</p>
    <form id="assignForm" style="margin-top:1rem">
      <div class="field">
        <label for="a_fac">Faculty mentor</label>
        <select id="a_fac" name="assignedFacultyId" required><option value="">Select a mentor</option>${options}</select>
        ${options ? "" : "<p class='hint'>No active faculty accounts yet. Add one under the Faculty tab first.</p>"}
      </div>
      <div class="grid two">
        <div class="field"><label for="a_when">Meeting date and time</label>
          <input id="a_when" name="meetingAt" type="datetime-local" value="${esc(r.meetingAt ? String(r.meetingAt).slice(0, 16) : "")}"></div>
        <div class="field"><label for="a_mode">Mode</label>
          <select id="a_mode" name="meetingMode">
            <option value="">Not decided</option>
            <option ${r.meetingMode === "Face-to-face" ? "selected" : ""}>Face-to-face</option>
            <option ${r.meetingMode === "Online" ? "selected" : ""}>Online</option>
          </select></div>
      </div>
      <div class="field"><label for="a_venue">Room or meeting link</label>
        <input id="a_venue" name="meetingVenue" type="text" value="${esc(r.meetingVenue || "")}" placeholder="e.g. Career Zone room, Block B / Google Meet link"></div>
      <div class="field"><label for="a_pri">Priority</label>
        <select id="a_pri" name="priority">
          <option value="routine" ${r.priority === "routine" ? "selected" : ""}>Routine</option>
          <option value="priority" ${r.priority === "priority" ? "selected" : ""}>Priority</option>
          <option value="immediate" ${r.priority === "immediate" ? "selected" : ""}>Immediate</option>
        </select></div>
      <div class="field"><label for="a_note">Note to the mentor</label>
        <textarea id="a_note" name="facultyNote" placeholder="Anything the mentor should know before the meeting">${esc(r.facultyNote || "")}</textarea></div>
      <div class="field"><label for="a_msg">Message to the student</label>
        <textarea id="a_msg" name="studentMessage" placeholder="Shown on the student's dashboard with the meeting details">${esc(r.studentMessage || "")}</textarea></div>
      <div class="modal-actions">
        <button class="btn neutral" data-close type="button">Cancel</button>
        <button class="btn" type="submit">Assign and notify</button>
      </div>
    </form>`, {
    onMount(modal, close) {
      modal.querySelector("#assignForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector("button[type=submit]");
        busy(btn, true, "Assigning…");
        try {
          const data = collectForm(e.target);
          const mentor = faculty.find((f) => f.uid === data.assignedFacultyId);
          const patch = {
            ...data,
            assignedFacultyName: mentor?.name || "",
            assignedAt: new Date().toISOString(),
            status: data.meetingAt ? "scheduled" : "assigned"
          };
          await updateRequest(r.id, patch);
          await notify(mentor.uid, {
            title: "A student has been assigned to you",
            message: `${r.studentName} (${r.rollNo || "roll no. not set"}) · ${r.requestId}${data.meetingAt ? ` · meeting on ${fmtDateTime(data.meetingAt)}` : ""}.`,
            link: "faculty.html#assigned",
            kind: patch.priority === "immediate" ? "urgent" : "info"
          });
          await notify(r.studentId, {
            title: data.meetingAt ? "Your counselling session is scheduled" : "A mentor has been assigned to you",
            message: `${mentor.name} will meet you${data.meetingAt ? ` on ${fmtDateTime(data.meetingAt)}` : " shortly"}${data.meetingVenue ? ` · ${data.meetingVenue}` : ""}.`,
            link: "student.html#records"
          });
          audit(profile, "assign", "counsellingRequest", r.id, `${r.requestId} → ${mentor.name}`);
          close();
          toast("Assigned. Both the student and the mentor have been notified.", "ok");
          refreshAll();
        } catch (err) {
          console.error(err);
          toast("Could not assign. Try again.", "err");
          busy(btn, false);
        }
      });
    }
  });
}

function caseload(uid) {
  return requests.filter((r) => r.assignedFacultyId === uid && !["closed"].includes(r.status)).length;
}

/* ---------------- profiling forms ---------------- */
function renderProfiles() {
  const term = ($("#profileSearch").value || "").toLowerCase();
  const list = profiles.filter((p) => !term || [p.name, p.courseBatch, p.email].join(" ").toLowerCase().includes(term));
  const host = $("#adminProfileList");
  host.className = "";
  host.innerHTML = list.length
    ? list.map((p) => {
        const student = students.find((s) => s.uid === p.studentId);
        return `<article class="record">
          <div class="record-top">
            <span class="name">${esc(p.name || student?.name || "Unnamed")}</span>
            <span class="mono muted">${esc(student?.rollNo || "")} · ${esc(p.courseBatch || "")}</span>
            <div class="spacer"></div>
            <span class="chip">Updated ${esc(fmtDate(p.updatedAt))}</span>
          </div>
          <p class="meta small">${(p.supportNeeded || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}
            ${(p.challenges || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</p>
          <div class="actions">
            <button class="btn ghost small" data-open="${esc(p.id)}" type="button">Open form</button>
            <button class="btn ghost small" data-history="${esc(p.studentId)}" type="button">Case history</button>
            <button class="btn ghost small" data-del-profile="${esc(p.id)}" type="button">Delete</button>
          </div>
        </article>`;
      }).join("")
    : empty("No profiling forms yet", "Forms appear here as students submit them.");

  $$("[data-open]", host).forEach((b) => b.addEventListener("click", () => {
    const p = profiles.find((x) => x.id === b.dataset.open);
    openModal(`<span class="eyebrow">Student profiling form</span><h2>${esc(p.name || "Student")}</h2>${dump(p, LABELS)}
      <div class="modal-actions">
        <button class="btn neutral" onclick="window.print()" type="button">Print</button>
        <button class="btn" data-close type="button">Close</button>
      </div>`);
  }));
  $$("[data-history]", host).forEach((b) => b.addEventListener("click", () => openHistory(b.dataset.history)));
  $$("[data-del-profile]", host).forEach((b) => b.addEventListener("click", async () => {
    if (!(await confirmAction("Delete this profiling form? The student can fill it again, but the current answers are lost."))) return;
    await deleteProfilingForm(b.dataset.delProfile);
    audit(profile, "delete", "profilingForm", b.dataset.delProfile);
    toast("Profiling form deleted.", "ok");
    refreshAll();
  }));
}

$("#profileSearch").addEventListener("input", renderProfiles);
$("#exportProfiles").addEventListener("click", () => downloadCSV("student-profiles.csv", profiles));

/* ---------------- mentor reviews ---------------- */
function openReview(f) {
  openModal(`<span class="eyebrow">${esc(f.requestId || "session")} · filed ${esc(fmtDate(f.createdAt))}</span>
    <h2>${esc(f.studentName)} — reviewed by ${esc(f.mentorName)}</h2>
    ${dump(f, LABELS, ["actionPlan", "previousReview", "requestDocId", "studentName", "mentorName", "rollNo", "programme"])}
    <h3 style="margin-top:1.2rem">Revised action plan</h3>${actionPlanView(f.actionPlan)}
    <div class="modal-actions">
      <button class="btn neutral" onclick="window.print()" type="button">Print</button>
      <button class="btn" data-close type="button">Close</button>
    </div>`);
}

function renderMentorForms() {
  const term = ($("#mentorSearch").value || "").toLowerCase();
  const list = mentorForms.filter((f) => !term || [f.studentName, f.mentorName, f.requestId].join(" ").toLowerCase().includes(term));
  const host = $("#adminMentorList");
  host.className = "";
  host.innerHTML = list.length
    ? list.map((f) => `<article class="record">
        <div class="record-top">
          <span class="id">${esc(f.requestId || "")}</span>
          <span class="name">${esc(f.studentName)}</span>
          <span class="mono muted">mentor: ${esc(f.mentorName)}</span>
          <div class="spacer"></div>
          ${f.needsEscalation === "Yes" ? '<span class="chip urgent">Escalate</span>' : ""}
          <span class="chip ${f.issueStatus === "Resolved" ? "ok" : f.issueStatus === "Worsening" ? "urgent" : ""}">${esc(f.issueStatus || "—")}</span>
        </div>
        <p class="meta small">${esc(fmtDate(f.reviewDate || f.createdAt))} · decision: ${esc(f.decision || "—")}
          ${f.nextReviewDate ? " · next review " + esc(fmtDate(f.nextReviewDate)) : ""}</p>
        <p class="meta">${esc((f.mentorRemarks || "").slice(0, 200))}</p>
        <div class="actions">
          <button class="btn ghost small" data-open-review="${esc(f.id)}" type="button">Open review</button>
          <button class="btn ghost small" data-del-review="${esc(f.id)}" type="button">Delete</button>
        </div>
      </article>`).join("")
    : empty("No reviews filed yet", "Mentors file these after each counselling session.");

  $$("[data-open-review]", host).forEach((b) => b.addEventListener("click", () => openReview(mentorForms.find((x) => x.id === b.dataset.openReview))));
  $$("[data-del-review]", host).forEach((b) => b.addEventListener("click", async () => {
    if (!(await confirmAction("Delete this mentor review? The student loses their copy of the action plan too."))) return;
    await deleteMentorForm(b.dataset.delReview);
    audit(profile, "delete", "mentorForm", b.dataset.delReview);
    toast("Review deleted.", "ok");
    refreshAll();
  }));
}

$("#mentorSearch").addEventListener("input", renderMentorForms);
$("#exportMentor").addEventListener("click", () => downloadCSV("mentor-reviews.csv", mentorForms));

/* ---------------- faculty accounts ---------------- */
$("#facultyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  busy(btn, true, "Creating…");
  try {
    const data = collectForm(e.target);
    const uid = await createFacultyAccount(data);
    audit(profile, "create", "facultyAccount", uid, data.email);
    e.target.reset();
    toast(`${data.name} can now sign in with that email and password.`, "ok");
    refreshAll();
  } catch (err) {
    console.error(err);
    toast(readableAuthError(err), "err");
  } finally {
    busy(btn, false);
  }
});

function renderFaculty() {
  const host = $("#facultyList");
  host.className = "";
  host.innerHTML = faculty.length
    ? faculty.map((f) => `<article class="record" style="box-shadow:none">
        <div class="record-top">
          <span class="name">${esc(f.name)}</span>
          <div class="spacer"></div>
          <span class="chip ${f.active === false ? "" : "ok"}">${f.active === false ? "Inactive" : "Active"}</span>
          <span class="chip">${caseload(f.uid)} open</span>
        </div>
        <p class="meta small">${esc(f.designation || "")}${f.department ? " · " + esc(f.department) : ""} · ${esc(f.email)}${f.phone ? " · " + esc(f.phone) : ""}</p>
        <div class="actions">
          <button class="btn ghost small" data-toggle="${esc(f.uid)}" type="button">${f.active === false ? "Reactivate" : "Deactivate"}</button>
          <button class="btn ghost small" data-promote="${esc(f.uid)}" type="button">Make admin</button>
          <button class="btn ghost small" data-del-user="${esc(f.uid)}" type="button">Remove</button>
        </div>
      </article>`).join("")
    : empty("No mentors yet", "Add the first faculty mentor using the form on the left.");

  wireUserButtons(host);
}

function wireUserButtons(host) {
  $$("[data-toggle]", host).forEach((b) => b.addEventListener("click", async () => {
    const u = [...faculty, ...students].find((x) => x.uid === b.dataset.toggle);
    await updateUser(u.uid, { active: u.active === false });
    audit(profile, u.active === false ? "activate" : "deactivate", "user", u.uid, u.email);
    toast(`${u.name} is now ${u.active === false ? "active" : "inactive"}.`, "ok");
    refreshAll();
  }));
  $$("[data-promote]", host).forEach((b) => b.addEventListener("click", async () => {
    const u = faculty.find((x) => x.uid === b.dataset.promote);
    if (!(await confirmAction(`Give ${u.name} full office access? Admins can see every form and every student.`, { danger: false, confirmLabel: "Make admin" }))) return;
    await updateUser(u.uid, { role: "admin" });
    audit(profile, "promote", "user", u.uid, u.email);
    toast(`${u.name} is now an admin.`, "ok");
    refreshAll();
  }));
  $$("[data-del-user]", host).forEach((b) => b.addEventListener("click", async () => {
    const u = [...faculty, ...students].find((x) => x.uid === b.dataset.delUser);
    if (!(await confirmAction(`Remove ${u.name}'s record? Their sign-in still exists until you delete it in the Firebase console under Authentication. Deactivating is usually enough.`))) return;
    await deleteUserRecord(u.uid);
    audit(profile, "delete", "user", u.uid, u.email);
    toast("Record removed.", "ok");
    refreshAll();
  }));
}

/* ---------------- students ---------------- */
function openHistory(studentId) {
  const s = students.find((x) => x.uid === studentId);
  const p = profiles.find((x) => x.studentId === studentId);
  const rs = requests.filter((r) => r.studentId === studentId);
  const fs = mentorForms.filter((m) => m.studentId === studentId);
  openModal(`<span class="eyebrow">Complete file</span><h2>${esc(s?.name || p?.name || "Student")}</h2>
    <p class="muted small">${esc(s?.rollNo || "")} · ${esc(s?.programme || "")} ${esc(s?.yearSem || "")} · ${esc(s?.email || "")}</p>
    <h3 style="margin-top:1.2rem">Profiling form</h3>
    ${p ? `<p class="small">Submitted ${esc(fmtDate(p.updatedAt))}. Support asked for: ${(p.supportNeeded || []).join(", ") || "—"}</p>` : "<p class='muted small'>Not filled yet.</p>"}
    <h3 style="margin-top:1.2rem">Counselling requests (${rs.length})</h3>
    ${rs.map((r) => `<div class="notice"><strong>${esc(r.requestId)}</strong> · ${esc(fmtDate(r.createdAt))} · ${esc(r.status)}${r.assignedFacultyName ? " · " + esc(r.assignedFacultyName) : ""}
      <div class="small">${esc(r.description || "")}</div></div>`).join("") || "<p class='muted small'>None.</p>"}
    <h3 style="margin-top:1.2rem">Mentor reviews (${fs.length})</h3>
    ${fs.map((f) => `<div class="notice"><strong>${esc(fmtDate(f.reviewDate || f.createdAt))}</strong> · ${esc(f.mentorName)} · ${esc(f.issueStatus || "")} · ${esc(f.decision || "")}
      <div class="small">${esc(f.mentorRemarks || "")}</div></div>`).join("") || "<p class='muted small'>None.</p>"}
    <div class="modal-actions"><button class="btn neutral" data-close type="button">Close</button></div>`);
}

function renderStudents() {
  const term = ($("#studentSearch").value || "").toLowerCase();
  const list = students.filter((s) => !term || [s.name, s.rollNo, s.email, s.programme].join(" ").toLowerCase().includes(term));
  const host = $("#studentList");
  host.className = "";
  host.innerHTML = list.length
    ? list.map((s) => {
        const rs = requests.filter((r) => r.studentId === s.uid);
        const hasProfile = profiles.some((p) => p.studentId === s.uid);
        return `<article class="record">
          <div class="record-top">
            <span class="name">${esc(s.name)}</span>
            <span class="mono muted">${esc(s.rollNo || "")} · ${esc(s.programme || "")} ${esc(s.yearSem || "")}</span>
            <div class="spacer"></div>
            <span class="chip ${hasProfile ? "ok" : "warn"}">${hasProfile ? "Profile on file" : "Profile pending"}</span>
            <span class="chip">${rs.length} request${rs.length === 1 ? "" : "s"}</span>
            <span class="chip ${s.active === false ? "urgent" : ""}">${s.active === false ? "Inactive" : "Active"}</span>
          </div>
          <p class="meta small">${esc(s.email)}${s.phone ? " · " + esc(s.phone) : ""} · joined ${esc(fmtDate(s.createdAt))}</p>
          <div class="actions">
            <button class="btn ghost small" data-history="${esc(s.uid)}" type="button">Open full file</button>
            <button class="btn ghost small" data-toggle="${esc(s.uid)}" type="button">${s.active === false ? "Reactivate" : "Deactivate"}</button>
            <button class="btn ghost small" data-del-user="${esc(s.uid)}" type="button">Remove</button>
          </div>
        </article>`;
      }).join("")
    : empty("No students yet", "Students appear here as soon as they register.");

  $$("[data-history]", host).forEach((b) => b.addEventListener("click", () => openHistory(b.dataset.history)));
  wireUserButtons(host);
}

$("#studentSearch").addEventListener("input", renderStudents);
$("#exportStudents").addEventListener("click", () => downloadCSV("students.csv", students));

/* ---------------- activity log ---------------- */
async function loadLog() {
  logs = await listAudit();
  const host = $("#logList");
  host.className = "";
  host.innerHTML = logs.length
    ? `<div class="table-scroll"><table class="grid-table">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
        <tbody>${logs.slice(0, 400).map((l) => `<tr>
          <td class="nowrap mono">${esc(fmtDateTime(l.at))}</td>
          <td>${esc(l.actorName)} <span class="muted small">(${esc(l.actorRole)})</span></td>
          <td>${esc(l.action)}</td>
          <td>${esc(l.entity)}</td>
          <td>${esc(l.details || "")}</td>
        </tr>`).join("")}</tbody></table></div>`
    : empty("Nothing logged yet", "Submissions, assignments and deletions are recorded here.");
}

$("#exportLog").addEventListener("click", () => downloadCSV("activity-log.csv", logs));

/* ---------------- overview ---------------- */
function renderOverview() {
  const unassigned = requests.filter((r) => r.status === "submitted");
  const urgent = unassigned.filter((r) => r.priority === "immediate");
  const escalations = requests.filter((r) => r.needsEscalation && r.status !== "closed");

  $("#adminBanner").innerHTML = urgent.length
    ? `<div class="banner warn"><h3>${urgent.length} urgent request${urgent.length === 1 ? "" : "s"} waiting</h3>
        <p>These students asked to be seen within 24–48 hours. Assign a mentor before anything else.</p>
        <p style="margin-top:.8rem"><button class="btn small" id="goQueue" type="button">Open the queue</button></p></div>`
    : unassigned.length
      ? `<div class="banner"><h3>${unassigned.length} request${unassigned.length === 1 ? "" : "s"} to assign</h3>
          <p>Nothing urgent. Work the queue oldest first.</p>
          <p style="margin-top:.8rem"><button class="btn small" id="goQueue" type="button">Open the queue</button></p></div>`
      : `<div class="banner ok"><h3>Queue is clear</h3><p>Every request has a mentor against it.</p></div>`;
  const go = $("#goQueue");
  if (go) go.addEventListener("click", () => showTab("requests"));

  $("#adminStats").innerHTML = [
    ["Students registered", students.length],
    ["Profiling forms", profiles.length],
    ["Requests raised", requests.length],
    ["Awaiting assignment", unassigned.length],
    ["Sessions reviewed", mentorForms.length],
    ["Escalations open", escalations.length],
    ["Faculty mentors", faculty.filter((f) => f.active !== false).length],
    ["Closed cases", requests.filter((r) => r.status === "closed").length]
  ].map(([k, n]) => `<div class="stat"><span class="n">${esc(n)}</span><span class="k">${esc(k)}</span></div>`).join("");

  const queue = $("#adminQueue");
  queue.className = "";
  queue.innerHTML = unassigned.length
    ? unassigned.slice(0, 6).map((r) => `<div class="notice ${r.priority === "immediate" ? "" : "read"}">
        <strong>${esc(r.studentName)}</strong> <span class="mono muted">${esc(r.requestId)}</span>
        <div class="small">${esc((r.areas || []).join(", "))} · ${esc(r.urgency || "")}</div>
        <time>raised ${esc(ago(r.createdAt))}</time></div>`).join("")
    : "<p class='muted small'>Nothing waiting.</p>";

  const load = $("#adminLoad");
  load.className = "";
  load.innerHTML = faculty.length
    ? faculty.map((f) => `<div class="notice read"><strong>${esc(f.name)}</strong>
        <div class="small">${caseload(f.uid)} open · ${mentorForms.filter((m) => m.facultyId === f.uid).length} reviews filed</div></div>`).join("")
    : "<p class='muted small'>No mentors added yet.</p>";
}

/* ---------------- boot ---------------- */
await refreshAll();
await loadLog();
window.addEventListener("tabchange", (e) => { if (e.detail === "log") loadLog(); });
