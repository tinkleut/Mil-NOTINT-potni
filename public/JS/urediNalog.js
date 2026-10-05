// FILE FOR DISPALYING ALL INFORMATION FOR A TRAVEL ORDER WE WANT TO EDIT

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}



// Function for showing messages.
function showMessage(text, type = "error") {
    const message = document.getElementById("message");
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`;
}

document.getElementById("clearTravelOrderFiles")?.addEventListener("click", () => {
    document.getElementById("potni_nalog_datoteke").value = "";
});
 
async function loadTravelOrderFiles(orderId) {
    const container = document.getElementById("travelOrderFiles");
    if (!container) return;
    try {
        const response = await fetch(`/api/travel_order/${orderId}/files`);
        if (!response.ok) throw new Error("Prilogov ni mogoče naložiti.");
        const files = await response.json();
        container.innerHTML = files.length
            ? files.map(file => `
                <div class="attachment-row">
                    <a href="/api/travel_order/${orderId}/files/${file.id}" target="_blank" rel="noopener">${escapeHTML(file.originalno_ime)}</a>
                    <button type="button" class="clear-file" onclick="deleteTravelOrderFile('${orderId}', '${file.id}')">Počisti</button>
                </div>
            `).join("")
            : "Ni prilog.";
    } catch (error) {
        container.textContent = error.message;
        showMessage(error.message);
    }
}

async function deleteTravelOrderFile(orderId, fileId) {
    try {
        const response = await fetch(`/api/travel_order/${orderId}/files/${fileId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Datoteke ni mogoče izbrisati.");
        await loadTravelOrderFiles(orderId);
    } catch (error) {
        showMessage(error.message);
    }
}

async function uploadTravelOrderFiles(orderId) {
    const input = document.getElementById("potni_nalog_datoteke");
    if (!input?.files.length) return;
    const formData = new FormData();
    [...input.files].forEach(file => formData.append("potni_nalog_datoteke", file));
    const response = await fetch(`/api/travel_order/${orderId}/files`, { method: "POST", body: formData });
    if (!response.ok) throw new Error("Prilogov ni bilo mogoče dodati.");
}

// LOAD DATA FOR A SPECIFIC TRAVEL ORDER
async function loadAllDataOrder() {
    try {

        // Extract order ID from URL query parameter.
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("id");

        // Fetch the travel order data from server using the order ID.
        const response = await fetch(`/api/edit_travel_order/${orderId}`);

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error("Napaka pri pridobivanju informacij o potnem nalogu...");
        }

        // Parse response to get travel order data
        const data = await response.json();
        loadTravelOrderFiles(orderId);
        
        // Autofill personal information fields if they exist on the page.
        const ime = document.getElementById("ime");
        if (ime) ime.value = data.ime;
        
        const priimek = document.getElementById("priimek");
        if (priimek) priimek.value = data.priimek;
        
        const prebivalisce = document.getElementById("prebivalisce");
        if (prebivalisce) prebivalisce.value = data.prebivalisce;
        
        const delovnoMesto = document.getElementById("delovno_mesto");
        if (delovnoMesto) delovnoMesto.value = data.delovno_mesto;

        const lokacija_odhoda = document.getElementById("lokacija_odhoda");
        if (lokacija_odhoda) lokacija_odhoda.value = data.lokacija_odhoda;

        const lokacija_prihoda = document.getElementById("lokacija_prihoda");
        if (lokacija_prihoda) lokacija_prihoda.value = data.lokacija_prihoda;

        const datum_odhoda = document.getElementById("datum_odhoda");
        if (datum_odhoda) datum_odhoda.value = data.datum_odhoda;

        const datum_prihoda = document.getElementById("datum_prihoda");
        if (datum_prihoda) datum_prihoda.value = data.datum_prihoda;

        const namen = document.getElementById("namen");
        if (namen) namen.value = data.namen;

        const vrsta_projekta = document.getElementById("vrsta_projekta");
        if (vrsta_projekta) vrsta_projekta.value = data.vrsta_projekta;

        const vozilo = document.getElementById("vehicle");
        const carDetails = document.getElementById("carDetails");
        const otherVehicleDetails = document.getElementById("otherVehicleDetails");

        if (vozilo) {
            // Set the vehicle type dropdown to the stored value.
            vozilo.value = data.vozilo || "";

            // Add event listener to show/hide "other vehicle" details based on selection.
            vozilo.addEventListener("change", function() {

                // Show additional vehicle details input if "other" is selected.
                if (vozilo.value === "car") {
                    carDetails.classList.remove("hidden");
                    otherVehicleDetails.classList.add("hidden");
                } else if (vozilo.value === "other") {
                    carDetails.classList.add("hidden");
                    otherVehicleDetails.classList.remove("hidden");
                } else {
                    carDetails.classList.add("hidden");
                    otherVehicleDetails.classList.add("hidden");
                }
            });
            
            // Trigger change event to show/hide fields based on current value.
            vozilo.dispatchEvent(new Event("change"));
        }

        // Autofill registration number for standard vehicles.
        const registerska = document.getElementById("registerska");
        if (registerska) {
            registerska.value = data.registerska || "";
        }

        // Autofill VIN (Vehicle Identification Number) for standard vehicles
        const vin = document.getElementById("vin");
        if (vin) {
            vin.value = data.vin || "";
        }

        // Autofill vehicle type description for "other" vehicle option.
        const drugo_vozilo = document.getElementById("other_vehicle");
        if (drugo_vozilo) {
            drugo_vozilo.value = data.drugo_vozilo || "";
        }

        // Autofill accommodation information.
        const prenocisce = document.getElementById("prenocisce");
        if (prenocisce) prenocisce.value = data.prenocisce;

        // Autofill advance payment information.
        const placilo_predujema = document.getElementById("placilo_predujema");
        if (placilo_predujema) placilo_predujema.value = data.placilo_predujema;

        // Autofill notes/remarks field.
        const opombe = document.getElementById("opombe");
        if (opombe) opombe.value = data.opombe;

    } catch (error) {
        // Log error if data loading fails.
        console.error("Napaka pri nalaganju podatkov:", error);
        showMessage(error.message || "Podatkov potnega naloga ni mogoče naložiti.");
    }
}


