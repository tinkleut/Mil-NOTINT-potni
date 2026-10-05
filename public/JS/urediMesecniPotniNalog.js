// FILE FOR EDITING MONTHLY TRAVEL ORDER



// Get form element and monthly travel order ID from URL parameters.
const monthlyEditForm = document.getElementById("monthlyEditForm");
const monthlyOrderId = new URLSearchParams(window.location.search).get("id");
let monthlyOrder = null;

// Clear selected files when user clicks the clear button.
document.getElementById("clearMonthlyFiles")?.addEventListener("click", () => {
    document.getElementById("potni_nalog_datoteke").value = "";
});

// Display message to user with appropriate styling (error or success).
function editMessage(text, type = "error") {
    const message = document.getElementById("message");
    message.textContent = text;
    message.className = `form-message ${type}`;
}

// Show or hide vehicle-specific fields based on selected vehicle type.
function toggleVehicleFields() {
    const vehicle = document.getElementById("vehicle").value;
    document.getElementById("carDetails").classList.toggle("hidden", vehicle !== "car");
    document.getElementById("otherVehicleDetails").classList.toggle("hidden", vehicle !== "other");
}

// Populate form fields with data from the monthly travel order.
function fillForm(order) {
    monthlyOrder = order;
    document.getElementById("ime").value = order.ime || "";
    document.getElementById("priimek").value = order.priimek || "";
    document.getElementById("prebivalisce").value = order.prebivalisce || "";
    document.getElementById("delovno_mesto").value = order.delovno_mesto || "";
    document.getElementById("purpose").value = order.namen || "";
    document.getElementById("departureDate").value = String(order.datum_odhoda || "").slice(0, 10);
    document.getElementById("vehicle").value = order.vozilo || "";
    document.getElementById("registerska").value = order.registerska || "";
    document.getElementById("vin").value = order.vin || "";
    document.getElementById("drugo_vozilo").value = order.drugo_vozilo || "";
    document.getElementById("predujem").value = order.placilo_predujema || "";
    document.getElementById("notes").value = order.opombe || "";
    document.getElementById("displayId").textContent = order.display_id ? `(${order.display_id})` : "";
    toggleVehicleFields();
}

// Fetch monthly travel order data from server and populate the form.
async function loadMonthlyOrder() {
    if (!monthlyOrderId) throw new Error("ID mesečnega potnega naloga ni podan.");

    // Fetch order details from the server.
    const response = await fetch(`/api/edit_travel_order/${monthlyOrderId}`);
    const order = await response.json();
    if (!response.ok || Number(order.mesecni) !== 1) {
        throw new Error(order.message || "Mesečni potni nalog ni bil najden.");
    }
    fillForm(order);

    // Fetch and display attached files for this travel order.
    const filesResponse = await fetch(`/api/travel_order/${monthlyOrderId}/files`);
    const files = await filesResponse.json();
    document.getElementById("travelOrderFiles").innerHTML = files.length
        ? files.map(file => `
            <div class="attachment-row">
                <a href="/api/travel_order/${monthlyOrderId}/files/${file.id}" target="_blank" rel="noopener">${file.originalno_ime}</a>
                <button type="button" class="clear-file" onclick="deleteTravelOrderFile('${monthlyOrderId}', '${file.id}')">Počisti</button>
            </div>
        `).join("")
        : "Ni prilog.";
}

async function deleteTravelOrderFile(orderId, fileId) {
    try {
        const response = await fetch(`/api/travel_order/${orderId}/files/${fileId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Datoteke ni mogoče izbrisati.");
        await loadMonthlyOrder();
    } catch (error) {
        editMessage(error.message);
    }
}

// Handle form submission: validate data and save the monthly travel order.
monthlyEditForm.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(monthlyEditForm);
    const departureDate = formData.get("departureDate");
    const vehicle = formData.get("vehicle");

    // Validate that all required fields are filled.
    if (!departureDate || !formData.get("purpose") || !vehicle) {
        editMessage("Prosim izpolnite vsa obvezna polja.");
        return;
    }
    // Validate car details if vehicle type is "car".
    if (vehicle === "car" && (!formData.get("registerska") || !formData.get("vin"))) {
        editMessage("Za avto sta obvezni registrska tablica in VIN številka.");
        return;
    }
    // Validate other vehicle description if vehicle type is "other".
    if (vehicle === "other" && !formData.get("drugo_vozilo")) {
        editMessage("Vnesite drugo prevozno sredstvo.");
        return;
    }

    // Build payload with travel order data for server submission.
    const payload = {
        namen: formData.get("purpose"),
        vrsta_projekta: monthlyOrder?.vrsta_projekta || "Mesečni potni nalog",
        datum_odhoda: `${departureDate}T00:00`,
        datum_prihoda: `${departureDate}T00:00`,
        vozilo: vehicle,
        registerska: formData.get("registerska"),
        vin: formData.get("vin"),
        drugo_vozilo: formData.get("drugo_vozilo"),
        prenocisce: monthlyOrder?.prenocisce || null,
        placilo_predujema: formData.get("predujem"),
        opombe: formData.get("notes")
    };

    try {
        // Send updated travel order data to server.
        const response = await fetch(`/api/edit_travel_order/${monthlyOrderId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Shranjevanje ni uspelo.");

        // Upload attached files if any were selected.
        const files = document.getElementById("potni_nalog_datoteke").files;
        if (files.length) {
            const attachments = new FormData();
            [...files].forEach(file => attachments.append("potni_nalog_datoteke", file));
            const fileResponse = await fetch(`/api/travel_order/${monthlyOrderId}/files`, {
                method: "POST",
                body: attachments
            });
            if (!fileResponse.ok) throw new Error("Prilog ni bilo mogoče dodati.");
        }

        // Redirect to monthly travel orders list on successful save.
        window.location.href = "/mojiMesecniPotniNalogi";
    } catch (error) {
        editMessage(error.message);
    }
});

// Set up event listeners when page loads.
document.addEventListener("DOMContentLoaded", async () => {
    // Toggle vehicle fields visibility when vehicle selection changes.
    document.getElementById("vehicle").addEventListener("change", toggleVehicleFields);
    try {
        await loadMonthlyOrder();
    } catch (error) {
        editMessage(error.message);
    }
});