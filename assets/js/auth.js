/* Sign-in, sign-up, role lookup and page guards.

   Roles
   -----
   student : self-registers on the landing page
   faculty : created by an admin only (see createFacultyAccount below)
   admin   : created by promoting a user in the Firebase console
             (SETUP_MANUAL.md, step 6) or by an existing admin
*/

import { auth, db } from "./firebase-init.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export const HOME_FOR = { student: "student.html", faculty: "faculty.html", admin: "admin.html" };

export function currentUser() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => { stop(); resolve(user); });
  });
}

export async function loadProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/* Blocks the page until a signed-in user with one of `roles` is present.
   Anyone else is bounced to the landing page. */
export async function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await currentUser();
  if (!user) { location.replace("index.html"); return new Promise(() => {}); }
  const profile = await loadProfile(user.uid);
  if (!profile || !allowed.includes(profile.role)) {
    if (profile && HOME_FOR[profile.role]) location.replace(HOME_FOR[profile.role]);
    else { await signOut(auth); location.replace("index.html"); }
    return new Promise(() => {});
  }
  if (profile.active === false) {
    await signOut(auth);
    alert("This account has been deactivated. Please contact the Career Zone office.");
    location.replace("index.html");
    return new Promise(() => {});
  }
  return profile;
}

export async function registerStudent({ name, email, password, rollNo, programme, yearSem, phone }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    role: "student",
    name, email, rollNo, programme, yearSem, phone,
    active: true,
    profileComplete: false,
    createdAt: serverTimestamp()
  });
  return cred.user;
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await loadProfile(cred.user.uid);
  if (!profile) {
    await signOut(auth);
    throw new Error("No role is attached to this account yet. Please contact the Career Zone office.");
  }
  if (profile.active === false) {
    await signOut(auth);
    throw new Error("This account has been deactivated. Please contact the Career Zone office.");
  }
  return profile;
}

export function logout() {
  return signOut(auth).then(() => location.replace("index.html"));
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

/* Creating a faculty account from the admin dashboard.

   createUserWithEmailAndPassword() signs the new user in on whichever
   Firebase app instance you call it on — which would kick the admin out
   of their own session. So we spin up a throwaway second app instance,
   create the account there, write the Firestore user document with the
   admin's still-live session, then discard the instance. This keeps the
   whole thing on the free Spark plan; no Cloud Functions needed. */
export async function createFacultyAccount({ name, email, password, department, designation, phone }) {
  const tempApp = initializeApp(firebaseConfig, `faculty-maker-${Date.now()}`);
  const tempAuth = getAuth(tempApp);
  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      role: "faculty",
      name, email, department, designation, phone,
      active: true,
      createdAt: serverTimestamp()
    });
    await signOut(tempAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(tempApp).catch(() => {});
  }
}

/* Firebase error codes are not fit to show a student. */
export function readableAuthError(error) {
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account exists for that email.",
    "auth/wrong-password": "Wrong password. Try again or reset it.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for that email.",
    "auth/weak-password": "Use a password of at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "Network unavailable. Check your connection.",
    "permission-denied": "Your account doesn't have permission for that action."
  };
  return map[error?.code] || error?.message || "Something went wrong. Try again.";
}
