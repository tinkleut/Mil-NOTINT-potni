// FILE FOR EDITING MONTHLY TRAVEL ORDER



// Get form element and monthly travel order ID from URL parameters.
const monthlyEditForm = document.getElementById("monthlyTravelOrderForm");
const monthlyOrderId = new URLSearchParams(window.location.search).get("id");
let monthlyOrder = null;

// Display message to user with appropriate styling (error or success).
function showMessage(text, type = "error") {
    const message = document.getElementById("message");
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`;
}

// Set the value of a form field by its ID, or clear it if value is empty.
function setFieldValue(id, value) {
    const field = document.getElementById(id);
    if (field) field.value = value || "";
}

// Show or hide vehicle-specific fields based on selected vehicle type.
function toggleVehicleDetails() {
    const vehicle = document.getElementById("vehicle").value;
    document.getElementById("carDetails").classList.toggle("hidden", vehicle !== "car");
    document.getElementById("otherVehicleDetails").classList.toggle("hidden", vehicle !== "other");
    document.getElementById("drugo_vozilo").required = vehicle === "other";
}

// Calculate first and last day of the month for the selected date.
function getMonthDates(dateValue) {
    const selectedDate = new Date(`${dateValue}T00:00:00`);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const pad = value => String(value).padStart(2, "0");
    const firstDay = `${year}-${pad(month + 1)}-01T00:00`;
    const lastDay = new Date(year, month + 1, 0);
    const lastDate = `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}T23:59`;
    return { firstDay, lastDate };
}

// Extract the first day of the month from a date string.
function getFirstDayOfMonth(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

// Populate form fields with data from the monthly travel order.
function fillMonthlyOrder(order) {
    monthlyOrder = order;
    setFieldValue("datum_izdaje", order.datum_izdaje);
    setFieldValue("status", order.status || "Pending");
    setFieldValue("ime", order.ime);
    setFieldValue("priimek", order.priimek);
    setFieldValue("prebivalisce", order.prebivalisce);
    setFieldValue("delovno_mesto", order.delovno_mesto);
    setFieldValue("purpose", order.namen);
    setFieldValue("departureDate", getFirstDayOfMonth(order.datum_odhoda));
    setFieldValue("vehicle", order.vozilo);
    setFieldValue("registerska", order.registerska);
    setFieldValue("vin", order.vin);
    setFieldValue("drugo_vozilo", order.drugo_vozilo);
    setFieldValue("predujem", order.placilo_predujema || "Ne");
    setFieldValue("opombe", order.opombe);
    toggleVehicleDetails();
}

// Fetch monthly travel order data from admin API and populate the form.
async function loadMonthlyOrder() {
    if (!monthlyOrderId) throw new Error("ID mesečnega potnega naloga ni podan.");

    const response = await fetch(`/api/admin/edit_travel_order/${monthlyOrderId}`);
    const order = await response.json();

    if (!response.ok || Number(order.mesecni) !== 1) {
        throw new Error(order.error || "Mesečni potni nalog ni bil najden.");
    }

    fillMonthlyOrder(order);
    await loadMonthlyOrderFiles();
}

// Fetch and display list of file attachments for this travel order.
async function loadMonthlyOrderFiles() {
    const container = document.getElementById("travelOrderFiles");
    const response = await fetch(`/api/travel_order/${monthlyOrderId}/files`);
    const files = await response.json();
    if (!response.ok) throw new Error(files.error || "Prilog ni mogoče naložiti.");
    container.innerHTML = files.length
        ? files.map(file => `
            <div class="attachment-row">
                <a href="/api/travel_order/${monthlyOrderId}/files/${file.id}" target="_blank" rel="noopener">${file.originalno_ime}</a>
                <button type="button" class="clear-file" onclick="deleteTravelOrderFile('${monthlyOrderId}', '${file.id}')">Počisti</button>
            </div>
        `).join("")
        : "Ni prilog.";
}

// Delete a single file attachment from the travel order.
async function deleteTravelOrderFile(orderId, fileId) {
    try {
        const response = await fetch(`/api/travel_order/${orderId}/files/${fileId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Datoteke ni mogoče izbrisati.");
        await loadMonthlyOrderFiles();
    } catch (error) {
        showMessage(error.message);
    }
}

