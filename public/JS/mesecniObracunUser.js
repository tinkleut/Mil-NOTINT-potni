// FILE FOR MONTHLY OBRACUN, MILEAGE REIMBURSEMENT CALCULATOR WITH FILE ATTACHMENTS



// Get form element and monthly calculation ID from URL parameters.
const monthlyCalculationForm = document.getElementById("monthlyCalculationForm");
const monthlyMileageBody = document.getElementById("monthlyMileageBody");
const orderId = new URLSearchParams(window.location.search).get("id");
const MAX_ROWS = 31;
const MIN_ROWS = 5;
let monthlyOrder = null;

// Display message to user with appropriate styling (error or success).
function showMessage(text, type = "error") {
    const message = document.getElementById("message");
    message.textContent = text;
    message.className = `form-message ${type}`;
}

// Format numeric value as currency string with EUR symbol.
function formatMoney(value) {
    return `${Number(value || 0).toFixed(2)} EUR`; // Converts to "12.50 EUR"
}

// Generate date string for given day of the month from the order's departure date.
function monthDate(index) {
    const base = new Date(`${monthlyOrder.datum_odhoda.slice(0, 10)}T00:00:00`);
    const date = new Date(base.getFullYear(), base.getMonth(), index + 1);
    if (date.getMonth() !== base.getMonth()) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Check if table row has all required fields filled (relation, kilometers, and rate).
function rowIsFilled(row) {
    return Boolean(row.querySelector(".monthly-relation").value.trim())
        && row.querySelector(".monthly-kilometers").value !== ""
        && row.querySelector(".monthly-rate").value !== "";
}

// Check if table row is completely empty (no data entered).
function rowIsEmpty(row) {
    return !row.querySelector(".monthly-relation").value.trim()
        && row.querySelector(".monthly-kilometers").value === "";
}

// Create a new table row for monthly mileage entry with date, relation, kilometers, rate, and amount.
function createRow(index, data = {}) {
    const row = document.createElement("tr");
    row.className = "monthly-mileage-row";
    row.innerHTML = `
        <td><input class="monthly-date" name="monthlyDate" type="date" value="${data.datum || monthDate(index)}" readonly></td>
        <td><input class="monthly-relation" name="monthlyRelation" type="text" placeholder="Relacija" value="${data.relacija || ""}"></td>
        <td><input class="monthly-kilometers" name="monthlyKilometers" type="number" min="0" step="0.01" placeholder="0" value="${data.kilometri ?? ""}"></td>
        <td><input class="monthly-rate" name="monthlyRate" type="number" min="0" step="0.01" value="${data.kilometrina ?? "0.43"}"></td>
        <td><input class="monthly-amount" type="text" value="${Number(data.znesek || 0).toFixed(2)}" readonly></td>
    `;

    // Update row amount and recalculate totals when any input changes.
    row.querySelectorAll("input").forEach(input => input.addEventListener("input", () => {
        updateRowAmount(row);
        syncRows();
        updateTotals();
    }));
    return row;
}

// Calculate amount for a row by multiplying kilometers by rate.
function updateRowAmount(row) {
    const kilometers = Number(row.querySelector(".monthly-kilometers").value || 0);
    const rate = Number(row.querySelector(".monthly-rate").value || 0);
    row.querySelector(".monthly-amount").value = (kilometers * rate).toFixed(2);
}

// Add or remove table rows to maintain minimum rows and one empty row for new entries.
function syncRows() {
    const rows = [...monthlyMileageBody.querySelectorAll(".monthly-mileage-row")];
    const filledRows = rows.filter(rowIsFilled).length;
    const targetRows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, filledRows + 1));

    // Add rows if current count is below target.
    while (monthlyMileageBody.children.length < targetRows) {
        monthlyMileageBody.appendChild(createRow(monthlyMileageBody.children.length));
    }
    // Remove empty rows if current count exceeds target.
    while (monthlyMileageBody.children.length > targetRows && rowIsEmpty(monthlyMileageBody.lastElementChild)) {
        monthlyMileageBody.lastElementChild.remove();
    }
}

