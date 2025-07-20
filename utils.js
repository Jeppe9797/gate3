// utils.js
// Indeholder generelle hjælpefunktioner (værktøjer), som kan bruges på tværs af applikationen.

/**
 * Formaterer et Firestore timestamp-objekt eller et JS Date-objekt til en læselig tidsstreng (HH:mm). (§7)
 * @param {object|Date} timestamp - Firestore timestamp-objektet (med toDate() metode) eller et standard Date-objekt.
 * @returns {string} En formateret tidsstreng som "14:30" eller "Tid mangler", hvis input er ugyldigt.
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return "Tid mangler";

  // Firestore timestamps har en .toDate() metode, brug den. Ellers antag det er et Date-objekt.
  const date =
    typeof timestamp.toDate === "function" ? timestamp.toDate() : timestamp;

  if (!(date instanceof Date) || isNaN(date)) {
    return "Ugyldig tid";
  }

  // Intl.DateTimeFormat er den moderne måde at formatere datoer og tider på. (§7)
  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // Bruger 24-timers ur
  }).format(date);
}

/**
 * Sorterer en liste af gates i henhold til de specifikke regler for "Overvågning"-fanen. (§3)
 * Rækkefølge: Grøn -> Gul -> Grå -> Blå (tildelt anden vagt) -> Rød.
 * Inden for hver farvegruppe sorteres der efter planlagt starttid.
 * @param {Array<object>} gates - Den usorterede liste af gate-objekter.
 * @param {string} currentGuardId - ID'et på den nuværende aktive vagt.
 * @returns {Array<object>} Den sorterede liste af gates.
 */
export function sorterGatesForOvervaagning(gates, currentGuardId) {
  const statusOrder = {
    green: 1, // Aktivt overvåget af mig
    yellow: 2, // Venter på departure
    gray: 3, // Planlagt, ikke startet
    blue: 4, // Tildelt en anden vagt
    red: 6, // Færdig
    // Manglende/null `responsible_guard` vil blive håndteret som 5 (ledig)
  };

  const sortedGates = [...gates]; // Lav en kopi for ikke at ændre originalen

  sortedGates.sort((a, b) => {
    // Tildel en score baseret på status og om gaten er tildelt den nuværende vagt
    let scoreA = getGateScore(a, currentGuardId, statusOrder);
    let scoreB = getGateScore(b, currentGuardId, statusOrder);

    if (scoreA !== scoreB) {
      return scoreA - scoreB; // Sorter efter score først
    }

    // Hvis scoren er den samme, sorter efter planlagt tid (ældste først)
    const timeA = a.scheduled_time?.toDate() || 0;
    const timeB = b.scheduled_time?.toDate() || 0;
    return timeA - timeB;
  });

  return sortedGates;
}

/**
 * Hjælpefunktion til sortering. Beregner en gates score.
 * @param {object} gate - Gate-objektet.
 * @param {string} currentGuardId - Den aktive vagt.
 * @param {object} statusOrder - Mappet med scores.
 * @returns {number} Den beregnede score.
 */
function getGateScore(gate, currentGuardId, statusOrder) {
  // Hvis gaten er tildelt en ANDEN vagt, behandles den som "blå" i sorteringen
  if (gate.responsible_guard && gate.responsible_guard !== currentGuardId) {
    return statusOrder["blue"];
  }
  // Hvis den ikke er tildelt, er den "ledig"
  if (!gate.responsible_guard) {
    return 5; // Ledige gates (mellem blå og rød)
  }
  // Ellers, brug status fra datamodellen
  return statusOrder[gate.status] || 99; // 99 er en fallback for ukendt status
}

/**
 * Formaterer sekunder til en HH:MM:SS streng.
 * @param {number} totalSeconds - Det totale antal sekunder.
 * @returns {string} Formateret streng, f.eks. "01:05:23".
 */
export function formatSecondsToHMS(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return "00:00:00";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Sørger for at der altid er to cifre (f.eks. 01, 09)
  const pad = (num) => String(num).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
