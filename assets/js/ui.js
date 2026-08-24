/* Small DOM helpers shared by every dashboard. No framework, on purpose:
   GitHub Pages serves these files as-is, with no build step to maintain. */

import { INSTITUTE } from "./firebase-config.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- dates ---------- */
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

export function fmtDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

export function ago(value) {
  const d = toDate(value);
  if (!d) return "";
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  const steps = [[60, "s"], [60, "m"], [24, "h"], [7, "d"], [4.35, "w"]];
  let n = secs, unit = "s";
  for (const [size, label] of steps) {
    if (Math.abs(n) < size) break;
    n = Math.round(n / size);
    unit = label;
  }
  if (unit === "s") return "just now";
  return `${n}${unit} ago`;
}

/* ---------- toasts ---------- */
export function toast(message, kind = "") {
  let host = $("#toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.setAttribute("role", "status");
  t.textContent = message;
  host.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ---------- modal ---------- */
export function openModal(html, { onMount } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(backdrop);
  const modal = $(".modal", backdrop);
  if (onMount) onMount(modal, close);
  const focusable = modal.querySelector("input, select, textarea, button");
  if (focusable) focusable.focus();
  return { close, modal };
}

export function confirmAction(message, { danger = true, confirmLabel = "Confirm" } = {}) {
  return new Promise((resolve) => {
    openModal(
      `<h2>Are you sure?</h2>
       <p class="muted">${esc(message)}</p>
       <div class="modal-actions">
         <button class="btn neutral" data-close type="button">Cancel</button>
         <button class="btn ${danger ? "danger" : ""}" data-yes type="button">${esc(confirmLabel)}</button>
       </div>`,
      {
        onMount(modal, close) {
          modal.querySelector("[data-yes]").addEventListener("click", () => { close(); resolve(true); });
          modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) resolve(false); });
        }
      }
    );
  });
}

/* ---------- header ---------- */
export function renderAppbar(host, profile, { onSignOut }) {
  host.innerHTML = `
    <div class="wrap appbar-inner">
      <img class="logo" src="assets/img/logo.jpg" alt="${esc(INSTITUTE.short)} logo">
      <div class="brandline">${esc(INSTITUTE.unit)}<span>${esc(INSTITUTE.short)} counselling desk</span></div>
      <div class="spacer"></div>
      <button class="btn ghost small bell" id="bellBtn" type="button" aria-label="Notifications">
        Alerts <span class="count hidden" id="bellCount">0</span>
      </button>
      <div class="whoami">
        <strong>${esc(profile.name || profile.email)}</strong>
        <span class="role">${esc(profile.role)}</span>
      </div>
      <button class="btn neutral small" id="signOutBtn" type="button">Sign out</button>
    </div>`;
  $("#signOutBtn", host).addEventListener("click", onSignOut);
}

/* ---------- tabs ---------- */
export function wireTabs(barSelector = ".tabbar") {
  const bar = $(barSelector);
  if (!bar) return;
  const buttons = $$("button[data-tab]", bar);
  const show = (name) => {
    buttons.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    $$(".panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === name));
    if (location.hash.slice(1) !== name) history.replaceState(null, "", `#${name}`);
    window.dispatchEvent(new CustomEvent("tabchange", { detail: name }));
  };
  buttons.forEach((b) => b.addEventListener("click", () => show(b.dataset.tab)));
  const initial = location.hash.slice(1);
  show(buttons.some((b) => b.dataset.tab === initial) ? initial : buttons[0].dataset.tab);
  return show;
}

/* ---------- the record spine (signature element) ---------- */
export const STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "assigned", label: "Assigned" },
  { key: "scheduled", label: "Scheduled" },
  { key: "reviewed", label: "Reviewed" },
  { key: "closed", label: "Closed" }
];

export function spine(status, detail = {}) {
  const idx = Math.max(0, STAGES.findIndex((s) => s.key === status));
  return `<div class="spine" aria-label="Request stage: ${esc(status)}">${STAGES.map((s, i) => {
    const cls = i < idx ? "done" : i === idx ? "now" : "";
    const note = detail[s.key] ? `<span class="d">${esc(detail[s.key])}</span>` : "";
    return `<div class="seg ${cls}">${esc(s.label)}${note}</div>`;
  }).join("")}</div>`;
}

/* ---------- form helpers ---------- */
export function collectForm(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      (data[k] = data[k] || []).push(value);
    } else {
      data[key] = typeof value === "string" ? value.trim() : value;
    }
  });
  /* unchecked checkbox groups still need to exist as empty arrays */
  $$("input[type=checkbox][name$='[]']", form).forEach((cb) => {
    const k = cb.name.slice(0, -2);
    if (!data[k]) data[k] = [];
  });
  return data;
}

export function fillForm(form, data = {}) {
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      $$(`[name="${key}[]"]`, form).forEach((cb) => { cb.checked = value.includes(cb.value); });
      return;
    }
    const fields = $$(`[name="${key}"]`, form);
    fields.forEach((f) => {
      if (f.type === "checkbox") f.checked = Boolean(value);
      else if (f.type === "radio") f.checked = f.value === value;
      else f.value = value ?? "";
    });
  });
}

export function busy(button, on, labelWhenBusy = "Saving…") {
  if (!button) return;
  if (on) {
    button.dataset.label = button.textContent;
    button.textContent = labelWhenBusy;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

/* ---------- read-only rendering of a stored form ---------- */
export function prettyKey(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function dump(data, labels = {}, skip = []) {
  const hidden = new Set(["createdAt", "updatedAt", "studentId", "facultyId", "requestId", ...skip]);
  const rows = Object.entries(data)
    .filter(([k, v]) => !hidden.has(k) && v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => {
      let shown;
      if (Array.isArray(v)) shown = v.map((i) => `<span class="tag">${esc(i)}</span>`).join("");
      else if (typeof v === "object" && v.toDate) shown = esc(fmtDateTime(v));
      else if (typeof v === "object") shown = `<span class="mono">${esc(JSON.stringify(v))}</span>`;
      else shown = esc(v).replace(/\n/g, "<br>");
      return `<dt>${esc(labels[k] || prettyKey(k))}</dt><dd>${shown}</dd>`;
    })
    .join("");
  return `<dl class="dump">${rows || "<dd class='muted'>Nothing recorded.</dd>"}</dl>`;
}

export function empty(title, message, actionHtml = "") {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(message)}</p>${actionHtml}</div>`;
}
