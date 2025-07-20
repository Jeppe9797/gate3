// app.js
// Applikationens "hjerne". Bindeleddet mellem UI, data og logik.

import { db, auth } from "./config.js";
import {
  serverTimestamp,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import * as Data from "./data.js";
import * as UI from "./ui.js";
import * as Utils from "./utils.js";

// Applikationens centrale tilstand (state)
const state = {
  currentGuardId: null,
  allGates: [],
  takenGuards: [],
  activeTimers: {},
  isMuted: false,
  unsubscribe: null,
};

// --- ACTION HANDLERS ---
async function handleTagGate(gateId) {
  try {
    await Data.tagGate(gateId, state.currentGuardId);
    UI.hideGateDetailsModal();
  } catch (error) {
    alert(error.message);
  }
}
async function handleStartMonitor(gateId) {
  const gate = state.allGates.find((g) => g.id === gateId);
  if (!gate) return;
  const updates = {
    status: "green",
    monitor_start: serverTimestamp(),
    history: arrayUnion({
      timestamp: new Date(),
      event: `Overvågning startet af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  playSound();
  UI.hideGateDetailsModal();
}
async function handleSwitchToDeparture(gateId) {
  const updates = {
    status: "green",
    type: "DEP",
    monitor_start: serverTimestamp(),
    history: arrayUnion({
      timestamp: new Date(),
      event: `Skiftet til Departure af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  UI.hideGateDetailsModal();
}
async function handleAdd5Minutes(gateId) {
  const gate = state.allGates.find((g) => g.id === gateId);
  if (!gate || !state.activeTimers[gateId]) return;
  const newStopTime = new Date(
    state.activeTimers[gateId].stopTime.getTime() + 5 * 60 * 1000,
  );
  const updates = {
    monitor_stop_expected: newStopTime,
    history: arrayUnion({
      timestamp: new Date(),
      event: `+5 minutter tilføjet af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  UI.hideGateDetailsModal();
}
async function handleMarkAsFinished(gateId) {
  const updates = {
    status: "red",
    monitor_stop: serverTimestamp(),
    responsible_guard: null,
    history: arrayUnion({
      timestamp: new Date(),
      event: `Overvågning afsluttet af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  UI.hideGateDetailsModal();
}
async function handleReleaseGate(gateId) {
  const updates = {
    status: "gray",
    responsible_guard: null,
    history: arrayUnion({
      timestamp: new Date(),
      event: `Gate frigivet af ${state.currentGuardId}`,
    }),
  };
  await Data.opdaterGate(gateId, updates);
  UI.hideGateDetailsModal();
}

// --- TIMER & DATA LOGIK ---
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
        if (
          remaining === 0 &&
          timer.status === "green" &&
          timer.type === "ARR"
        ) {
          Data.opdaterGate(gateId, {
            status: "yellow",
            history: arrayUnion({
              timestamp: new Date(),
              event: "Automatisk skift til GUL status (afventer departure).",
            }),
          });
        }
      }
    }
    if (needsUIRender) renderMainView();
  }, 1000);
}
function updateActiveTimers() {
  const now = Date.now();
  const activeGateIds = new Set();
  state.allGates.forEach((gate) => {
    if (gate.status === "green" && gate.monitor_start) {
      activeGateIds.add(gate.id);
      if (!state.activeTimers[gate.id]) {
        const startTime = gate.monitor_start.toDate().getTime();
        const duration = (gate.type === "ARR" ? 25 : 30) * 60 * 1000;
        const stopTime = startTime + duration;
        state.activeTimers[gate.id] = {
          stopTime,
          remaining: Math.round((stopTime - now) / 1000),
          status: "green",
          type: gate.type,
        };
      }
    }
  });
  for (const gateId in state.activeTimers) {
    if (!activeGateIds.has(gateId)) delete state.activeTimers[gateId];
  }
}
function onGatesUpdate(gates) {
  state.allGates = gates;
  state.takenGuards = gates
    .filter((g) => g.responsible_guard)
    .map((g) => g.responsible_guard);
  if (!state.currentGuardId) UI.updateGuardSelectionUI(state.takenGuards);
  updateActiveTimers();
  renderMainView();
}
function renderMainView() {
  if (!state.currentGuardId) return;
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
function playSound() {
  if (!state.isMuted)
    document.getElementById("notification-sound").play().catch(console.warn);
}

// --- INITIALISERING & EVENT LISTENERS ---
function init() {
  console.log("GateMonitor starter...");

  document.body.addEventListener("click", async (e) => {
    const guardButton = e.target.closest(".guard-button");
    const gateCard = e.target.closest(".gate-card");
    const modalAction = e.target.closest("[data-action]");
    const tabButton = e.target.closest(".tab-button");
    const resetButton = e.target.closest("#reset-all-button");
    const muteButton = e.target.closest("#mute-button");
    const closeModal =
      e.target.closest(".modal-close-button") ||
      e.target.classList.contains("modal-overlay");

    if (guardButton) {
      state.currentGuardId = guardButton.dataset.guardId;
      UI.showMainApp(state.currentGuardId);
      renderMainView();
    } else if (gateCard) {
      const gateId = gateCard.dataset.gateId;
      const gate = state.allGates.find((g) => g.id === gateId);
      const isGatesTabActive = document
        .getElementById("nav-gates")
        .classList.contains("active");
      if (gate)
        UI.showGateDetailsModal(
          gate,
          state.currentGuardId,
          state.activeTimers,
          isGatesTabActive,
        );
    } else if (modalAction) {
      const action = modalAction.dataset.action;
      if (action === "save-changes") {
        const form = document.getElementById("edit-gate-form");
        const gateId = document.querySelector(".modal-content .gate-name")
          .dataset.gateId;
        const newGuard = form.querySelector("#gate-guard").value;
        const newTimeValue = form.querySelector("#gate-time").value;
        const updatedData = {
          scheduled_time: newTimeValue ? new Date(newTimeValue) : null,
          responsible_guard: newGuard === "null" ? null : newGuard,
          status: form.querySelector("#gate-status").value,
        };
        await Data.opdaterGate(gateId, updatedData);
        UI.hideGateDetailsModal();
      } else if (action === "cancel-edit") {
        UI.hideGateDetailsModal();
      } else {
        const gateId = document
          .querySelector(".modal-content .gate-name")
          .textContent.toLowerCase();
        const actions = {
          "tag-gate": handleTagGate,
          "start-monitor": handleStartMonitor,
          "skift-til-departure": handleSwitchToDeparture,
          "add-5-min": handleAdd5Minutes,
          "markoer-faerdig": handleMarkAsFinished,
          "afgiv-gate": handleReleaseGate,
          slet: () => {
            if (confirm("Er du sikker?"))
              alert("Slet-funktion ikke implementeret.");
          },
        };
        if (actions[action]) await actions[action](gateId);
      }
    } else if (tabButton) {
      UI.switchTab(tabButton.id);
      if (tabButton.id === "nav-gates") UI.renderGatesDashboard(state.allGates);
    } else if (resetButton) {
      if (confirm("Er du sikker på, at du vil nulstille ALLE gates?")) {
        try {
          const count = await Data.nulstilAlleGates();
          alert(`${count} gates blev succesfuldt nulstillet.`);
        } catch (error) {
          alert("Der opstod en fejl under nulstilling.");
          console.error("Fejl ved nulstilling af gates:", error);
        }
      }
    } else if (muteButton) {
      state.isMuted = !state.isMuted;
      UI.setMuteButtonState(state.isMuted);
    } else if (closeModal) {
      UI.hideGateDetailsModal();
    }
  });

  state.unsubscribe = Data.observerGates(onGatesUpdate);
  mainTimerLoop();
  window.addEventListener("online", () => UI.updateOfflineStatus(false));
  window.addEventListener("offline", () => UI.updateOfflineStatus(true));
  if (!navigator.onLine) UI.updateOfflineStatus(true);
}

document.addEventListener("DOMContentLoaded", init);
