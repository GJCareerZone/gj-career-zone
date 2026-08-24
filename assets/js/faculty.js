import { requireRole, logout } from "./auth.js";
import {
  $, $$, esc, toast, busy, collectForm, wireTabs, renderAppbar, spine,
  fmtDate, fmtDateTime, ago, empty, dump, openModal
} from "./ui.js";
import {
  hydrateControls, LABELS, STATUS_META, actionPlanTable, readActionPlan, actionPlanView,
  checkGroup, radioGroup, MENTOR_ISSUES, EVIDENCE
} from "./forms.js";
import {
  listRequestsByFaculty, updateRequest, createMentorForm, listMentorForms,
  getProfilingForm, listNotifications, markNotificationRead, markAllNotificationsRead,
  notify, audit, listUsers
} from "./data.js";

const profile = await requireRole("faculty");
let showTab;
let assigned = [];
let myMentorForms = [];

renderAppbar($("#appbar"), profile, { onSignOut: logout });
showTab = wireTabs();
$("#bellBtn").addEventListener("click", () => showTab("alerts"));

/* ---------------- assigned requests ---------------- */
function requestCard(r) {
  const meta = STATUS_META[r.status] || STATUS_META.assigned;
  return `<article class="record">
    <div class="record-top">
      <span class="id">${esc(r.requestId)}</span>
      <span class="name">${esc(r.studentName)}</span>
      <span class="mono muted">${esc(r.rollNo || "")} · ${esc(r.programme || "")} ${esc(r.yearSem || "")}</span>
      <div class="spacer"></div>
      <span class="chip ${meta.chip}">${esc(meta.label)}</span>
      ${r.priority === "immediate" ? '<span class="chip urgent">Urgent</span>' : ""}
    </div>
    ${spine(r.status, {
      submitted: fmtDate(r.createdAt),
      scheduled: r.meetingAt ? fmtDateTime(r.meetingAt) : "",
      reviewed: r.reviewedAt ? fmtDate(r.reviewedAt) : ""
    })}
    <p class="meta">${(r.areas || []).map((a) => `<span class="tag">${esc(a)}</span>`).join("")}</p>
    <p class="meta">${esc(r.description || "")}</p>
    ${r.meetingAt ? `<p class="meta"><strong>Meeting:</strong> ${esc(fmtDateTime(r.meetingAt))} · ${esc(r.meetingMode || "")} ${r.meetingVenue ? "· " + esc(r.meetingVenue) : ""}</p>` : ""}
    ${r.facultyNote ? `<p class="meta"><strong>Note to you from the office:</strong> ${esc(r.facultyNote)}</p>` : ""}
    <div class="actions">
      <button class="btn small" data-record="${esc(r.id)}" type="button">${r.status === "reviewed" || r.status === "closed" ? "Add another review" : "Record this session"}</button>
      <button class="btn ghost small" data-profile="${esc(r.studentId)}" type="button">Student profile</button>
      <button class="btn ghost small" data-full="${esc(r.id)}" type="button">Full request</button>
    </div>
  </article>`;
}

async function loadAssigned() {
  assigned = await listRequestsByFaculty(profile.uid);
  myMentorForms = await listMentorForms({ facultyId: profile.uid });
  renderAssigned();
  renderStudents();
  renderOverview();
}

function renderAssigned() {
  const f = $("#assignedFilter").value;
  const list = f === "open" ? assigned.filter((r) => !["closed"].includes(r.status)) : f ? assigned.filter((r) => r.status === f) : assigned;
  const host = $("#assignedList");
  host.className = "";
  host.innerHTML = list.length
    ? list.map(requestCard).join("")
    : empty("Nothing assigned yet", "When the Career Zone office assigns a student to you, the request lands here.");
  wireRecordButtons(host);
}

$("#assignedFilter").addEventListener("change", renderAssigned);

