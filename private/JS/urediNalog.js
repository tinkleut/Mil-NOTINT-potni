// FILE FOR DISPLAYING AND EDITING ALL INFORMATION FOR A SPECIFIC TRAVEL ORDER

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}



// DISPLAY MESSAGE TO USER WITH SPECIFIED TYPE (ERROR OR SUCCESS)
function showMessage(text, type = "error") {
    // Get the message display element from the DOM.
    const message = document.getElementById("message");
    if (!message) return;
    
    // Set message text and apply appropriate CSS class for styling.
    message.textContent = text;
    message.className = `form-message ${type}`;
}

// LOAD AND DISPLAY ALL ATTACHED FILES FOR A SPECIFIC TRAVEL ORDER
async function loadTravelOrderFiles(orderId) {
    // Get the container element where file links will be displayed.
    const container = document.getElementById("travelOrderFiles");
    if (!container) return;
    
    try {
        // Fetch all attached files for the travel order from the server.
        const response = await fetch(`/api/travel_order/${orderId}/files`);
        
        // Check if the request was successful.
        if (!response.ok) throw new Error("Prilogov ni mogoče naložiti.");
        
        // Parse response to get array of attached files.
        const files = await response.json();
        
        // Display file links or message if no files are attached.
        container.innerHTML = files.length
            ? files.map(file => `
                <div class="attachment-row">
                    <a href="/api/travel_order/${orderId}/files/${file.id}" target="_blank" rel="noopener">${escapeHTML(file.originalno_ime)}</a>
                    <button type="button" class="clear-file" onclick="deleteTravelOrderFile('${orderId}', '${file.id}')">Počisti</button>
                </div>
            `).join("")
            : "Ni prilog.";
    } catch (error) {
        // Display error message if file loading fails.
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

// UPLOAD NEW FILES TO A SPECIFIC TRAVEL ORDER
async function uploadTravelOrderFiles(orderId) {
    // Get the file input element containing selected files.
    const input = document.getElementById("potni_nalog_datoteke");
    
    // Return early if no files are selected.
    if (!input?.files.length) return;
    
    // Create FormData object and add all selected files to it.
    const formData = new FormData();
    [...input.files].forEach(file => formData.append("potni_nalog_datoteke", file));
    
    // Send files to server for the travel order.
    const response = await fetch(`/api/travel_order/${orderId}/files`, { method: "POST", body: formData });
    
    // Throw error if file upload fails.
    if (!response.ok) throw new Error("Prilogo ni bilo mogoče dodati.");
}

// LOAD ALL DATA FOR A SPECIFIC TRAVEL ORDER FROM SERVER AND POPULATE FORM FIELDS
async function loadAllDataOrder() {
    try {
        // Extract the travel order ID from the URL query parameters.
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("id");

        // Fetch the travel order data from the server.
        const response = await fetch(`/api/admin/edit_travel_order/${orderId}`);

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error("Napaka pri pridobivanju informacij o potnem nalogu...");
        }

        // Parse response to get travel order data.
        const data = await response.json();
        
        // Load and display attached files for this travel order.
        loadTravelOrderFiles(orderId);

        // POPULATE FORM FIELDS WITH TRAVEL ORDER DATA - ONLY IF ELEMENTS EXIST
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

        // HANDLE VEHICLE TYPE SELECTION AND DISPLAY APPROPRIATE DETAILS SECTION
        const vozilo = document.getElementById("vehicle");
        const carDetails = document.getElementById("carDetails");
        const otherVehicleDetails = document.getElementById("otherVehicleDetails");

        if (vozilo) {
            // Set the vehicle type dropdown to the stored value.
            vozilo.value = data.vozilo || "";
            
            // Add event listener to show/hide vehicle detail sections based on selected type.
            vozilo.addEventListener("change", function() {
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
            
            // Trigger change event to display correct section on page load.
            vozilo.dispatchEvent(new Event("change"));
        }

        // POPULATE CAR-SPECIFIC FIELDS (REGISTRATION PLATE AND VIN)
        const registerska = document.getElementById("registerska");
        if (registerska) {
            registerska.value = data.registerska || "";
        }

        const vin = document.getElementById("vin");
        if (vin) {
            vin.value = data.vin || "";
        }

        // POPULATE OTHER VEHICLE DESCRIPTION FIELD
        const drugo_vozilo = document.getElementById("other_vehicle");
        if (drugo_vozilo) {
            drugo_vozilo.value = data.drugo_vozilo || "";
        }

        // POPULATE REMAINING TRAVEL ORDER FIELDS
        const prenocisce = document.getElementById("prenocisce");
        if (prenocisce) prenocisce.value = data.prenocisce;

        const placilo_predujema = document.getElementById("placilo_predujema");
        if (placilo_predujema) placilo_predujema.value = data.placilo_predujema;

        const opombe = document.getElementById("opombe");
        if (opombe) opombe.value = data.opombe;

        const status = document.getElementById("status");
        if (status) status.value = data.status;

        const datum_izdaje = document.getElementById("datum_izdaje");
        if (datum_izdaje) datum_izdaje.value = data.datum_izdaje;

    } catch (error) {
        // Log and display error if travel order data loading fails.
        console.error("Napaka pri nalaganju podatkov:", error);
        showMessage(error.message || "Podatkov potnega naloga ni mogoče naložiti.");
    }
}

// HANDLE TRAVEL ORDER FORM SUBMISSION AND UPDATE DATA ON SERVER
const form = document.getElementById("travelOrderForm");

form.addEventListener("submit", async (event) => {
    // Prevent default form submission behavior.
    event.preventDefault();

    // Extract the travel order ID from the URL query parameters.
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("id");

    // Check if the travel order ID is present.
    if (!orderId) {
        document.getElementById("message").textContent = "ID potnega naloga ni podan.";
        document.getElementById("message").style.color = "red";
        return;
    }

    // COLLECT ALL FORM INPUT VALUES AND TRIM WHITESPACE
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
    const status = document.getElementById("status").value.trim();
    const datum_izdaje = document.getElementById("datum_izdaje").value.trim();

    // VALIDATE ALL REQUIRED FIELDS ARE FILLED
    if (!ime || !priimek || !namen || !vrsta_projekta || !lokacija_odhoda || !lokacija_prihoda || !datum_odhoda || !datum_prihoda || !vozilo || !datum_izdaje || !status) {
        document.getElementById("message").textContent = "Prosim izpolnite vsa obvezna polja!";
        document.getElementById("message").style.color = "red";
        return;
    }

    // VALIDATE CAR-SPECIFIC REQUIRED FIELDS
    if (vozilo === "car") {
        // Check if registration plate and VIN are provided for car vehicle type.
        if (!registerska || !vin) {
            document.getElementById("message").textContent = "Prosim izpolnite vsa obvezna polja!";
            document.getElementById("message").style.color = "red";
            showMessage("Za avto sta obvezni registrska tablica in VIN številka.");
            return; 
        }
    }

    // VALIDATE OTHER VEHICLE TYPE REQUIRES DESCRIPTION
    if (vozilo === "other") { 
        // Check if user provided a description for the alternative vehicle type.
        if (!drugo_vozilo) {
            document.getElementById("message").textContent = "Prosim napišite vrsto prevoznega sredstva!";
            document.getElementById("message").style.color = "red";
            showMessage("Vnesite drugo prevozno sredstvo.");
            return; 
        }
    }

    // VALIDATE ARRIVAL DATE IS AFTER DEPARTURE DATE
    const odhod = new Date(datum_odhoda);
    const prihod = new Date(datum_prihoda);

    // Ensure arrival time is later than departure time.
    if (odhod >= prihod) {
        showMessage("Datum in ura prihoda morata biti poznejša od odhoda.");
        return;
    }

    try {
        // SEND UPDATED TRAVEL ORDER DATA TO SERVER FOR PROCESSING
        const response = await fetch(`/api/admin/edit_travel_order/${orderId}`, {
            method: "PUT",
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                datum_izdaje: datum_izdaje,
                status: status,
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

        // Check if the request was successful.
        if (!response.ok) {
            // Read response as text to properly handle error messages.
            const text = await response.text();
            console.error("Napaka od strežnika:", text);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse the server response text.
        const text = await response.text();

        const data = JSON.parse(text);

        // Check if the travel order was successfully updated.
        if (data.success) {
            // Upload any newly selected files after successful update.
            await uploadTravelOrderFiles(orderId);
            
            // Display success message to user.
            document.getElementById("message").textContent = "Potni nalog je bil uspešno posodobljen!";
            document.getElementById("message").style.color = "green";
            showMessage("Potni nalog je bil posodobljen!");
        } else {
            // Display error message returned from server.
            document.getElementById("message").textContent = data.message || "Napaka";
            document.getElementById("message").style.color = "red";
        }

    } catch (error) {
        // Log detailed error information for debugging.
        console.error(error);
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);

        // Display user-friendly error message.
        showMessage("Pri posodabljanju potnega naloga je prišlo do napake.");
    }
});

// LOAD TRAVEL ORDER DATA WHEN PAGE FINISHES LOADING
document.addEventListener("DOMContentLoaded", loadAllDataOrder);