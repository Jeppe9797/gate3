// app.js
// Applikationens "hjerne". Bindeleddet mellem UI, data og logik.

import { db, auth } from "./config.js";
import {
  onSnapshot,
  doc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import * as Data from "./data.js";
import * as UI from "./ui.js";
import * as Utils from "./utils.js";

// Applikationens centrale tilstand (state)
const state = {
  currentGuardId: null, // F.eks. "Guard 1"
  allGates: [], // Rå liste af gates fra Firestore
  takenGuards: [], // Liste over optagne vagt-roller
  activeTimers: {}, // Holder styr på aktive overvågningstimere
  isMuted: false, // Om notifikationslyde er slået fra
  unsubscribe: null, // Funktion til at stoppe Firestore-lytteren
};

// --- ACTION HANDLERS (Hvad sker der, når man klikker?) ---

/**
 * Håndterer klik på "Tildel til Mig". Bruger en transaktion for sikkerhed. (§10)
 * @param {string} gateId
 */
async function handleTagGate(gateId) {
  try {
    await Data.tagGate(gateId, state.currentGuardId);
    UI.hideGateDetailsModal();
  } catch (error) {
    alert(error.message); // Vis fejl til brugeren, f.eks. "Gaten er allerede taget"
  }
}

/**
 * Håndterer klik på "Start Overvågning Nu".
 * @param {string} gateId
 */
async function handleStartMonitor(gateId) {
  const gate = state.allGates.find((g) => g.id === gateId);
  if (!gate) return;

  const updates = {
    status: "green",
    monitor_start: serverTimestamp(), // Brug serverens tid for nøjagtighed
    history: Data.arrayUnion({
      timestamp: new Date(),
      event: `Overvågning startet af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  playSound();
  UI.hideGateDetailsModal();
}

/**
 * Håndterer skift fra en ventende arrival (gul) til en aktiv departure (grøn). (§15)
 * @param {string} gateId
 */
async function handleSwitchToDeparture(gateId) {
  const updates = {
    status: "green",
    type: "DEP", // Skift gate-type
    monitor_start: serverTimestamp(), // Nulstil timeren
    history: Data.arrayUnion({
      timestamp: new Date(),
      event: `Skiftet til Departure af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  UI.hideGateDetailsModal();
}

/**
 * Håndterer klik på "+5 minutter". (§15)
 * @param {string} gateId
 */
async function handleAdd5Minutes(gateId) {
  const gate = state.allGates.find((g) => g.id === gateId);
  // Dette er en avanceret handling. En simpel løsning er at opdatere sluttidspunktet.
  // Vi antager et felt 'monitor_stop_expected' som opdateres.
  const newStopTime = new Date(
    state.activeTimers[gateId].stopTime.getTime() + 5 * 60 * 1000,
  );

  const updates = {
    monitor_stop_expected: newStopTime, // Fiktivt felt for at illustrere
    history: Data.arrayUnion({
      timestamp: new Date(),
      event: `+5 minutter tilføjet af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  UI.hideGateDetailsModal();
}

/**
 * Håndterer klik på "Markér Færdig".
 * @param {string} gateId
 */
async function handleMarkAsFinished(gateId) {
  const updates = {
    status: "red",
    monitor_stop: serverTimestamp(),
    responsible_guard: null, // Frigiv gaten
    history: Data.arrayUnion({
      timestamp: new Date(),
      event: `Overvågning afsluttet af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  UI.hideGateDetailsModal();
}

/**
 * Håndterer klik på "Afgiv Gate".
 * @param {string} gateId
 */
async function handleReleaseGate(gateId) {
  const updates = {
    status: "gray", // Sæt tilbage til planlagt status
    responsible_guard: null,
    history: Data.arrayUnion({
      timestamp: new Date(),
      event: `Gate frigivet af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  UI.hideGateDetailsModal();
}

// --- TIMER LOGIK (§7) ---

/**
 * Hoved-loop, der kører hvert sekund for at opdatere timere.
 */
function mainTimerLoop() {
  setInterval(() => {
    const now = Date.now();
    let needsUIRender = false;

    for (const gateId in state.activeTimers) {
      const timer = state.activeTimers[gateId];
      const remaining = Math.max(0, Math.round((timer.stopTime - now) / 1000));

      if (timer.remaining !== remaining) {
        timer.remaining = remaining;
        needsUIRender = true;

        // Håndter automatisk skift fra grøn/arrival -> gul (§7, §15)
        if (
          remaining === 0 &&
          timer.status === "green" &&
          timer.type === "ARR"
        ) {
          console.log(
            `Gate ${gateId} (ARR) er løbet tør for tid. Skifter til gul.`,
          );
          Data.opdaterGate(gateId, {
            status: "yellow",
            history: Data.arrayUnion({
              timestamp: new Date(),
              event: "Automatisk skift til GUL status (afventer departure).",
            }),
          });
          // Timeren stoppes automatisk, da gaten ikke længere er 'green'
        }
      }
    }

    // For at undgå at opdatere DOM'en konstant, gør vi det kun, hvis en timer har ændret sig.
    if (needsUIRender) {
      renderMainView();
    }
  }, 1000);
}

/**
 * Opdaterer listen over, hvilke timere der skal være aktive.
 */
function updateActiveTimers() {
  const now = Date.now();
  const activeGateIds = new Set();

  state.allGates.forEach((gate) => {
    // En timer er kun aktiv, hvis gaten er 'green' og har en starttid.
    if (gate.status === "green" && gate.monitor_start) {
      activeGateIds.add(gate.id);

      if (!state.activeTimers[gate.id]) {
        // Ny aktiv timer
        const startTime = gate.monitor_start.toDate().getTime();
        const duration = (gate.type === "ARR" ? 25 : 30) * 60 * 1000; // 25 min for ARR, 30 for DEP
        const stopTime = startTime + duration;

        state.activeTimers[gate.id] = {
          stopTime: stopTime,
          remaining: Math.round((stopTime - now) / 1000),
          status: "green",
          type: gate.type,
        };
      }
    }
  });

  // Fjern timere for gates, der ikke længere er aktive
  for (const gateId in state.activeTimers) {
    if (!activeGateIds.has(gateId)) {
      delete state.activeTimers[gateId];
    }
  }
}

// --- DATA & RENDERING ---

/**
 * Central funktion, der kaldes, hver gang data fra Firestore opdateres. (§12)
 * @param {Array<object>} gates
 */
function onGatesUpdate(gates) {
  state.allGates = gates;

  // Find ud af, hvilke vagt-roller der er taget
  state.takenGuards = gates
    .filter((g) => g.responsible_guard)
    .map((g) => g.responsible_guard);

  // Opdater UI for valg af vagt
  if (!state.currentGuardId) {
    UI.updateGuardSelectionUI(state.takenGuards);
  }

  // Opdater de aktive timere baseret på ny data
  updateActiveTimers();

  // Gen-tegn hovedvisningen
  renderMainView();
}

/**
 * Sorterer og tegner gate-listen.
 */
function renderMainView() {
  if (!state.currentGuardId) return; // Tegn intet, hvis ingen er logget ind

  const sortedGates = Utils.sorterGatesForOvervaagning(
    state.allGates,
    state.currentGuardId,
  );
  UI.renderOvervaagningList(
    sortedGates,
    state.currentGuardId,
    state.activeTimers,
  );
}

/**
 * Afspiller en kort notifikationslyd, hvis ikke mutet. (§6)
 */
function playSound() {
  if (!state.isMuted) {
    const sound = document.getElementById("notification-sound");
    sound.play().catch((e) => console.warn("Lyd kunne ikke afspilles:", e));
  }
}

// --- INITIALISERING & EVENT LISTENERS ---

function init() {
  console.log("GateMonitor starter...");

  // Lyt til alle klik i app'en fra ét centralt sted
  document.body.addEventListener("click", async (e) => {
    const guardButton = e.target.closest(".guard-button");
    const gateCard = e.target.closest(".gate-card");
    const modalAction = e.target.closest("[data-action]");
    const closeModal =
      e.target.closest(".modal-close-button") ||
      e.target.classList.contains("modal-overlay");
    const muteButton = e.target.closest("#mute-button");
    const tabButton = e.target.closest(".tab-button"); // <-- ÆNDRING 1
    const resetButton = e.target.closest("#reset-all-button");

    if (guardButton) {
      state.currentGuardId = guardButton.dataset.guardId;
      UI.showMainApp(state.currentGuardId);
      renderMainView();
    } else if (modalAction) {
      const action = modalAction.dataset.action;

      // Logik for at håndtere den nye redigeringsformular
      if (action === "save-changes") {
        const form = document.getElementById("edit-gate-form");
        const gateId = document.querySelector(".modal-content .gate-name")
          .dataset.gateId;

        const newGuard = form.querySelector("#gate-guard").value;
        const newTimeValue = form.querySelector("#gate-time").value;

        const updatedData = {
          // Konverter den lokale tid tilbage til et rigtigt JS Date-objekt
          scheduled_time: newTimeValue ? new Date(newTimeValue) : null,
          responsible_guard: newGuard === "null" ? null : newGuard,
          status: form.querySelector("#gate-status").value,
        };

        await Data.opdaterGate(gateId, updatedData);
        UI.hideGateDetailsModal();
        return; // Stop videre behandling
      }

      if (action === "cancel-edit") {
        UI.hideGateDetailsModal();
        return;
      }

      const gateNameElement = document.querySelector(
        ".modal-content .gate-name",
      );
      if (!gateNameElement) return;

      const gateId = gateNameElement.textContent.toLowerCase();

      const actions = {
        "tag-gate": handleTagGate,
        "start-monitor": handleStartMonitor,
        "skift-til-departure": handleSwitchToDeparture,
        "add-5-min": handleAdd5Minutes,
        "markoer-faerdig": handleMarkAsFinished,
        "afgiv-gate": handleReleaseGate,
        slet: () => {
          if (confirm("Er du sikker?")) {
            alert("Slet-funktion ikke implementeret.");
            UI.hideGateDetailsModal();
          }
        },
      };

      if (actions[action]) {
        await actions[action](gateId);
      }
    } else if (closeModal) {
      UI.hideGateDetailsModal();
    } else if (muteButton) {
      state.isMuted = !state.isMuted;
      UI.setMuteButtonState(state.isMuted);
    } else if (resetButton) {
      const confirmed = confirm(
        "Er du sikker på, at du vil nulstille ALLE gates? Dette fjerner alle vagttildelinger og aktive overvågninger.",
      );
      if (confirmed) {
        try {
          const count = await Data.nulstilAlleGates();
          alert(`${count} gates blev succesfuldt nulstillet.`);
        } catch (error) {
          alert("Der opstod en fejl under nulstilling.");
          console.error("Fejl ved nulstilling af gates:", error);
        }
      }
    } else if (tabButton) {
      UI.switchTab(tabButton.id);
      if (tabButton.id === "nav-gates") {
        UI.renderGatesDashboard(state.allGates);
      }
    } else if (gateCard) {
      // TEST 1: Finder den overhovedet et gate-kort?
      console.log("✅ TRIN 1: Gate-kort fundet!", gateCard);

      const gateId = gateCard.dataset.gateId;
      // TEST 2: Kan den læse gate-id'et fra kortet?
      console.log("... TRIN 2: Gate ID læst fra kortet:", gateId);

      const gate = state.allGates.find((g) => g.id === gateId);
      // TEST 3: Kan den finde den tilsvarende gate i vores data?
      console.log("... TRIN 3: Gate-objekt fundet i data:", gate);

      const isGatesTabActive = document
        .getElementById("nav-gates")
        .classList.contains("active");
      // TEST 4: Ved den, om vi er i redigeringstilstand?
      console.log("... TRIN 4: Er 'Gates'-fanen aktiv?", isGatesTabActive);

      if (gate) {
        // TEST 5: Forsøger den at kalde funktionen, der viser menuen?
        console.log("🚀 TRIN 5: Kalder UI.showGateDetailsModal nu...");
        UI.showGateDetailsModal(
          gate,
          state.currentGuardId,
          state.activeTimers,
          isGatesTabActive,
        );
      } else {
        console.error(
          "❌ FEJL: Kunne ikke kalde showGateDetailsModal, fordi gate-objektet var 'null' eller 'undefined'.",
        );
      }
    }
  });

  // Start realtids-lytteren til Firestore (§8)
  state.unsubscribe = Data.observerGates(onGatesUpdate);

  // Start den globale timer-loop
  mainTimerLoop();

  // Lyt til online/offline status (§9)
  window.addEventListener("online", () => UI.updateOfflineStatus(false));
  window.addEventListener("offline", () => UI.updateOfflineStatus(true));
  if (!navigator.onLine) {
    UI.updateOfflineStatus(true);
  }
}

// Start hele applikationen, når DOM er klar
document.addEventListener("DOMContentLoaded", init);
