import { initializeApp } from "firebase/app";

export const firebaseConfig = {
  apiKey: "AIzaSyCDhwSCOBWd4CRYXZi0d5RbAnm9UxX4myQ",
  authDomain: "gj-career-zone-a7424.firebaseapp.com",
  projectId: "gj-career-zone-a7424",
  storageBucket: "gj-career-zone-a7424.firebasestorage.app",
  messagingSenderId: "993552987589",
  appId: "1:993552987589:web:7ad12b27e3a880aa5447ac"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

export const INSTITUTE = {
  name: "Gian Jyoti Institute of Management and Technology",
  short: "GJIMT",
  unit: "GJ Career Zone",
  address: "Phase-2, Mohali, Sector-54, Chandigarh, Punjab 160055, India",
  phone: "9914433199, 0172-2264566",
  email: "gjimt@gjimt.com",
  website: "https://www.gjimt.ac.in",

  crisisNote:
    "If you need help right now and cannot wait for an appointment, contact the campus counsellor or Tele-MANAS on 14416 (toll free, 24x7)."
};