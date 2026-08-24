/* Every read and write to Firestore goes through this file, so the
   collection names and the shape of a record live in exactly one place.

   Collections
   -----------
   users              one doc per person, id = auth uid, holds the role
   profilingForms     one doc per student, id = student uid
   counsellingRequests  many per student
   mentorForms        one per completed counselling session
   notifications      in-app alerts, one doc per recipient per event
   auditLogs          append-only record of who did what
*/

import { db } from "./firebase-init.js";
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const C = {
  users: "users",
  profiles: "profilingForms",
  requests: "counsellingRequests",
  mentor: "mentorForms",
  notes: "notifications",
  audit: "auditLogs"
};

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

function byNewest(list, field = "createdAt") {
  return list.sort((a, b) => {
    const at = a[field]?.toMillis ? a[field].toMillis() : new Date(a[field] || 0).getTime();
    const bt = b[field]?.toMillis ? b[field].toMillis() : new Date(b[field] || 0).getTime();
    return bt - at;
  });
}

/* ---------------- users ---------------- */
export async function listUsers(role) {
  const q = role ? query(collection(db, C.users), where("role", "==", role)) : collection(db, C.users);
  return rows(await getDocs(q)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function getUser(uid) {
  const snap = await getDoc(doc(db, C.users, uid));
  return snap.exists() ? { id: uid, ...snap.data() } : null;
}

export function updateUser(uid, patch) {
  return updateDoc(doc(db, C.users, uid), { ...patch, updatedAt: serverTimestamp() });
}

/* Removes the Firestore record only. The Authentication entry has to be
   deleted from the Firebase console — the client SDK cannot delete other
   users. Deactivating is usually the better move; it keeps the history. */
export function deleteUserRecord(uid) {
  return deleteDoc(doc(db, C.users, uid));
}

/* ---------------- profiling form ---------------- */
export function saveProfilingForm(uid, data) {
  return setDoc(
    doc(db, C.profiles, uid),
    { ...data, studentId: uid, updatedAt: serverTimestamp(), createdAt: data.createdAt || serverTimestamp() },
    { merge: true }
  );
}

export async function getProfilingForm(uid) {
  const snap = await getDoc(doc(db, C.profiles, uid));
  return snap.exists() ? { id: uid, ...snap.data() } : null;
}

export async function listProfilingForms() {
  return byNewest(rows(await getDocs(collection(db, C.profiles))), "updatedAt");
}

export function deleteProfilingForm(uid) {
  return deleteDoc(doc(db, C.profiles, uid));
}

/* ---------------- counselling requests ---------------- */
export function makeRequestId() {
  const d = new Date();
  const stamp = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CZ-${stamp}-${rand}`;
}

export async function createCounsellingRequest(profile, data) {
  const payload = {
    ...data,
    requestId: makeRequestId(),
    studentId: profile.uid,
    studentName: profile.name,
    rollNo: profile.rollNo || "",
    programme: profile.programme || "",
    yearSem: profile.yearSem || "",
    status: "submitted",
    priority: data.urgency === "Immediately (within 24-48 hours)" ? "immediate" : "routine",
    assignedFacultyId: "",
    assignedFacultyName: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(collection(db, C.requests), payload);
  return { id: ref.id, ...payload };
}

export async function listRequestsByStudent(uid) {
  return byNewest(rows(await getDocs(query(collection(db, C.requests), where("studentId", "==", uid)))));
}

export async function listRequestsByFaculty(uid) {
  return byNewest(rows(await getDocs(query(collection(db, C.requests), where("assignedFacultyId", "==", uid)))));
}

export async function listAllRequests() {
  return byNewest(rows(await getDocs(collection(db, C.requests))));
}

export async function getRequest(id) {
  const snap = await getDoc(doc(db, C.requests, id));
  return snap.exists() ? { id, ...snap.data() } : null;
}

export function updateRequest(id, patch) {
  return updateDoc(doc(db, C.requests, id), { ...patch, updatedAt: serverTimestamp() });
}

export function deleteRequest(id) {
  return deleteDoc(doc(db, C.requests, id));
}

/* ---------------- mentor–mentee review forms ---------------- */
export async function createMentorForm(data) {
  const ref = await addDoc(collection(db, C.mentor), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export function updateMentorForm(id, patch) {
  return updateDoc(doc(db, C.mentor, id), { ...patch, updatedAt: serverTimestamp() });
}

export async function listMentorForms(filter = {}) {
  let q = collection(db, C.mentor);
  if (filter.studentId) q = query(q, where("studentId", "==", filter.studentId));
  else if (filter.facultyId) q = query(q, where("facultyId", "==", filter.facultyId));
  else if (filter.requestDocId) q = query(q, where("requestDocId", "==", filter.requestDocId));
  return byNewest(rows(await getDocs(q)));
}

export function deleteMentorForm(id) {
  return deleteDoc(doc(db, C.mentor, id));
}

/* ---------------- notifications ---------------- */
export function notify(toUid, { title, message, link = "", kind = "info" }) {
  if (!toUid) return Promise.resolve();
  return addDoc(collection(db, C.notes), {
    toUid, title, message, link, kind, read: false, createdAt: serverTimestamp()
  });
}

export async function listNotifications(uid) {
  return byNewest(rows(await getDocs(query(collection(db, C.notes), where("toUid", "==", uid)))));
}

export function markNotificationRead(id) {
  return updateDoc(doc(db, C.notes, id), { read: true });
}

export async function markAllNotificationsRead(uid) {
  const list = await listNotifications(uid);
  await Promise.all(list.filter((n) => !n.read).map((n) => markNotificationRead(n.id)));
}

/* ---------------- audit trail ---------------- */
export function audit(actor, action, entity, entityId, details = "") {
  return addDoc(collection(db, C.audit), {
    actorId: actor.uid,
    actorName: actor.name || actor.email,
    actorRole: actor.role,
    action, entity, entityId, details,
    at: serverTimestamp()
  }).catch(() => {}); /* an audit failure must never block the user's action */
}

export async function listAudit() {
  return byNewest(rows(await getDocs(collection(db, C.audit))), "at");
}
