// config.js

// Importer de nødvendige funktioner fra Firebase SDK'erne
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Din web-apps Firebase konfiguration, som du har angivet
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

// Initialiser services og eksporter dem, så andre filer kan importere dem
export const db = getFirestore(app);
export const auth = getAuth(app);

// Aktiver offline data-cache (§9)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == "failed-precondition") {
    console.warn(
      "Firestore: Multiple tabs open, persistence may not be enabled.",
    );
  } else if (err.code == "unimplemented") {
    console.warn("Firestore: Browser does not support offline persistence.");
  }
});

console.log("Firebase (v9 modular) initialiseret.");