function wireRecordButtons(host) {
  $$("[data-record]", host).forEach((b) =>
    b.addEventListener("click", () => openSessionForm(assigned.find((r) => r.id === b.dataset.record)))
  );
  $$("[data-profile]", host).forEach((b) =>
    b.addEventListener("click", async () => {
      const p = await getProfilingForm(b.dataset.profile);
      openModal(p
        ? `<span class="eyebrow">Student profiling form</span><h2>${esc(p.name || "Student")}</h2>${dump(p, LABELS)}
           <div class="modal-actions"><button class="btn neutral" data-close type="button">Close</button></div>`
        : `<h2>No profiling form</h2><p class="muted">This student has not filled the profiling form yet.</p>
           <div class="modal-actions"><button class="btn neutral" data-close type="button">Close</button></div>`);
    })
  );
  $$("[data-full]", host).forEach((b) =>
    b.addEventListener("click", () => {
      const r = assigned.find((x) => x.id === b.dataset.full);
      openModal(`<span class="eyebrow">${esc(r.requestId)}</span><h2>${esc(r.studentName)}</h2>${dump(r, LABELS)}
        <div class="modal-actions"><button class="btn neutral" data-close type="button">Close</button></div>`);
    })
  );
}

/* ---------------- mentor–mentee review form ---------------- */
function openSessionForm(request) {
  showTab("session");
  const previous = myMentorForms.filter((f) => f.studentId === request.studentId);
  const last = previous[0];
  const prevPlan = last?.actionPlan || [];
  const today = new Date().toISOString().slice(0, 10);
  const yesNo = ["Yes", "Somewhat", "No"];

  $("#sessionHost").innerHTML = `
  <div class="card">
    <div class="card-head">
      <div>
        <span class="eyebrow">Form 3 of 3 · ${esc(request.requestId)}</span>
        <h2>Mentor–mentee review</h2>
        <p class="muted small" style="margin:.2rem 0 0">
          ${esc(request.studentName)} · ${esc(request.rollNo || "")} · ${esc(request.programme || "")} ${esc(request.yearSem || "")}
          ${last ? ` · last reviewed ${esc(fmtDate(last.reviewDate || last.createdAt))}` : " · first review"}
        </p>
      </div>
      <div class="spacer"></div>
      <button class="btn neutral small" id="cancelSession" type="button">Back to caseload</button>
    </div>

    <form id="mentorForm">
      <fieldset>
        <legend>A · Basic details</legend>
        <div class="grid two">
          <div class="field"><label for="m_review">Review meeting date</label>
            <input id="m_review" name="reviewDate" type="date" value="${esc(today)}" required></div>
          <div class="field"><label for="m_prev">Previous meeting date</label>
            <input id="m_prev" name="previousMeetingDate" type="date" value="${esc(last?.reviewDate || "")}"></div>
        </div>
      </fieldset>

      <fieldset>
        <legend>B · Issues being reviewed</legend>
        ${checkGroup("issues", MENTOR_ISSUES)}
        <div class="field" style="margin-top:.8rem"><label for="m_io">Other issue</label>
          <input id="m_io" name="issuesOther" type="text"></div>
      </fieldset>

      <fieldset>
        <legend>C · Review of previous action points</legend>
        ${prevPlan.length ? "" : "<p class='hint' style='margin-top:-.4rem'>No action points were carried forward. Fill in whatever was agreed verbally, if anything.</p>"}
        <div class="table-scroll"><table class="grid-table">
          <thead><tr><th></th><th>Action point decided earlier</th><th>Status</th><th>Remarks / reason if not done</th></tr></thead>
          <tbody>${[0, 1, 2, 3].map((i) => `<tr>
            <th scope="row" style="font-family:var(--mono);font-size:.7rem;color:var(--muted)">${i + 1}</th>
            <td><input type="text" name="pa_${i}_point" value="${esc(prevPlan[i]?.outcome || "")}"></td>
            <td><select name="pa_${i}_status"><option value="">—</option><option>Completed</option><option>Partly done</option><option>Not done</option></select></td>
            <td><input type="text" name="pa_${i}_remarks"></td>
          </tr>`).join("")}</tbody>
        </table></div>
        <div class="field" style="margin-top:1rem">
          <label>Evidence of progress</label>
          ${checkGroup("evidence", EVIDENCE)}
        </div>
        <div class="field"><label for="m_eo">Other evidence</label><input id="m_eo" name="evidenceOther" type="text"></div>
      </fieldset>

      <fieldset>
        <legend>D · Mentee feedback</legend>
        <div class="field"><label>Has the mentor helped you move closer to your academic or career goals?</label>${radioGroup("fbGoalProgress", yesNo)}</div>
        <div class="field"><label>Are you satisfied with the progress made so far?</label>${radioGroup("fbSatisfied", yesNo)}</div>
        <div class="field"><label for="m_f3">What improvement have you noticed in yourself since the last meeting?</label><textarea id="m_f3" name="fbImprovement"></textarea></div>
        <div class="field"><label for="m_f4">What is still unresolved?</label><textarea id="m_f4" name="fbUnresolved"></textarea></div>
        <div class="field"><label for="m_f5">What additional support do you need now?</label><textarea id="m_f5" name="fbSupportNeeded"></textarea></div>
      </fieldset>

      <fieldset>
        <legend>E · Mentor assessment</legend>
        <div class="field"><label>Regularity in attending classes and meetings</label>${radioGroup("asRegularity", ["Good", "Average", "Poor"])}</div>
        <div class="field"><label>Follow-through on agreed instructions</label>${radioGroup("asFollowThrough", ["Good", "Average", "Poor"])}</div>
        <div class="field"><label>Ownership of the agreed action plan</label>${radioGroup("asOwnership", ["High", "Moderate", "Low"])}</div>
        <div class="field"><label>Improvement since the last meeting</label>${radioGroup("asImprovement", ["Good", "Limited", "No improvement"])}</div>
        <div class="field"><label>Does this case need stricter monitoring?</label>${radioGroup("asStricterMonitoring", ["Yes", "No"])}</div>
      </fieldset>

      <fieldset>
        <legend>F · Present status</legend>
        <div class="field"><label>Issue status</label>${radioGroup("issueStatus", ["Resolved", "Improving", "Same", "Worsening"], "", true)}</div>
        <div class="field"><label>Should the case continue with the mentor only?</label>${radioGroup("continueWithMentor", ["Yes", "No"])}</div>
        <div class="field"><label>Does this need escalation to the Career Zone coordinator?</label>${radioGroup("needsEscalation", ["Yes", "No"])}</div>
      </fieldset>

      <fieldset>
        <legend>G · Revised action plan for the next 2–4 weeks</legend>
        ${actionPlanTable(3)}
      </fieldset>

      <fieldset>
        <legend>H · Follow-up decision</legend>
        <div class="grid two">
          <div class="field"><label for="m_next">Next review date</label><input id="m_next" name="nextReviewDate" type="date"></div>
          <div class="field"><label>Decision</label>${radioGroup("decision", ["Close case", "Continue mentoring", "Escalate", "Refer to specialist support"], "", true)}</div>
        </div>
        <div class="field"><label for="m_esc">If escalated or referred, to whom</label><input id="m_esc" name="escalatedTo" type="text"></div>
        <div class="field"><label for="m_rem">Mentor's remarks</label><textarea id="m_rem" name="mentorRemarks"></textarea></div>
      </fieldset>

      <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1.5rem">
        <button class="btn" type="submit">File this review</button>
        <button class="btn neutral" type="button" onclick="window.print()">Print</button>
      </div>
    </form>
  </div>`;

  hydrateControls($("#sessionHost"));
  $("#cancelSession").addEventListener("click", () => showTab("assigned"));

  $("#mentorForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    busy(btn, true, "Filing…");
    try {
      const data = collectForm(e.target);
      const actionPlan = readActionPlan(data, 3);
      const previousReview = [0, 1, 2, 3].map((i) => {
        const row = {
          point: data[`pa_${i}_point`] || "",
          status: data[`pa_${i}_status`] || "",
          remarks: data[`pa_${i}_remarks`] || ""
        };
        delete data[`pa_${i}_point`]; delete data[`pa_${i}_status`]; delete data[`pa_${i}_remarks`];
        return row;
      }).filter((r) => r.point || r.status || r.remarks);

      const formId = await createMentorForm({
        ...data,
        actionPlan,
        previousReview,
        requestDocId: request.id,
        requestId: request.requestId,
        studentId: request.studentId,
        studentName: request.studentName,
        rollNo: request.rollNo || "",
        programme: request.programme || "",
        yearSem: request.yearSem || "",
        facultyId: profile.uid,
        mentorName: profile.name
      });

      const closing = data.decision === "Close case";
      await updateRequest(request.id, {
        status: closing ? "closed" : "reviewed",
        reviewedAt: new Date().toISOString(),
        ...(closing ? { closedAt: new Date().toISOString() } : {}),
        lastMentorFormId: formId,
        needsEscalation: data.needsEscalation === "Yes"
      });

      await notify(request.studentId, {
        title: "Your session has been recorded",
        message: `${profile.name} filed a review for ${request.requestId}. Open “Session records” to read the action plan.`,
        link: "student.html#sessions"
      });
      const admins = await listUsers("admin");
      await Promise.all(admins.map((a) => notify(a.uid, {
        title: data.needsEscalation === "Yes" ? "Review filed — escalation requested" : "Mentor review filed",
        message: `${profile.name} reviewed ${request.studentName} (${request.requestId}). Decision: ${data.decision}.`,
        link: "admin.html#mentor",
        kind: data.needsEscalation === "Yes" ? "urgent" : "info"
      })));
      audit(profile, "submit", "mentorForm", formId, `${request.requestId} · ${data.decision}`);

      toast("Review filed. The student and the office have been notified.", "ok");
      await loadAssigned();
      showTab("assigned");
    } catch (err) {
      console.error(err);
      toast("Could not file the review. Try again.", "err");
    } finally {
      busy(btn, false);
    }
  });
}