// UPDATE DATA

const form = document.getElementById("travelOrderForm");

form.addEventListener("submit", async (event) => {
    // Prevent page reload on form submission.
    event.preventDefault();
    
    // Extract order ID from URL query parameter.
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("id");

    // Verify that order ID exists before proceeding with update.
    if (!orderId) {
        document.getElementById("message").textContent =
            "ID potnega naloga ni podan.";
        document.getElementById("message").style.color = "red";
        return;
    }

    // Extract and trim all input values from the form.
    const ime = document.getElementById("ime").value.trim();
    const priimek = document.getElementById("priimek").value.trim();
    const prebivalisce = document.getElementById("prebivalisce").value.trim();
    const delovno_mesto = document.getElementById("delovno_mesto").value.trim();
    const namen = document.getElementById("namen").value.trim();
    const vrsta_projekta = document.getElementById("vrsta_projekta").value.trim();
    const lokacija_odhoda = document.getElementById("lokacija_odhoda").value.trim();
    const lokacija_prihoda = document.getElementById("lokacija_prihoda").value.trim();
    const datum_odhoda = document.getElementById("datum_odhoda").value.trim();
    const datum_prihoda = document.getElementById("datum_prihoda").value.trim();
    const vozilo = document.getElementById("vehicle").value.trim();
    const registerska = document.getElementById("registerska").value.trim();
    const vin = document.getElementById("vin").value.trim();
    const drugo_vozilo = document.getElementById("other_vehicle").value;
    const prenocisce = document.getElementById("prenocisce").value.trim();
    const placilo_predujema = document.getElementById("placilo_predujema").value.trim();
    const opombe = document.getElementById("opombe").value.trim();

    // Validation
    if (!ime || !priimek || !namen || !vrsta_projekta || !lokacija_odhoda || !lokacija_prihoda || !datum_odhoda || !datum_prihoda || !vozilo) {
        document.getElementById("message").textContent = "Prosim izpolnite vsa obvezna polja!";
        document.getElementById("message").style.color = "red";
        return;
    }

    if (vozilo === "car") {
        if (!registerska || !vin) {
            document.getElementById("message").textContent = "Prosim izpolnite vsa obvezna polja!";
            document.getElementById("message").style.color = "red";
            showMessage("Za avto sta obvezni registrska tablica in VIN številka.");
            return; 
        }
    }

    if (vozilo === "other") { 
        if (!drugo_vozilo) {
            document.getElementById("message").textContent = "Prosim napišite vrsto prevoznega sredstva!";
            document.getElementById("message").style.color = "red";
            showMessage("Vnesite drugo prevozno sredstvo.");
            return; 
        }
    }

    // Convert date strings to Date objects for comparison.
    const odhod = new Date(datum_odhoda);
    const prihod = new Date(datum_prihoda);


    // Ensure departure date is before arrival date.
    if (odhod >= prihod) {
        showMessage("Datum in ura prihoda morata biti poznejša od odhoda.");
        return;
    }

    try {

        // Send PUT request to update the travel order with new data.
        const response = await fetch(`/api/edit_travel_order/${orderId}`, {

            // Use PUT method to update the entire travel order resource identified by orderId.
            method: "PUT",

            // Declare that the request body contains JSON-formatted data.
            headers: {
                "Content-type": "application/json"
            },

            // Convert all form field values into JSON format for server to update database record.
            body: JSON.stringify({
                ime: ime,
                priimek: priimek,
                prebivalisce: prebivalisce,
                delovno_mesto: delovno_mesto,
                namen: namen,
                vrsta_projekta: vrsta_projekta,
                lokacija_odhoda: lokacija_odhoda,
                lokacija_prihoda: lokacija_prihoda,
                datum_odhoda: datum_odhoda,
                datum_prihoda: datum_prihoda,
                vozilo: vozilo,
                registerska: registerska,
                vin: vin,
                drugo_vozilo: drugo_vozilo,
                prenocisce: prenocisce,
                placilo_predujema: placilo_predujema,
                opombe: opombe
            })
        });

        // If response status indicates error, read response as text for debuggin.
        if (!response.ok) {
            const text = await response.text(); // Preberi kot TEXT, ne JSON
            console.error("Napaka od strežnika:", text);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse successful response as JSON.
        const data = await response.json();

        if (data.success) {
            await uploadTravelOrderFiles(orderId);
            // Display success message if update was successful.
            document.getElementById("message").textContent = "Potni nalog je bil uspešno posodobljen!";
            document.getElementById("message").style.color = "green";
        } else {
            // Display error message from server if update failed.
            document.getElementById("message").textContent = data.message || "Napaka";
            document.getElementById("message").style.color = "red";
        }
    
    // Catch any errors that may occur.
    } catch (error) {
        showMessage("Napaka pri pošiljanju podatkov na strežnik!");
        console.error("Request failed:", error);
    }
});

// Load and display existing travel order data when page finishes loading.
document.addEventListener("DOMContentLoaded", loadAllDataOrder);