// ui.js
// Anvarlig for al DOM-manipulation: tegning af lister, visning af modals, opdatering af HTML.

// Importer nødvendige hjælpefunktioner
import { formatTimestamp, formatSecondsToHMS } from "./utils.js";

// Gem referencer til ofte brugte DOM-elementer for bedre performance
const elements = {
  guardSelectionScreen: document.getElementById("guard-selection-screen"),
  mainApp: document.getElementById("main-app"),
  currentGuardDisplay: document.getElementById("current-guard-display"),
  overvaagningContent: document.getElementById("overvaagning-content"),
  gatesContent: document.getElementById("gates-content"),
  modal: document.getElementById("gate-details-modal"),
  modalContent: document.getElementById("modal-gate-info"),
  modalActions: document.getElementById("modal-gate-actions"),
  modalCloseButton: document.querySelector(".modal-close-button"),
  guardOptionsContainer: document.getElementById("guard-options"),
  offlineBanner: document.getElementById("offline-banner"),
  navOvervaagning: document.getElementById("nav-overvaagning"),
  navGates: document.getElementById("nav-gates"),
  muteButton: document.getElementById("mute-button"),
};

/**
 * Viser hoved-applikationen og skjuler login-skærmen. (§2)
 * @param {string} guardId - Den valgte vagts ID.
 */
export function showMainApp(guardId) {
  elements.guardSelectionScreen.style.display = "none";
  elements.currentGuardDisplay.textContent = guardId;
  elements.mainApp.style.display = "block";
}

/**
 * Opdaterer listen af gate-kort i "Overvågning"-fanen.
 * @param {Array<object>} gates - En sorteret liste af gate-objekter.
 * @param {string} currentGuardId - Den nuværende vagts ID.
 * @param {object} activeTimers - Et objekt med aktive timere.
 */
export function renderOvervaagningList(gates, currentGuardId, activeTimers) {
  // Ryd den nuværende liste
  elements.overvaagningContent.innerHTML = "";

  if (gates.length === 0) {
    elements.overvaagningContent.innerHTML = "<p>Ingen gates at vise.</p>";
    return;
  }

  // Opret og tilføj et kort for hver gate
  gates.forEach((gate) => {
    const card = createGateCard(gate, currentGuardId, activeTimers);
    elements.overvaagningContent.appendChild(card);
  });
}

/**
 * Opretter et enkelt gate-kort HTML-element. (§4, §5)
 * @param {object} gate - Gate-objektet fra Firestore.
 * @param {string} currentGuardId - Den nuværende vagts ID.
 * @param {object} activeTimers - Objekt med aktive timere.
 * @returns {HTMLElement} - Et div-element, der repræsenterer kortet.
 */
function createGateCard(gate, currentGuardId, activeTimers) {
  const card = document.createElement("div");
  card.className = "gate-card";
  card.dataset.gateId = gate.id; // Gør det let at identificere gaten ved klik

  // Sæt statusfarve
  let statusColor = gate.status;
  if (gate.responsible_guard && gate.responsible_guard !== currentGuardId) {
    statusColor = "blue"; // Tildelt en anden vagt (§4)
  }
  card.classList.add(`status-${statusColor}`);

  const timeRemaining = activeTimers[gate.id]?.remaining || 0;
  const timerDisplay =
    statusColor === "green" || statusColor === "yellow"
      ? `<div class="gate-timer">${formatSecondsToHMS(timeRemaining)}</div>`
      : "";

  card.innerHTML = `
        <h3>${gate.gate_id.toUpperCase()}</h3>
        <div class="gate-details">
            <span>Type: <strong>${gate.type}</strong></span>
            <span>Planlagt: <strong>${formatTimestamp(gate.scheduled_time)}</strong></span>
            <span>Skærm: <strong>${gate.screen || "-"}</strong></span>
        </div>
        ${timerDisplay}
    `;
  return card;
}

/**
 * Viser modal-vinduet med detaljer for en specifik gate.
 * @param {object} gate - Gate-objektet.
 * @param {string} currentGuardId - Den nuværende vagts ID.
 * @param {object} activeTimers - Objekt med aktive timere.
 */
