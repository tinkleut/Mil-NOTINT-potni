// GET THE TRAVEL ORDER FORM AND SET UP SUBMISSION HANDLER



const submitNalog = document.getElementById("travelOrderForm");

// DISPLAY FORM MESSAGE WITH SPECIFIED TYPE (ERROR OR SUCCESS)
function showFormMessage(text, type = "error") {
    // Get the message display element from the DOM.
    const message = document.getElementById("message");
    if (!message) return;
    
    // Set message text and apply appropriate CSS class for styling.
    message.textContent = text;
    message.className = `form-message ${type}`;
}

// HANDLE TRAVEL ORDER FORM SUBMISSION AND VALIDATION
submitNalog.addEventListener("submit", async (event) => {
    // Prevent default form submission behavior.
    event.preventDefault();

    // Collect all form input values and trim whitespace.
    const employee_id = document.getElementById("uname").value.trim();
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

    // VALIDATE ALL REQUIRED FIELDS ARE FILLED
    if (!ime || !priimek || !namen || !vrsta_projekta || !lokacija_odhoda || !lokacija_prihoda || !datum_odhoda || !datum_prihoda || !vozilo) {
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
            showFormMessage("Za avto sta obvezni registrska tablica in VIN številka.");
            return; 
        }
    }

    // VALIDATE OTHER VEHICLE TYPE REQUIRES DESCRIPTION
    if (vozilo === "other") { 
        // Check if user provided a description for the alternative vehicle type.
        if (!drugo_vozilo) {
            document.getElementById("message").textContent = "Prosim napišite vrsto prevoznega sredstva!";
            document.getElementById("message").style.color = "red";
            showFormMessage("Vnesite drugo prevozno sredstvo.");
            return; 
        }
    }

    // VALIDATE ARRIVAL DATE IS AFTER DEPARTURE DATE
    const odhod = new Date(datum_odhoda);
    const prihod = new Date(datum_prihoda);

    // Ensure arrival time is later than departure time.
    if (odhod >= prihod) {
        showFormMessage("Datum in ura prihoda morata biti poznejša od odhoda.");
        return;
    }

    try {
        // SEND TRAVEL ORDER DATA TO SERVER FOR PROCESSING
        const response = await fetch("/api/travel_order", {
            method: "POST",
            body: (() => {
                // Build FormData object with all collected form values.
                const formData = new FormData(submitNalog);
                formData.set("employee_id", employee_id);
                formData.set("vozilo", vozilo);
                formData.set("registerska", registerska);
                formData.set("vin", vin);
                formData.set("drugo_vozilo", drugo_vozilo);
                return formData;
            })()
        });

        // Parse server response to check for success or error.
        const data = await response.json();

        // Check if the travel order was successfully created.
        if (data.success) {
            // Display success message and clear the form for new entry.
            showFormMessage("Potni nalog je bil uspešno ustvarjen.", "success");
            document.getElementById("travelOrderForm").reset();
        } else {
            // Display error message returned from server.
            showFormMessage(data.message || "Napaka pri shranjevanju.");
        }

    } catch (error) {
        // Display error message if request to server fails.
        showFormMessage(error.message || "Napaka pri pošiljanju podatkov na strežnik.");
        console.error("Request failed:", error);
    }
});