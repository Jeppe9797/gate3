// js/ui.js - INDSÆT HELE DENNE BLOK

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
  // Tilføj data-gate-id til h3-elementet
  elements.modalContent.innerHTML = `
        <h3 class="gate-name" data-gate-id="${gate.id}">${gate.gate_id.toUpperCase()}</h3>
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
 * Viser hovedapplikationen for den valgte vagt.
 * @param {string} currentGuardId - Den nuværende vagts ID.
 */
export function showMainApp(guardId) {
  elements.guardSelectionScreen.style.display = "none";
  elements.currentGuardDisplay.textContent = guardId;
  elements.mainApp.style.display = "block";
}

// MANGLENDE DEL: Definer referencer til DOM-elementer
const elements = {
  modal: document.getElementById("gate-details-modal"),
  modalContent: document.getElementById("modal-gate-info"),
  modalActions: document.getElementById("modal-gate-actions"),
  guardSelectionScreen: document.getElementById("guard-selection-screen"),
  mainApp: document.getElementById("main-app"),
  currentGuardDisplay: document.getElementById("current-guard-display"),
  // Tilføj andre elementer efter behov
};
