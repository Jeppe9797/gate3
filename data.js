// data.js
// Håndterer al kommunikation med Firestore databasen.

// Importer de nødvendige funktioner fra config.js og Firestore SDK
import { db } from "./config.js";
import {
  collection,
  onSnapshot,
  doc,
  runTransaction,
  getDocs,
  updateDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

/**
 * Lytter til ændringer i 'gates' collection i realtid. (§1, §12)
 * Hver gang data ændres i Firestore, bliver callback-funktionen kaldt med de nye data.
 * @param {function} callback - En funktion, der skal køres, når gate-data opdateres. Modtager en liste af gates.
 * @returns {function} En unsubscribe-funktion til at stoppe lytteren.
 */
export function observerGates(callback) {
  const gatesCollection = collection(db, "gates");

  // onSnapshot er Firestores realtids-lytter
  const unsubscribe = onSnapshot(gatesCollection, (snapshot) => {
    const gates = [];
    snapshot.forEach((doc) => {
      gates.push({ id: doc.id, ...doc.data() });
    });
    callback(gates);
  });

  return unsubscribe;
}

/**
 * Forsøger at tildele ansvaret for en gate til en vagt vha. en transaktion. (§10)
 * Dette sikrer, at to vagter ikke kan tage den samme gate samtidigt.
 * @param {string} gateId - ID'et på den gate, der skal tages.
 * @param {string} guardId - ID'et på vagten (f.eks. "Guard 1").
 * @returns {Promise<void>} Et promise, der resolver, hvis det lykkes, og rejecter, hvis gaten er taget.
 */
export async function nulstilAlleGates() {
  const gatesCollection = collection(db, "gates");
  const snapshot = await getDocs(gatesCollection);

  if (snapshot.empty) {
    console.log("Ingen gates fundet at nulstille.");
    return 0;
  }

  const resetData = {
    status: "gray",
    responsible_guard: null,
    monitor_start: null,
    monitor_stop: null,
    screen: null,
    // Vi nulstiller IKKE scheduled_time eller history
  };

  // Loop igennem alle dokumenter og opdater dem
  const updatePromises = [];
  snapshot.forEach((doc) => {
    updatePromises.push(updateDoc(doc.ref, resetData));
  });

  // Vent på at alle opdateringer er færdige
  await Promise.all(updatePromises);

  console.log(`${snapshot.size} gates blev nulstillet.`);
  return snapshot.size;
}

/**
 * Opdaterer data for en specifik gate. (§5)
 * Bruges til handlinger som "Markér færdig", "Skift skærm", osv.
 * @param {string} gateId - ID'et på den gate, der skal opdateres.
 * @param {object} updateData - Et objekt med de felter, der skal opdateres.
 */
export async function opdaterGate(gateId, updateData) {
  const gateRef = doc(db, "gates", gateId);
  try {
    await updateDoc(gateRef, updateData);
  } catch (error) {
    console.error(`Fejl ved opdatering af gate ${gateId}:`, error);
    throw error; // Videresend til UI
  }
}

/**
 * Logger en hændelse til en gates historik-array.
 * @param {string} gateId - ID'et på gaten.
 * @param {string} eventMessage - Beskeden, der skal logges.
 */
export async function logHistorik(gateId, eventMessage) {
  const gateRef = doc(db, "gates", gateId);
  try {
    const logEntry = {
      timestamp: new Date(), // Firestore Timestamps er bedre, men JS Date er simplere her
      event: eventMessage,
    };
    await updateDoc(gateRef, {
      history: arrayUnion(logEntry),
    });
  } catch (error) {
    console.error(`Kunne ikke logge historik for gate ${gateId}:`, error);
  }
}
