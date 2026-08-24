/* The three paper forms, expressed once as data.
   Change an option here and it changes in the form, in the admin view
   and in the exported CSV at the same time. */

import { esc } from "./ui.js";

export const EDU_ROWS = [
  { key: "class12", label: "12th / Graduation" },
  { key: "sem1", label: "Semester 1" },
  { key: "sem2", label: "Semester 2" },
  { key: "sem3", label: "Semester 3" },
  { key: "sem4", label: "Semester 4" },
  { key: "sem5", label: "Semester 5" },
  { key: "sem6", label: "Semester 6" }
];

export const CHALLENGES = [
  "Academic", "Self-esteem / confidence", "Time management",
  "Pressure from others", "Motivation", "Financial"
];

export const CAREER_PRIORITIES = [
  { key: "learningGrowth", label: "Learning & growth" },
  { key: "jobSecurity", label: "Job security" },
  { key: "workLifeBalance", label: "Work–life balance" },
  { key: "compensation", label: "Compensation" },
  { key: "leadership", label: "Leadership" },
  { key: "socialImpact", label: "Social impact" }
];

export const SUPPORT_NEEDED = [
  "Counselling", "Networking", "Career planning", "Higher education",
  "Skill development", "Placement preparation", "Accessibility"
];

export const NO_PLACEMENT_REASONS = [
  "Having own / family business",
  "Preparing for govt. jobs / competitive exams",
  "Higher studies / settle abroad",
  "Personal reason / can't say",
  "I do not require any help"
];

export const ENTREPRENEURSHIP_AREAS = [
  "Starting a business", "Innovation and product development",
  "Social entrepreneurship", "Technology startups"
];

export const HIGHER_ED_HELP = ["Govt. exams", "International credentials"];

export const COUNSELLING_AREAS = [
  "Academic stress", "Career confusion", "Placement anxiety",
  "Examination stress", "Time management", "Low confidence / self-esteem",
  "Communication challenges", "Family / personal concerns", "Emotional well-being",
  "Relationship concerns", "Financial concerns"
];

export const URGENCY = [
  "Immediately (within 24-48 hours)",
  "Within this week",
  "Within two weeks",
  "Whenever an appointment is available"
];

export const MODES = ["Face-to-face", "Online", "Either"];

export const REFERRAL_SOURCES = ["Self-request", "Mentor referral", "Faculty referral", "Career Zone referral"];

export const MENTOR_ISSUES = [
  "Academic performance", "Attendance / punctuality", "Communication / confidence",
  "Career clarity", "Internship / placement readiness", "Skill development",
  "Well-being", "Personal / family issue", "Behaviour / discipline"
];

export const EVIDENCE = [
  "Certificate", "Internship", "Resume updated", "Project completed",
  "Improved attendance", "CGPA improved"
];

export const STATUS_META = {
  submitted: { label: "Submitted", chip: "warn" },
  assigned: { label: "Assigned", chip: "brand" },
  scheduled: { label: "Scheduled", chip: "brand" },
  reviewed: { label: "Reviewed", chip: "ok" },
  closed: { label: "Closed", chip: "" }
};

/* ---------- renderers for repeated controls ---------- */
export function checkGroup(name, options, checked = []) {
  return `<div class="checks">${options
    .map(
      (o, i) => `<label><input type="checkbox" name="${esc(name)}[]" value="${esc(o)}"
        ${checked.includes(o) ? "checked" : ""} id="${esc(name)}_${i}"><span>${esc(o)}</span></label>`
    )
    .join("")}</div>`;
}

export function radioGroup(name, options, value = "", required = false) {
  return `<div class="radios">${options
    .map(
      (o, i) => `<label><input type="radio" name="${esc(name)}" value="${esc(o)}"
        ${value === o ? "checked" : ""} ${required && i === 0 ? "required" : ""}><span>${esc(o)}</span></label>`
    )
    .join("")}</div>`;
}

export function eduTable() {
  return `<div class="table-scroll"><table class="grid-table">
    <thead><tr><th>Semester / class</th><th>CGPA or percentage</th><th>Reappears</th></tr></thead>
    <tbody>${EDU_ROWS.map(
      (r) => `<tr>
        <th scope="row" style="font-family:var(--body);text-transform:none;letter-spacing:0;font-size:.9rem;color:var(--ink)">${esc(r.label)}</th>
        <td><input type="text" name="edu_${r.key}_score" inputmode="decimal" placeholder="—"></td>
        <td><input type="text" name="edu_${r.key}_reappear" placeholder="Nil"></td>
      </tr>`
    ).join("")}</tbody></table></div>`;
}

