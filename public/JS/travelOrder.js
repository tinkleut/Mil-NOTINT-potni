// FILE FOR SUBMITTING THE TRAVEL ORDER



// BUTTON SUBMIT TRAVEL ORDER
const submitNalog = document.getElementById("travelOrderForm");


// Function for displaying the right messages.
function showFormMessage(text, type = "error") {
    const message = document.getElementById("message");
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`;
}

submitNalog.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Collect all form data and trim it.
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
        showFormMessage("Prosim izpolnite vsa obvezna polja.");
        return;
    }

    // If user selected "car", require registration number and VIN.
    if (vozilo === "car") {
        if (!registerska || !vin) {
            showFormMessage("Za avto sta obvezni registrska tablica in VIN številka.");
            return; 
        }
    }

    // If user selected "other" vehicle, require description of vehicle type.
    if (vozilo === "other") { 
        if (!drugo_vozilo) {
            showFormMessage("Vnesite drugo prevozno sredstvo.");
            return; 
        }
    }

    // Convert date strings to Date objects for comparison.
    const odhod = new Date(datum_odhoda);
    const prihod = new Date(datum_prihoda);


    // Ensure departure date is before arrival date.
    if (odhod >= prihod) {
        showFormMessage("Datum in ura prihoda morata biti poznejša od odhoda.");
        return;
    }

    try {
        // Send travel order data to the server via POST request.
        const response = await fetch("/api/travel_order", {

            // Use the POST method for secure data transfer to server.
            method: "POST",

            body: (() => {
                const formData = new FormData(submitNalog);
                formData.set("vozilo", vozilo);
                formData.set("registerska", registerska);
                formData.set("vin", vin);
                formData.set("drugo_vozilo", drugo_vozilo);
                return formData;
            })()
        });

        // The server sends as response a JSON object so we need to parse it into JS object.
        const data = await response.json();

        // Check if server confirmed that travel order was successfully created.
        if (data.success) {
            showFormMessage("Potni nalog je bil uspešno ustvarjen.", "success");
            document.getElementById("namen").value = "";
            document.getElementById("vrsta_projekta").value = "";
            document.getElementById("lokacija_prihoda").value = "";
            document.getElementById("datum_odhoda").value = "";
            document.getElementById("datum_prihoda").value = "";
            document.getElementById("vehicle").value = "";
            document.getElementById("other_vehicle").value = "";
            document.getElementById("registerska").value = "";
            document.getElementById("vin").value = "";
            document.getElementById("prenocisce").value = "";
            document.getElementById("placilo_predujema").value = "";
            document.getElementById("opombe").value = "";
    
        } else {
            showFormMessage(data.message || "Napaka pri shranjevanju.");
        }

    // Catch any errors that may occur.
    } catch (error) {
        showFormMessage(error.message || "Napaka pri pošiljanju podatkov na strežnik.");
        console.error("Request failed:", error);
    }
});