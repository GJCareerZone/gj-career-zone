/* Single place where the Firebase SDK is loaded and initialised.
   Everything else imports auth / db from here. */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

if (firebaseConfig.apiKey.startsWith("PASTE_")) {
  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.style.cssText =
      "position:fixed;inset:0 0 auto 0;z-index:999;background:#8a1c1c;color:#fff;padding:.75rem 1rem;font:14px/1.4 system-ui";
    bar.textContent =
      "Firebase is not configured yet. Open assets/js/firebase-config.js and paste your project keys (see SETUP_MANUAL.md, step 1).";
    document.body.prepend(bar);
  });
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* Keep the student signed in when they close the tab and come back. */
setPersistence(auth, browserLocalPersistence).catch(() => {});