export function rankTable() {
  const opts = [1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}</option>`).join("");
  return `<div class="table-scroll"><table class="grid-table">
    <thead><tr><th>What matters to you at work</th><th style="width:9rem">Rank</th></tr></thead>
    <tbody>${CAREER_PRIORITIES.map(
      (p) => `<tr>
        <th scope="row" style="font-family:var(--body);text-transform:none;letter-spacing:0;font-size:.9rem;color:var(--ink)">${esc(p.label)}</th>
        <td><select name="rank_${p.key}"><option value="">—</option>${opts}</select></td>
      </tr>`
    ).join("")}</tbody></table></div>`;
}

/* ---------- labels used when a stored form is shown read-only ---------- */
const eduLabels = {};
EDU_ROWS.forEach((r) => {
  eduLabels[`edu_${r.key}_score`] = `${r.label} — score`;
  eduLabels[`edu_${r.key}_reappear`] = `${r.label} — reappears`;
});

const rankLabels = {};
CAREER_PRIORITIES.forEach((p) => { rankLabels[`rank_${p.key}`] = `Rank — ${p.label}`; });

export const LABELS = {
  ...eduLabels,
  ...rankLabels,
  name: "Name",
  phone: "Phone number",
  whatsapp: "WhatsApp number",
  courseBatch: "Course & batch",
  yearSem: "Year / semester",
  address: "Present address",
  email: "Email",
  bloodGroup: "Blood group",
  languages: "Languages known",
  hobbies: "Hobbies / interests",
  familyMembers: "Members in family",
  parentOccupation: "Parent's occupation",
  familyIncome: "Family annual income",
  livingWith: "Living with",
  familyType: "Family type",
  certifications: "Additional certifications",
  achCommunity: "Achievement — community service",
  achProfessional: "Achievement — professional",
  achAcademic: "Achievement — academic",
  achExtra: "Achievement — extra-curricular",
  achProjects: "Achievement — projects & leadership",
  skillsHave: "Skills possessed",
  skillsWant: "Skills to develop",
  goalYear1: "Career goal — year 1",
  goalYear2: "Career goal — year 2",
  goalYear3: "Career goal — year 3",
  idol: "Person idolised (other than parents)",
  challenges: "Challenges being faced",
  supportNeeded: "Support needed",
  placementConsent: "Placement support",
  guardianName: "S/o, D/o",
  courseSemester: "Course & semester",
  noPlacementReason: "Reason for opting out",
  entrepreneurInterest: "Interested in entrepreneurship",
  entrepreneurStage: "Entrepreneurship stage",
  entrepreneurAreas: "Areas of interest",
  entrepreneurOther: "Other area",
  higherEdInterest: "Interested in higher education",
  higherEdDegree: "Degree planned",
  higherEdLocation: "Study location",
  higherEdCountry: "Country",
  higherEdExams: "Entrance exams",
  higherEdHelp: "Help needed for",
  higherEdOther: "Other requirement",
  areas: "Areas where help is sought",
  description: "Concern in the student's words",
  urgency: "How soon support is wanted",
  mode: "Preferred mode",
  preferredTime: "Preferred time",
  referral: "Raised through",
  referrerName: "Referring person",
  consent: "Confidentiality consent",
  issues: "Issues reviewed",
  previousMeetingDate: "Previous meeting date",
  reviewDate: "Review meeting date",
  actionReview: "Review of earlier action points",
  evidence: "Evidence of progress",
  evidenceOther: "Other evidence",
  fbGoalProgress: "Has the mentor helped move toward goals",
  fbSatisfied: "Satisfied with progress so far",
  fbImprovement: "Improvement noticed by the student",
  fbUnresolved: "Still unresolved",
  fbSupportNeeded: "Additional support the student needs",
  asRegularity: "Regularity in classes / meetings",
  asFollowThrough: "Follow-through on instructions",
  asOwnership: "Ownership of the action plan",
  asImprovement: "Improvement since last meeting",
  asStricterMonitoring: "Needs stricter monitoring",
  issueStatus: "Issue status",
  continueWithMentor: "Continue with mentor only",
  needsEscalation: "Needs escalation to Career Zone coordinator",
  actionPlan: "Revised action plan",
  nextReviewDate: "Next review date",
  decision: "Decision",
  escalatedTo: "Escalated / referred to",
  mentorRemarks: "Mentor's remarks"
};

/* ---------- hydration -------------------------------------------------
   Pages declare repeated controls as empty divs:
     <div data-checks="challenges" data-name="challenges"></div>
     <div data-radios="mode" data-options="__MODES__"></div>
   and this fills them in from the lists above. */

const CHECK_SETS = {
  challenges: CHALLENGES,
  supportNeeded: SUPPORT_NEEDED,
  counsellingAreas: COUNSELLING_AREAS,
  entrepreneurAreas: ENTREPRENEURSHIP_AREAS,
  higherEdHelp: HIGHER_ED_HELP,
  mentorIssues: MENTOR_ISSUES,
  evidence: EVIDENCE
};

const OPTION_TOKENS = {
  __URGENCY__: URGENCY,
  __MODES__: MODES,
  __REFERRAL__: REFERRAL_SOURCES,
  __NO_PLACEMENT__: NO_PLACEMENT_REASONS
};

export function hydrateControls(root = document) {
  root.querySelectorAll("[data-checks]").forEach((host) => {
    const options = CHECK_SETS[host.dataset.checks] || [];
    host.innerHTML = checkGroup(host.dataset.name || host.dataset.checks, options);
  });
  root.querySelectorAll("[data-radios]").forEach((host) => {
    const raw = host.dataset.options || "";
    const options = OPTION_TOKENS[raw] || raw.split("|").filter(Boolean);
    host.innerHTML = radioGroup(host.dataset.radios, options, "", host.dataset.required === "1");
  });
  const edu = root.querySelector("#eduTable");
  if (edu) edu.innerHTML = eduTable();
  const rank = root.querySelector("#rankTable");
  if (rank) rank.innerHTML = rankTable();
}

/* Renders the 3-row action plan grid used by the mentor form. */
export function actionPlanTable(rows = 3, existing = []) {
  const body = Array.from({ length: rows }, (_, i) => {
    const r = existing[i] || {};
    return `<tr>
      <th scope="row" style="font-family:var(--mono);font-size:.7rem;color:var(--muted)">${i + 1}</th>
      <td><input type="text" name="ap_${i}_outcome" value="${esc(r.outcome || "")}" placeholder="Expected outcome"></td>
      <td><select name="ap_${i}_owner">
            <option value="">—</option>
            <option ${r.owner === "Student" ? "selected" : ""}>Student</option>
            <option ${r.owner === "Mentor" ? "selected" : ""}>Mentor</option>
            <option ${r.owner === "Student & Mentor" ? "selected" : ""}>Student &amp; Mentor</option>
          </select></td>
      <td><input type="date" name="ap_${i}_target" value="${esc(r.target || "")}"></td>
      <td><input type="text" name="ap_${i}_support" value="${esc(r.support || "")}" placeholder="Support from institute"></td>
    </tr>`;
  }).join("");
  return `<div class="table-scroll"><table class="grid-table">
    <thead><tr><th></th><th>Expected outcome</th><th>To be done by</th><th>Target date</th><th>Support needed</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

/* Pulls ap_0_* / ap_1_* … back out of a submitted form into an array. */
export function readActionPlan(data, rows = 3) {
  const plan = [];
  for (let i = 0; i < rows; i++) {
    const row = {
      outcome: data[`ap_${i}_outcome`] || "",
      owner: data[`ap_${i}_owner`] || "",
      target: data[`ap_${i}_target`] || "",
      support: data[`ap_${i}_support`] || ""
    };
    delete data[`ap_${i}_outcome`]; delete data[`ap_${i}_owner`];
    delete data[`ap_${i}_target`]; delete data[`ap_${i}_support`];
    if (row.outcome || row.owner || row.target || row.support) plan.push(row);
  }
  return plan;
}

export function actionPlanView(plan = []) {
  if (!plan.length) return "<p class='muted small'>No action plan recorded.</p>";
  return `<div class="table-scroll"><table class="grid-table">
    <thead><tr><th>Expected outcome</th><th>Owner</th><th>Target date</th><th>Support</th></tr></thead>
    <tbody>${plan.map((r) => `<tr>
      <td>${esc(r.outcome)}</td><td>${esc(r.owner)}</td><td>${esc(r.target)}</td><td>${esc(r.support)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}
