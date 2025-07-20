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
// js/ui.js - ERSTAT DEN GAMLE showGateDetailsModal MED DISSE 4 FUNKTIONER

/**
 * Hjælpefunktion: Formaterer et Firestore Timestamp til det format,
 * som <input type="datetime-local"> forventer (YYYY-MM-DDTHH:MM).
 */
function formatTimestampForInput(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") return "";
  const date = timestamp.toDate();
  // Justerer for browserens lokale tidszone, så tiden vises korrekt i input-feltet
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

/**
 * Hovedfunktionen til at vise modalen. Afgør om den skal være i redigerings- eller handlingstilstand.
 * @param {object} gate - Gate-objektet.
 * @param {string} currentGuardId - Den nuværende vagts ID.
 * @param {object} activeTimers - Objekt med aktive timere.
 * @param {boolean} editMode - Om modalen skal åbne i redigeringstilstand.
 */
export function showGateDetailsModal(
  gate,
  currentGuardId,
  activeTimers,
  editMode = false,
) {
  if (editMode) {
    // Redigeringstilstand: Vis et form-element
    renderEditForm(gate);
  } else {
    // Handlingstilstand: Vis normale detaljer og handlinger
    renderActionView(gate, currentGuardId, activeTimers);
  }
  elements.modal.style.display = "flex";
}

/**
 * Tegner modal-vinduet i redigeringstilstand med en formular.
 */
function renderEditForm(gate) {
  elements.modalContent.innerHTML = `
        <h3 class="gate-name" data-gate-id="${gate.id}">${gate.gate_id.toUpperCase()}</h3>
        <form id="edit-gate-form" class="gate-edit-form">
            <label for="gate-time">Planlagt Tid:</label>
            <input type="datetime-local" id="gate-time" value="${formatTimestampForInput(gate.scheduled_time)}">
            
            <label for="gate-guard">Ansvarlig Vagt:</label>
            <select id="gate-guard">
                <option value="null" ${!gate.responsible_guard ? "selected" : ""}>Ingen</option>
                <option value="Guard 1" ${gate.responsible_guard === "Guard 1" ? "selected" : ""}>Guard 1</option>
                <option value="Guard 2" ${gate.responsible_guard === "Guard 2" ? "selected" : ""}>Guard 2</option>
                <option value="Guard 3" ${gate.responsible_guard === "Guard 3" ? "selected" : ""}>Guard 3</option>
            </select>

            <label for="gate-status">Status:</label>
            <select id="gate-status">
                <option value="gray" ${gate.status === "gray" ? "selected" : ""}>Planlagt</option>
                <option value="green" ${gate.status === "green" ? "selected" : ""}>Aktiv Overvågning</option>
                <option value="yellow" ${gate.status === "yellow" ? "selected" : ""}>Afventer Departure</option>
                <option value="red" ${gate.status === "red" ? "selected" : ""}>Færdig</option>
            </select>
        </form>
    `;
  elements.modalActions.innerHTML = `
        <button data-action="save-changes" class="primary-action">Gem Ændringer</button>
        <button data-action="cancel-edit">Annuller</button>
    `;
}

/**
 * Tegner modal-vinduet i normal handlingstilstand (den gamle logik).
 */
function renderActionView(gate, currentGuardId, activeTimers) {
  const timeRemaining = activeTimers[gate.id]?.remaining || 0;
  elements.modalContent.innerHTML = `
        <h3 class="gate-name">${gate.gate_id.toUpperCase()}</h3>
        <p>Type: <span class="gate-type">${gate.type}</span></p>
        <p>Planlagt tid: <span class="gate-scheduled-time">${formatTimestamp(gate.scheduled_time)}</span></p>
        <p>Status: <span class="gate-status">${gate.status}</span></p>
        <p>Ansvarlig: <span class="gate-guard">${gate.responsible_guard || "Ingen"}</span></p>
        <p>Overvågningstid: <span class="gate-timer">${formatSecondsToHMS(timeRemaining)}</span></p>
    `;
  // Genbruger den eksisterende funktion til at lave handlingsknapper
  renderModalActions(gate, currentGuardId, timeRemaining);
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
// ui.js - TILFØJ DISSE NYE FUNKTIONER

/**
 * Skifter det aktive faneblad og det synlige indhold.
 * @param {string} targetTabId - ID'et på den fane-knap, der blev klikket på (f.eks. 'nav-gates').
 */
export function switchTab(targetTabId) {
  const isOvervaagning = targetTabId === "nav-overvaagning";

  // Skjul/vis de rigtige content-sektioner
  elements.overvaagningContent.style.display = isOvervaagning ? "grid" : "none";
  elements.gatesContent.style.display = isOvervaagning ? "none" : "grid";

  // Opdater den aktive klasse på knapperne
  elements.navOvervaagning.classList.toggle("active", isOvervaagning);
  elements.navGates.classList.toggle("active", !isOvervaagning);
}

/**
 * Opdaterer "Gates"-dashboardet, grupperet efter sektion. (§3)
 * (Dette er en simpel version - kan udvides senere)
 * @param {Array<object>} gates - En liste af alle gate-objekter.
 */
export function renderGatesDashboard(gates) {
  elements.gatesContent.innerHTML = ""; // Ryd gammelt indhold

  // Gruppér gates efter første bogstav (f.eks. 'A10' -> 'A')
  const gatesBySection = gates.reduce((acc, gate) => {
    const section = gate.gate_id.charAt(0).toUpperCase();
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(gate);
    return acc;
  }, {});

  // NYT: Sortér sektionerne (A, B, C...) alfabetisk
  const sortedSections = Object.keys(gatesBySection).sort();

  // Opret en sektion for hver sorteret gruppe
  sortedSections.forEach((section) => {
    const sectionDiv = document.createElement("div");
    sectionDiv.className = "gate-section";
    sectionDiv.innerHTML = `<h2>${section}-Gates</h2>`;

    // NYT: Sortér gaterne inde i sektionen (A2 før A10)
    const sortedGatesInSection = gatesBySection[section].sort((a, b) =>
      a.gate_id.localeCompare(b.gate_id, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

    sortedGatesInSection.forEach((gate) => {
      const card = createGateCard(gate, null, {});
      sectionDiv.appendChild(card);
    });

    elements.gatesContent.appendChild(sectionDiv);
  });
}
