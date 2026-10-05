// FILE FOR EDITING MONTHLY OBRACUN



// Get form element and monthly calculation ID from URL parameters.
const monthlyCalculationForm = document.getElementById("monthlyCalculationForm");
const monthlyMileageBody = document.getElementById("monthlyMileageBody");
const monthlyOrderId = new URLSearchParams(window.location.search).get("id");
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
    return `${Number(value || 0).toFixed(2)} EUR`;
}

// Generate date string for given day of the month from the provided base date.
function monthDate(baseDate, index) {
    const base = new Date(`${baseDate}T00:00:00`);
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
        <td><input class="monthly-date" name="monthlyDate" type="date" value="${data.datum || monthDate(monthlyOrder.datum_odhoda.slice(0, 10), index)}" readonly></td>
        <td><input class="monthly-relation" name="monthlyRelation" type="text" placeholder="Relacija" value="${data.relacija || ""}"></td>
        <td><input class="monthly-kilometers" name="monthlyKilometers" type="number" min="0" step="0.01" placeholder="0" value="${data.kilometri ?? ""}"></td>
        <td><input class="monthly-rate" name="monthlyRate" type="number" min="0" step="0.01" value="${data.kilometrina ?? "0.43"}"></td>
        <td><input class="monthly-amount" name="monthlyAmount" type="text" value="${Number(data.znesek || 0).toFixed(2)}" readonly></td>
    `;

    // Update row amount and recalculate totals when any input changes.
    row.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", () => {
            updateRowAmount(row);
            syncRows();
            updateTotals();
        });
    });
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
    while (monthlyMileageBody.children.length > targetRows) {
        const lastRow = monthlyMileageBody.lastElementChild;
        if (!rowIsEmpty(lastRow)) break;
        lastRow.remove();
    }
}

// Calculate and display total of all mileage amounts, then limit employee payment to total.
function updateTotals() {
    const total = [...monthlyMileageBody.querySelectorAll(".monthly-amount")]
        .reduce((sum, input) => sum + (Number(input.value) || 0), 0);
    document.getElementById("monthlyTotal").value = formatMoney(total);
    const employeePayment = document.getElementById("employeePayment");
    employeePayment.max = total.toFixed(2);
    if (Number(employeePayment.value) > total) {
        employeePayment.value = total.toFixed(2);
        showMessage("Plačilo zaposlenemu je bilo omejeno na skupne stroške.");
    }
}

// Populate form with employee information, status, and month from the travel order.
function fillBasicInfo(order) {
    document.getElementById("displayId").textContent = order.display_id ? `(${order.display_id})` : "";
    document.getElementById("ime").value = `${order.ime || ""} ${order.priimek || ""}`.trim();
    document.getElementById("prebivalisce").value = order.prebivalisce || "";
    document.getElementById("delovno_mesto").value = order.delovno_mesto || "";
    document.getElementById("status").value = order.status || "";
    document.getElementById("namen").value = order.namen || "";
    document.getElementById("mesec").value = String(order.datum_odhoda || "").slice(0, 7);
    document.getElementById("employeePayment").value = Number(order.placilo_zaposlenemu || 0).toFixed(2);
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
        const response = await fetch(`/api/mesecni_obracun/${monthlyOrderId}/files/${fileId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Datoteke ni mogoče izbrisati.");
        await loadMonthlyCalculation();
    } catch (error) {
        showMessage(error.message);
    }
}

// Fetch monthly calculation data from admin API and populate form with employee info, mileage entries, and files.
async function loadMonthlyCalculation() {
    if (!monthlyOrderId) throw new Error("ID mesečnega obračuna ni podan.");

    const response = await fetch(`/api/admin/mesecni_obracun/data/${monthlyOrderId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Mesečnega obračuna ni mogoče naložiti.");

    monthlyOrder = data.order;
    fillBasicInfo(monthlyOrder);
    renderExistingFiles(data.files || []);
    const rows = data.rows || [];
    const initialRows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, rows.length + 1));
    for (let index = 0; index < initialRows; index += 1) {
        monthlyMileageBody.appendChild(createRow(index, rows[index] || {}));
    }
    updateTotals();
}

// Validate data, ensure employee payment does not exceed total, and save monthly calculation to admin API.
async function saveMonthlyCalculation(event) {
    event.preventDefault();
    const rows = [...monthlyMileageBody.querySelectorAll(".monthly-mileage-row")];
    const filledRows = rows.filter(rowIsFilled);
    const total = filledRows.reduce((sum, row) => sum + (Number(row.querySelector(".monthly-amount").value) || 0), 0);
    const employeePayment = Number(document.getElementById("employeePayment").value);

    // Ensure partially filled rows have all required fields.
    if (rows.some(row => !rowIsEmpty(row) && !rowIsFilled(row))) {
        showMessage("Izpolnjene vrstice morajo vsebovati relacijo, kilometre in kilometrino.");
        return;
    }

    // Validate employee payment amount is valid and does not exceed total expenses.
    if (!Number.isFinite(employeePayment) || employeePayment < 0 || employeePayment > total) {
        showMessage("Plačilo zaposlenemu ne sme biti večje od skupnih stroškov.");
        return;
    }

    // Build form data with filled rows and employee payment amount.
    const formData = new FormData();
    filledRows.forEach(row => {
        formData.append("monthlyDate", row.querySelector(".monthly-date").value);
        formData.append("monthlyRelation", row.querySelector(".monthly-relation").value.trim());
        formData.append("monthlyKilometers", row.querySelector(".monthly-kilometers").value);
        formData.append("monthlyRate", row.querySelector(".monthly-rate").value);
    });
    formData.append("placilo_zaposlenemu", employeePayment.toFixed(2));

    // Include file attachments if any were selected.
    const files = document.getElementById("monthlyFiles").files;
    [...files].forEach(file => formData.append("monthlyFiles", file));

    try {
        // Send monthly calculation data to admin API for storage.
        const response = await fetch(`/api/admin/mesecni_obracun/save/${monthlyOrderId}`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Shranjevanje ni uspelo.");

        showMessage("Mesečni obračun je bil uspešno shranjen.", "success");
        // Redirect to admin monthly calculations list after successful save.
        setTimeout(() => {
            window.location.href = "/admin/mesecniObracun";
        }, 200);
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
    // Validate employee payment does not exceed total when input changes.
    document.getElementById("employeePayment").addEventListener("input", () => {
        const total = [...monthlyMileageBody.querySelectorAll(".monthly-amount")]
            .reduce((sum, input) => sum + (Number(input.value) || 0), 0);
        const employeePayment = document.getElementById("employeePayment");
        if (Number(employeePayment.value) > total) employeePayment.value = total.toFixed(2);
    });
    monthlyCalculationForm.addEventListener("submit", saveMonthlyCalculation);
    try {
        await loadMonthlyCalculation();
    } catch (error) {
        showMessage(error.message);
    }
});