// Validate form data and save updated monthly travel order to admin API.
async function saveMonthlyOrder(event) {
    event.preventDefault();

    const departureDate = document.getElementById("departureDate").value;
    const vehicle = document.getElementById("vehicle").value;
    const purpose = document.getElementById("purpose").value.trim();
    const advancePayment = document.getElementById("predujem").value.trim();
    const otherVehicle = document.getElementById("drugo_vozilo").value.trim();

    // Ensure all required fields are filled before submission.
    if (!monthlyOrderId || !departureDate || !purpose || !vehicle || !advancePayment) {
        showMessage("Prosim izpolnite vsa obvezna polja.");
        return;
    }

    // Validate car details if vehicle type is "car".
    if (vehicle === "car" && (!monthlyOrder.registerska || !monthlyOrder.vin)) {
        showMessage("Mesečni potni nalog nima registrske tablice ali VIN številke.");
        return;
    }

    // Validate other vehicle description if vehicle type is "other".
    if (vehicle === "other" && !otherVehicle) {
        showMessage("Vnesite drugo prevozno sredstvo.");
        return;
    }

    // Calculate month span from selected date.
    const { firstDay, lastDate } = getMonthDates(departureDate);
    const residence = document.getElementById("prebivalisce").value.trim();

    try {
        // Send updated monthly travel order data to admin API.
        const response = await fetch(`/api/admin/edit_travel_order/${monthlyOrderId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                datum_izdaje: monthlyOrder.datum_izdaje,
                status: document.getElementById("status").value,
                namen: purpose,
                vrsta_projekta: monthlyOrder.vrsta_projekta || "Mesečni potni nalog",
                lokacija_odhoda: `${residence}, Slovenija`,
                lokacija_prihoda: "Slovenija",
                datum_odhoda: firstDay,
                datum_prihoda: lastDate,
                vozilo: vehicle,
                registerska: vehicle === "car" ? monthlyOrder.registerska : "",
                vin: vehicle === "car" ? monthlyOrder.vin : "",
                drugo_vozilo: vehicle === "other" ? otherVehicle : "",
                prenocisce: monthlyOrder.prenocisce || null,
                placilo_predujema: advancePayment,
                opombe: document.getElementById("opombe").value.trim()
            })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || data.error || "Shranjevanje ni uspelo.");
        }

        // Upload files if any were selected
        const fileInput = document.getElementById("travelOrderFilesInput");
        if (fileInput && fileInput.files.length > 0) {
            const formData = new FormData();
            [...fileInput.files].forEach(file => {
                formData.append("potni_nalog_datoteke", file);
            });
            
            try {
                const uploadResponse = await fetch(`/api/travel_order/${monthlyOrderId}/files`, {
                    method: "POST",
                    body: formData
                });
                
                if (!uploadResponse.ok) {
                    throw new Error("Datoteke ni mogoče naložiti.");
                }
            } catch (error) {
                showMessage("Opozorilo: Mesečni potni nalog je bil shranjen, vendar datoteke niso bile naložene. " + error.message);
                return;
            }
        }

        showMessage("Mesečni potni nalog je bil uspešno posodobljen.", "success");
        // Redirect to admin monthly travel orders list after successful save.
        setTimeout(() => {
            window.location.href = "/admin/vsiMesecniPotniNalogi";
        }, 300);
    } catch (error) {
        showMessage(error.message);
    }
}

// Set up event listeners and load initial data when page loads.
document.addEventListener("DOMContentLoaded", async () => {

    // Toggle vehicle fields visibility when vehicle selection changes.
    document.getElementById("vehicle").addEventListener("change", toggleVehicleDetails);

    // Clear selected files when user clicks the clear button
    const clearBtn = document.getElementById("clearTravelOrderFiles");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            document.getElementById("travelOrderFilesInput").value = "";
        });
    }

    monthlyEditForm.addEventListener("submit", saveMonthlyOrder);

    try {
        await loadMonthlyOrder();
    } catch (error) {
        showMessage(error.message);
    }
});