export function showGateDetailsModal(gate, currentGuardId, activeTimers) {
  // Udfyld basisinformation
  const timeRemaining = activeTimers[gate.id]?.remaining || 0;
  elements.modalContent.innerHTML = `
        <h3 class="gate-name">${gate.gate_id.toUpperCase()}</h3>
        <p>Type: <span class="gate-type">${gate.type}</span></p>
        <p>Planlagt tid: <span class="gate-scheduled-time">${formatTimestamp(gate.scheduled_time)}</span></p>
        <p>Status: <span class="gate-status">${gate.status}</span></p>
        <p>Ansvarlig: <span class="gate-guard">${gate.responsible_guard || "Ingen"}</span></p>
        <p>Overvågningstid: <span class="gate-timer">${formatSecondsToHMS(timeRemaining)}</span></p>
    `;

  // Udfyld handlingsknapper dynamisk
  renderModalActions(gate, currentGuardId, timeRemaining);

  elements.modal.style.display = "flex";
}

/**
 * Genererer de korrekte handlingsknapper i modalen baseret på gate-status.
 * @param {object} gate - Gate-objektet.
 * @param {string} currentGuardId - Den nuværende vagts ID.
 * @param {number} timeRemaining - Resterende sekunder på timer.
 */
function renderModalActions(gate, currentGuardId, timeRemaining) {
  elements.modalActions.innerHTML = ""; // Ryd gamle knapper
  const isMyGate = gate.responsible_guard === currentGuardId;

  if (!gate.responsible_guard) {
    elements.modalActions.innerHTML += `<button data-action="tag-gate">Tildel til Mig (${currentGuardId})</button>`;
  }

  if (isMyGate) {
    if (gate.status === "gray" || gate.status === "blue") {
      elements.modalActions.innerHTML += `<button data-action="start-monitor">Start Overvågning Nu</button>`;
    }
    if (gate.status === "yellow") {
      elements.modalActions.innerHTML += `<button data-action="skift-til-departure">Skift til Departure</button>`;
    }
    if (gate.status === "green" || gate.status === "yellow") {
      elements.modalActions.innerHTML += `<button data-action="markoer-faerdig">Markér Færdig</button>`;
    }
    // Vis +5 min knap, når der er mindre end 5 minutter tilbage af aktiv overvågning
    if (gate.status === "green" && timeRemaining > 0 && timeRemaining < 300) {
      elements.modalActions.innerHTML += `<button data-action="add-5-min">+5 minutter</button>`;
    }

    elements.modalActions.innerHTML += `<button data-action="afgiv-gate">Afgiv Gate</button>`;
  }

  elements.modalActions.innerHTML += `<button data-action="slet" class="danger">Slet Gate</button>`;
}

/**
 * Skjuler modal-vinduet.
 */
export function hideGateDetailsModal() {
  elements.modal.style.display = "none";
}

/**
 * Opdaterer mute-knappens ikon.
 * @param {boolean} isMuted - Om lyden er slået fra.
 */
export function setMuteButtonState(isMuted) {
  elements.muteButton.textContent = isMuted ? "🔇" : "🔊";
}

/**
 * Viser eller skjuler offline-banneret. (§9)
 * @param {boolean} isOffline - Om applikationen er offline.
 */
export function updateOfflineStatus(isOffline) {
  elements.offlineBanner.style.display = isOffline ? "block" : "none";
}

/**
 * Opdaterer udseendet på vagt-valgknapperne (f.eks. deaktiverer optagne).
 * @param {Array<string>} takenGuards - En liste over ID'er på optagne vagter.
 */
export function updateGuardSelectionUI(takenGuards) {
  const buttons =
    elements.guardOptionsContainer.querySelectorAll(".guard-button");
  buttons.forEach((button) => {
    if (takenGuards.includes(button.dataset.guardId)) {
      button.classList.add("taken");
      button.disabled = true;
    } else {
      button.classList.remove("taken");
      button.disabled = false;
    }
  });
}
