// config.js

// Importer de nødvendige funktioner fra Firebase SDK'erne
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getFirestore,
  enableMultiTabIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Din web-apps Firebase konfiguration
const firebaseConfig = {
  apiKey: "AIzaSyD9UCDk_Hal2aFb4zCPwpRrRfhUJNO5ikk",
  authDomain: "gate2-6e27e.firebaseapp.com",
  projectId: "gate2-6e27e",
  storageBucket: "gate2-6e27e.appspot.com",
  messagingSenderId: "710798582029",
  appId: "1:710798582029:web:544d3e7f4a5db19516d044",
  measurementId: "G-6N8257Z6JX",
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser services og eksporter dem
export const db = getFirestore(app);
export const auth = getAuth(app);

// Aktiver offline data-cache MED multi-fane synkronisering
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code == "failed-precondition") {
    console.warn("Firestore: Kunne ikke aktivere multi-fane synkronisering.");
  } else if (err.code == "unimplemented") {
    console.warn(
      "Firestore: Browseren understøtter ikke de nødvendige offline-funktioner.",
    );
  }
});

console.log(
  "Firebase (v9 modular) initialiseret med multi-fane synkronisering.",
);