$("#sessionHost").innerHTML = empty(
  "Pick a request first",
  "Open “Assigned to me”, choose a student and tap “Record this session”. The review form opens here, pre-filled."
);

/* ---------------- student files ---------------- */
function renderStudents() {
  const term = ($("#studentSearch").value || "").toLowerCase();
  const byStudent = new Map();
  assigned.forEach((r) => {
    const s = byStudent.get(r.studentId) || { id: r.studentId, name: r.studentName, rollNo: r.rollNo, programme: r.programme, requests: [], reviews: [] };
    s.requests.push(r);
    byStudent.set(r.studentId, s);
  });
  myMentorForms.forEach((f) => {
    const s = byStudent.get(f.studentId);
    if (s) s.reviews.push(f);
  });

  const list = Array.from(byStudent.values()).filter(
    (s) => !term || (s.name || "").toLowerCase().includes(term) || (s.rollNo || "").toLowerCase().includes(term)
  );

  const host = $("#studentList");
  host.className = "";
  host.innerHTML = list.length
    ? list.map((s) => `<article class="record">
        <div class="record-top">
          <span class="name">${esc(s.name)}</span>
          <span class="mono muted">${esc(s.rollNo || "")} · ${esc(s.programme || "")}</span>
          <div class="spacer"></div>
          <span class="chip">${s.requests.length} request${s.requests.length === 1 ? "" : "s"}</span>
          <span class="chip">${s.reviews.length} review${s.reviews.length === 1 ? "" : "s"}</span>
        </div>
        <div class="actions">
          <button class="btn ghost small" data-profile="${esc(s.id)}" type="button">Profiling form</button>
          <button class="btn ghost small" data-history="${esc(s.id)}" type="button">Full history</button>
        </div>
      </article>`).join("")
    : empty("No student files yet", "Students appear here once the office assigns their request to you.");

  wireRecordButtons(host);
  $$("[data-history]", host).forEach((b) =>
    b.addEventListener("click", () => {
      const sid = b.dataset.history;
      const rs = assigned.filter((r) => r.studentId === sid);
      const fs = myMentorForms.filter((f) => f.studentId === sid);
      openModal(`<span class="eyebrow">Case history</span><h2>${esc(rs[0]?.studentName || "Student")}</h2>
        <h3 style="margin-top:1rem">Requests</h3>
        ${rs.map((r) => `<div class="notice"><strong>${esc(r.requestId)}</strong> · ${esc(fmtDate(r.createdAt))} · ${esc(r.status)}
           <div class="small">${esc(r.description || "")}</div></div>`).join("") || "<p class='muted small'>None.</p>"}
        <h3 style="margin-top:1.2rem">Reviews you filed</h3>
        ${fs.map((f) => `<div class="notice"><strong>${esc(fmtDate(f.reviewDate || f.createdAt))}</strong> · ${esc(f.issueStatus || "")} · ${esc(f.decision || "")}
           <div class="small">${esc(f.mentorRemarks || "")}</div>${actionPlanView(f.actionPlan)}</div>`).join("") || "<p class='muted small'>None.</p>"}
        <div class="modal-actions"><button class="btn neutral" data-close type="button">Close</button></div>`);
    })
  );
}

