// js/seed.js
// Et script til at "seede" databasen med start-gates. Kør det én gang.

import { db } from "./config.js";
import {
  collection,
  getDocs,
  addDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Listen over alle gate-navne du har angivet
const gateNames = [
  "A4",
  "A6",
  "A7",
  "A8",
  "A9",
  "A10",
  "A11",
  "A12",
  "A13",
  "A14",
  "A15",
  "A16",
  "A17",
  "A18",
  "A19",
  "A20",
  "A21",
  "A22",
  "A23",
  "A24",
  "A25",
  "A26",
  "A27",
  "A30",
  "B4",
  "B5",
  "B6",
  "B7",
  "B8",
  "B9",
  "B10",
  "B15",
  "B19",
  "C26",
  "C27",
  "C30",
  "D1",
  "D2",
  "D3",
  "D4",
  "E20",
  "E22",
  "E24",
];

async function seedDatabase() {
  const gatesCollection = collection(db, "gates");

  // Tjek først om collection allerede har dokumenter, så vi ikke tilføjer duplikater
  const snapshot = await getDocs(gatesCollection);
  if (!snapshot.empty) {
    console.log("Databasen ser allerede ud til at have gates. Seeding aflyst.");
    alert("Databasen har allerede gates. Scriptet blev ikke kørt.");
    return;
  }

  console.log("Starter seeding af databasen med gates...");
  let gatesAdded = 0;

  // Loop igennem hvert gate-navn og opret et dokument for det
  for (const [index, name] of gateNames.entries()) {
    // Skab en dynamisk planlagt tid, så de ikke alle er ens
    const futureTime = new Date();
    futureTime.setHours(futureTime.getHours() + 1 + index); // Spreder dem ud over de næste par timer
    futureTime.setMinutes(Math.floor(Math.random() * 60)); // Tilfældigt minut

    const newGate = {
      gate_id: name,
      type: "ARR", // Default type
      status: "gray", // Default status: planlagt
      scheduled_time: Timestamp.fromDate(futureTime),
      responsible_guard: null,
      screen: null,
      history: [],
    };

    try {
      await addDoc(gatesCollection, newGate);
      gatesAdded++;
    } catch (error) {
      console.error(`Fejl ved tilføjelse af gate ${name}:`, error);
    }
  }

  console.log(
    `Færdig med seeding! ${gatesAdded} gates blev tilføjet til Firestore.`,
  );
  alert(`Færdig! ${gatesAdded} gates blev tilføjet til din database.`);
}

// Gør funktionen globalt tilgængelig, så vi kan kalde den fra en knap
window.seedDatabase = seedDatabase;