// Calculate and display total of all mileage amounts in the table.
function updateTotals() {
    const total = [...monthlyMileageBody.querySelectorAll(".monthly-amount")]
        .reduce((sum, input) => sum + (Number(input.value) || 0), 0);
    document.getElementById("monthlyTotal").value = formatMoney(total);

}

// Populate table with existing mileage entries and add empty rows for new entries.
function renderRows(rows) {
    const rowCount = Math.min(MAX_ROWS, Math.max(MIN_ROWS, rows.length + 1));
    for (let index = 0; index < rowCount; index += 1) {
        monthlyMileageBody.appendChild(createRow(index, rows[index] || {}));
    }
    updateTotals();
}

// Display list of existing file attachments with delete buttons for each.
function renderExistingFiles(files) {
    const container = document.getElementById("existingFiles");
    container.innerHTML = files.length
        ? files.map(file => `
            <div class="attachment-row">
                <span>${file.originalno_ime}</span>
                <button type="button" class="clear-file" onclick="deleteMonthlyCalculationFile('${file.id}')">Počisti</button>
            </div>
        `).join("")
        : "Ni prilog.";
}

// Delete a single file attachment from the monthly calculation.
async function deleteMonthlyCalculationFile(fileId) {
    try {
        const response = await fetch(`/api/mesecni_obracun/${orderId}/files/${fileId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Datoteke ni mogoče izbrisati.");
        await loadMonthlyCalculation();
    } catch (error) {
        showMessage(error.message);
    }
}

// Fetch monthly calculation data from server and populate the form with existing entries and files.
async function loadMonthlyCalculation() {
    if (!orderId) throw new Error("Manjka ID mesečnega obračuna.");

    const response = await fetch(`/api/mesecni_obracun/data/${orderId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Mesečnega obračuna ni mogoče naložiti.");

    monthlyOrder = data.order;
    document.getElementById("orderId").textContent = monthlyOrder.display_id || monthlyOrder.id;
    renderExistingFiles(data.files || []);
    renderRows(data.kilometrine || []);

    if (data.order.obracun_id) {
        document.getElementById("employeePayment").value = formatMoney(data.order.placilo_zaposlenemu || 0);
    }
}

// Validate filled rows and save monthly calculation data to server.
async function saveMonthlyCalculation(event) {
    event.preventDefault();
    const rows = [...monthlyMileageBody.querySelectorAll(".monthly-mileage-row")];
    
    // Ensure partially filled rows have all required fields.
    if (rows.some(row => !rowIsEmpty(row) && !rowIsFilled(row))) {
        showMessage("Izpolnjene vrstice morajo vsebovati relacijo, kilometre in kilometrino.");
        return;
    }

    // Build form data with only filled rows.
    const formData = new FormData();
    rows.filter(rowIsFilled).forEach(row => {
        formData.append("monthlyDate", row.querySelector(".monthly-date").value);
        formData.append("monthlyRelation", row.querySelector(".monthly-relation").value.trim());
        formData.append("monthlyKilometers", row.querySelector(".monthly-kilometers").value);
        formData.append("monthlyRate", row.querySelector(".monthly-rate").value);
    });

    try {
        // Send monthly calculation data to server for storage.
        const response = await fetch(`/api/mesecni_obracun/save/${orderId}`, { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Shranjevanje ni uspelo.");
        showMessage("Mesečni obračun je bil uspešno shranjen.", "success");
    } catch (error) {
        showMessage(error.message);
    }
}

// Set up event listeners and load initial data when page loads.
document.addEventListener("DOMContentLoaded", async () => {
    // Clear selected files when user clicks the clear button.
    document.getElementById("clearMonthlyFiles").addEventListener("click", () => {
        document.getElementById("monthlyFiles").value = "";
    });
    monthlyCalculationForm.addEventListener("submit", saveMonthlyCalculation);
    try {
        await loadMonthlyCalculation();
    } catch (error) {
        showMessage(error.message);
    }
});