$("#studentSearch").addEventListener("input", renderStudents);

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
        <time>${esc(fmtDateTime(n.createdAt))} · ${esc(ago(n.createdAt))}</time></div>`).join("")
    : empty("No alerts", "You will be told here when a student is assigned to you.");

  $$("[data-note]", host).forEach((el) =>
    el.addEventListener("click", async () => { await markNotificationRead(el.dataset.note); loadAlerts(); })
  );

  $("#facultyAlerts").className = "";
  $("#facultyAlerts").innerHTML = list.slice(0, 3).map((n) =>
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
  const open = assigned.filter((r) => !["closed"].includes(r.status));
  const pendingReview = assigned.filter((r) => ["assigned", "scheduled"].includes(r.status));
  $("#facultyBanner").innerHTML = pendingReview.length
    ? `<div class="banner warn"><h3>${pendingReview.length} session${pendingReview.length === 1 ? "" : "s"} waiting on a review</h3>
        <p>File the mentor–mentee review after each meeting so the next mentor picks up where you left off.</p></div>`
    : `<div class="banner ok"><h3>Caseload is up to date</h3><p>Nothing is waiting on you right now.</p></div>`;

  $("#facultyStats").innerHTML = [
    ["Assigned to me", assigned.length],
    ["Open cases", open.length],
    ["Reviews filed", myMentorForms.length],
    ["Students mentored", new Set(assigned.map((r) => r.studentId)).size]
  ].map(([k, n]) => `<div class="stat"><span class="n">${esc(n)}</span><span class="k">${esc(k)}</span></div>`).join("");

  const upcoming = assigned
    .filter((r) => r.meetingAt && new Date(r.meetingAt) >= new Date(Date.now() - 864e5))
    .sort((a, b) => new Date(a.meetingAt) - new Date(b.meetingAt));
  const host = $("#facultyUpcoming");
  host.className = "";
  host.innerHTML = upcoming.length
    ? upcoming.slice(0, 5).map((r) => `<div class="notice"><strong>${esc(r.studentName)}</strong>
        <div class="small">${esc(fmtDateTime(r.meetingAt))} · ${esc(r.meetingMode || "")} ${r.meetingVenue ? "· " + esc(r.meetingVenue) : ""}</div>
        <time>${esc(r.requestId)}</time></div>`).join("")
    : "<p class='muted small'>No meetings scheduled.</p>";
}

/* ---------------- boot ---------------- */
await loadAssigned();
await loadAlerts();
