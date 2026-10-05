// FILE FOR DISPLAYING DATA OF FINISHED TRAVEL ORDER AND SAVING IT TO OFFICIAL DOCUMENT



// LOAD BASIC TRAVEL ORDER DATA
async function loadAllDataOrder() {
    try {
        // Extract travel order ID from URL query parameters.
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("id");

        // Fetch travel order data from the server using the order ID.
        const response = await fetch(`/api/admin/edit_travel_order/${orderId}`);

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error("Napaka pri pridobivanju informacij o potnem nalogu...");
        }

        // Parse response to get travel order data.
        const data = await response.json();

        // Autofill personal information fields if they exist on the page.
        const ime = document.getElementById("ime");
        if (ime) ime.value = data.ime;
        
        const priimek = document.getElementById("priimek");
        if (priimek) priimek.value = data.priimek;
        
        const prebivalisce = document.getElementById("prebivalisce");
        if (prebivalisce) prebivalisce.value = data.prebivalisce;
        
        const delovnoMesto = document.getElementById("delovno_mesto");
        if (delovnoMesto) delovnoMesto.value = data.delovno_mesto;

        // Autofill travel location information.
        const lokacija_odhoda = document.getElementById("lokacija_odhoda");
        if (lokacija_odhoda) lokacija_odhoda.value = data.lokacija_odhoda;

        const lokacija_prihoda = document.getElementById("lokacija_prihoda");
        if (lokacija_prihoda) lokacija_prihoda.value = data.lokacija_prihoda;

        // Autofill travel dates.
        const datum_odhoda = document.getElementById("datum_odhoda");
        if (datum_odhoda) datum_odhoda.value = data.datum_odhoda;

        const datum_prihoda = document.getElementById("datum_prihoda");
        if (datum_prihoda) datum_prihoda.value = data.datum_prihoda;

        // Autofill travel purpose and project type.
        const namen = document.getElementById("namen");
        if (namen) namen.value = data.namen;

        const vrsta_projekta = document.getElementById("vrsta_projekta");
        if (vrsta_projekta) vrsta_projekta.value = data.vrsta_projekta;

        // Handle vehicle type dropdown and show/hide additional vehicle details.
        const vozilo = document.getElementById("vehicle");
        const otherVehicleDetails = document.getElementById("otherVehicleDetails");

        if (vozilo) {
            // Set the vehicle type dropdown to the stored value.
            vozilo.value = data.vozilo || "";
            
            // Add event listener to show/hide "other vehicle" details based on selection.
            vozilo.addEventListener("change", function() {
                if (vozilo.value === "other") {
                    otherVehicleDetails.classList.remove("hidden");
                } else {
                    otherVehicleDetails.classList.add("hidden");
                }
            });
            
            // Trigger change event to show/hide fields based on current value.
            vozilo.dispatchEvent(new Event("change"));
        }

        // Autofill vehicle registration and identification details.
        const registerska = document.getElementById("registerska");
        if (registerska) {
            registerska.value = data.registerska || "";
        }

        const vin = document.getElementById("vin");
        if (vin) {
            vin.value = data.vin || "";
        }

        const drugo_vozilo = document.getElementById("other_vehicle");
        if (drugo_vozilo) {
            drugo_vozilo.value = data.drugo_vozilo || "";
        }

        // Autofill accommodation and advance payment information.
        const prenocisce = document.getElementById("prenocisce");
        if (prenocisce) prenocisce.value = data.prenocisce;

        const placilo_predujema = document.getElementById("placilo_predujema");
        if (placilo_predujema) placilo_predujema.value = data.placilo_predujema;

        // Autofill notes/remarks field.
        const opombe = document.getElementById("opombe");
        if (opombe) opombe.value = data.opombe;

        // Autofill status and issue date fields.
        const status = document.getElementById("status");
        if (status) status.value = data.status;

        const datum_izdaje = document.getElementById("datum_izdaje");
        if (datum_izdaje) datum_izdaje.value = data.datum_izdaje;

    } catch (error) {
        console.error("Napaka pri nalaganju podatkov:", error);
    }
}

// VARIABLES FOR CALCULATION
let travelDays = 0;
let dnevnicaIzBaze = 0;

// FUNCTION FOR DISPLAYING CALCULATION MESSAGES
function showCalculationMessage(text, type = "error") {
    // Get the message display element from the DOM.
    const message = document.getElementById("message");
    if (!message) return;
    
    // Set the message text content to the provided text parameter.
    message.textContent = text;
    
    // Apply CSS classes for styling: base "form-message" class plus type-specific class (e.g., "error", "success").
    message.className = `form-message ${type}`;
}

// FETCH DAILY ALLOWANCE RATES FROM DATABASE FOR DESTINATION COUNTRY
async function pridobiDnevnico(drzavaId) {
    // Ensure country ID is provided.
    if (!drzavaId) {
        console.error("Manjka drzavaId.");
        return;
    }

    try {
        // Fetch daily allowance rates for the specified country.
        const response = await fetch(`/api/admin/dnevnica-rate/${drzavaId}`);

        const data = await response.json();

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error(data.error || "Napaka pri pridobivanju dnevnice");
        }

        // Store the full day (14-hour) daily allowance rate from the database.
        dnevnicaIzBaze = data.dnevnica14;

    } catch (error) {
        console.error("Napaka pri pridobivanju dnevnice:", error);
    }
}

// CALCULATE TRAVEL DAYS AND CREATE/UPDATE TABLE ROWS
function izracunajTravelDays() {
    // Get departure and arrival dates from the form.
    const datumOdhoda = document.getElementById("datum_odhoda").value;
    const datumPrihoda = document.getElementById("datum_prihoda").value;

    const tableBody = document.getElementById("table1-body");

    // Ensure arrival date is provided.
    if (!datumPrihoda) {
        console.message("Vnesite datum prihoda");
        return;
    }

    // Ensure departure date is provided.
    if (!datumOdhoda) {
        showCalculationMessage("Napaka: Datum odhoda ni naložen.");
        return;
    }

    // Convert date strings to Date objects for comparison.
    const odhod = new Date(datumOdhoda);
    const prihod = new Date(datumPrihoda);

    // Validate that arrival date is after departure date.
    if (prihod <= odhod) {
        travelDays = 0;
        tableBody.innerHTML = "";
        showCalculationMessage("Datum prihoda mora biti po datumu odhoda.");
        return;
    }

    // SAVE CURRENTLY SELECTED MEALS BEFORE RECALCULATING
    const obstoječiObroki = [
        ...tableBody.querySelectorAll(".meal-select")
    ].map(select => select.value);

    // CALCULATE TRAVEL DAYS
    const razlikaMs = prihod - odhod;

    travelDays = Math.ceil(
        razlikaMs / (1000 * 60 * 60 * 24)
    );

    // RECREATE TABLE ROWS FOR NEW TRAVEL DAYS COUNT
    ustvariVrsticeDnevnic();

    // RESTORE PREVIOUSLY SELECTED MEALS IN NEW ROWS
    const noviObroki = tableBody.querySelectorAll(".meal-select");

    noviObroki.forEach((select, index) => {

        if (obstoječiObroki[index] !== undefined) {

            select.value = obstoječiObroki[index];

            // Manually trigger calculation for daily allowance.
            select.dispatchEvent(new Event("change"));

        }

    });
}

// CALCULATE DAILY ALLOWANCE BASED ON PROVIDED MEALS
function izracunajDnevnico(obroki) {
    // Define deduction percentages for each meal combination.
    const odbitki = {
        "": 0,
        "zajtrk": 0.10,
        "kosilo": 0.35,
        "vecerja": 0.35,
        "zajtrk_kosilo": 0.45,
        "zajtrk_vecerja": 0.45,
        "kosilo_vecerja": 0.80,
        "zajtrk_kosilo_vecerja": 0.80
    };

    // Get the deduction percentage for the selected meals.
    const odstotek = odbitki[obroki] ?? 0;

    // Return the adjusted daily allowance (base rate minus deduction).
    return dnevnicaIzBaze * (1 - odstotek);
}

// CALCULATE MILEAGE REIMBURSEMENT
function izracunajObracunKilometrine() {
    // Get outbound and return journey mileage values.
    const kilometri_naprej = Number(document.getElementById("kilometri_naprej").value) || 0;

    const kilometri_nazaj = Number(document.getElementById("kilometri_nazaj").value) || 0;

    // Calculate reimbursement at 0.43 per kilometer for each direction.
    const obracun_kilometrine_naprej = kilometri_naprej * 0.43;

    const obracun_kilometrine_nazaj = kilometri_nazaj * 0.43;

    // Update the calculation fields with formatted results.
    document.getElementById("obracun_kilometrine_naprej").value = obracun_kilometrine_naprej.toFixed(2);

    document.getElementById("obracun_kilometrine_nazaj").value = obracun_kilometrine_nazaj.toFixed(2);

    // Recalculate total expenses.
    skupniStroski();
}

// CALCULATE TOTAL EXPENSES
function skupniStroski() {
    // CALCULATE TOTAL DAILY ALLOWANCES
    const dnevnice = document.querySelectorAll(".daily-allowance");

    let skupnoDnevnice = 0;

    dnevnice.forEach(function (input) {
        skupnoDnevnice += Number(input.value) || 0;
    });

    // CALCULATE TOTAL MILEAGE REIMBURSEMENT
    const kilometrinaNaprej =
        Number(
            document.getElementById(
                "obracun_kilometrine_naprej"
            ).value
        ) || 0;

    const kilometrinaNazaj =
        Number(
            document.getElementById(
                "obracun_kilometrine_nazaj"
            ).value
        ) || 0;

    const skupnoKilometrina =
        kilometrinaNaprej + kilometrinaNazaj;

    // CALCULATE TOTAL RECEIPT/INVOICE EXPENSES
    const racuni = document.querySelectorAll(
        'input[name="znesek_racuna[]"]'
    );

    let skupnoRacuni = 0;

    racuni.forEach(function (input) {
        skupnoRacuni += Number(input.value) || 0;
    });

    // CALCULATE GRAND TOTAL
    const skupaj =
        skupnoDnevnice +
        skupnoKilometrina +
        skupnoRacuni;

    // Update the total expenses field with the calculated sum.
    document.getElementById("skupni_stroski").value =
        skupaj.toFixed(2);

    // Ensure employee payment does not exceed total expenses.
    const placilo = parseFloat(document.getElementById("placilo_zaposlenemu").value) || 0;
    const skupni = skupaj;
    
    if (placilo > skupni) {
        document.getElementById("placilo_zaposlenemu").value = skupni.toFixed(2);
    }
}

// CREATE OR UPDATE TABLE ROWS FOR EACH TRAVEL DAY
function ustvariVrsticeDnevnic(dnevnici = null) {
    // Get the table body element where daily allowance rows will be inserted.
    const tableBody = document.getElementById("table1-body");
    const datumOdhoda = document.getElementById("datum_odhoda").value;

    // Clear existing rows before creating new ones.
    tableBody.innerHTML = "";

    // Convert departure date string to Date object.
    const odhod = new Date(datumOdhoda);

    // Create a row for each day of travel (including partial days).
    for (let i = 0; i <= travelDays; i++) {

        // Calculate the current day's date.
        const datum = new Date(odhod);

        datum.setDate(odhod.getDate() + i);

        // Convert date to ISO format string for date input.
        const datumString =
            datum.toISOString().split("T")[0];

        // Initialize meal selection and allowance for this day.
        let obrok = '';
        let dnevnica = dnevnicaIzBaze;

        // If existing data is provided, use it to restore previous selections.
        if (dnevnici && dnevnici[i]) {
            obrok = dnevnici[i].zagotovljeni_obroki || '';
            dnevnica = dnevnici[i].dnevnica || dnevnicaIzBaze;
        }

        // Create a new table row element for this travel day.
        const row = document.createElement("tr");

        row.innerHTML = `
            <!-- Day number -->
            <td>
                ${i + 1}
            </td>

            <!-- Travel date input field -->
            <td>
                <input
                    type="date"
                    name="travelDate[]"
                    value="${datumString}"
                >
            </td>

            <!-- Provided meals dropdown - select which meals were provided -->
            <td>
                <select
                    name="providedMeals[]"
                    class="meal-select"
                >
                    <option value="">Izberite obroke</option>
                    <option value="nic">Nič</option>
                    <option value="zajtrk">Zajtrk</option>
                    <option value="kosilo">Kosilo</option>
                    <option value="vecerja">Večerja</option>
                    <option value="zajtrk_kosilo">Zajtrk in kosilo</option>
                    <option value="zajtrk_vecerja">Zajtrk in večerja</option>
                    <option value="kosilo_vecerja">Kosilo in večerja</option>
                    <option value="zajtrk_kosilo_vecerja">
                        Zajtrk, kosilo in večerja
                    </option>
                </select>
            </td>

            <!-- Daily allowance amount - calculated based on meals provided -->
            <td>
                <input
                    type="number"
                    name="dailyAllowance[]"
                    class="daily-allowance"
                    value="${dnevnica.toFixed(2)}"
                    readonly
                >
            </td>
        `;

        tableBody.appendChild(row);

        // Get the meal select dropdown and allowance input for this row.
        const mealSelect = row.querySelector(".meal-select");

        const allowanceInput = row.querySelector(".daily-allowance");

        // SET PREVIOUSLY SAVED MEAL SELECTION
        mealSelect.value = obrok;

        // IMMEDIATELY CALCULATE DAILY ALLOWANCE FOR THIS DAY
        allowanceInput.value =
            izracunajDnevnico(mealSelect.value).toFixed(2);

        // ADD EVENT LISTENER FOR MEAL SELECTION CHANGES
        mealSelect.addEventListener("change", function () {

            // Recalculate allowance when meal selection changes.
            const novaDnevnica =
                izracunajDnevnico(this.value);

            allowanceInput.value =
                novaDnevnica.toFixed(2);

            // Recalculate total expenses.
            skupniStroski();
        });
    }

    // CALCULATE TOTAL EXPENSES FOR ALL DAYS
    skupniStroski();
}

// INITIALIZE FORM ON PAGE LOAD
document.addEventListener("DOMContentLoaded", async function () {

    // Load all basic travel order data when page loads.
    await loadAllDataOrder();

    // Get the arrival date field for event listener attachment.
    const datumPrihoda =
        document.getElementById("datum_prihoda");

    // Recalculate travel days when arrival date changes.
    if (datumPrihoda) {
        datumPrihoda.addEventListener(
            "change",
            izracunajTravelDays
        );
    }

    // MILEAGE CALCULATION EVENT LISTENERS
    const kilometriNaprej =
        document.getElementById("kilometri_naprej");

    const kilometriNazaj =
        document.getElementById("kilometri_nazaj");

    // Recalculate mileage reimbursement when outbound mileage changes.
    if (kilometriNaprej) {
        kilometriNaprej.addEventListener(
            "input",
            izracunajObracunKilometrine
        );
    }

    // Recalculate mileage reimbursement when return mileage changes.
    if (kilometriNazaj) {
        kilometriNazaj.addEventListener(
            "input",
            izracunajObracunKilometrine
        );
    }

    // RECEIPT/INVOICE EXPENSE EVENT LISTENERS
    const racuni = document.querySelectorAll(
        'input[name="znesek_racuna[]"]'
    );

    // Recalculate total expenses when any receipt amount changes.
    racuni.forEach(function (input) {

        input.addEventListener(
            "input",
            skupniStroski
        );

    });

    // Allow form submission SAVE with Enter key.
    const form = document.getElementById('travelOrderForm');
    if (form) {
        form.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveObracun();
            }
        });
    }

    // Load and display existing completed travel orders if container exists.
    const container = document.querySelector("#travelOrders");
    if (container) {
        loadTravelOrders();
    }

    // Handle form submission for saving completed travel order data.
    const completedOrderForm = document.getElementById("travelOrderForm");
    if (completedOrderForm) {
        completedOrderForm.addEventListener("submit", shraniZakljucenNalog);
    }

});

// SAVE COMPLETED TRAVEL ORDER AND GENERATE WORD DOCUMENTS
async function shraniZakljucenNalog(event) {
    // Prevent page reload on form submission.
    event.preventDefault();

    // Extract travel order ID from URL query parameters.
    const orderId = new URLSearchParams(window.location.search).get("id");
    const form = event.currentTarget;
    
    // Ensure file input names are correctly indexed for server processing.
    document.querySelectorAll('input[type="file"][name="racun_priponka[]"]').forEach((input, index) => {
        input.name = `racun_priponka[${index}]`;
    });
    
    // Convert form data to both FormData and JSON formats for dual submission.
    const formData = new FormData(form);
    const jsonData = Object.fromEntries(formData.entries());
    
    // Map field names to ensure consistency (handle both naming conventions).
    jsonData.vozilo = jsonData.vehicle || jsonData.vozilo;
    jsonData.drugo_vozilo = jsonData.other_vehicle || jsonData.drugo_vozilo;

    try {
        // STEP 1: Save travel order data (personal info, dates, locations).
        const orderResponse = await fetch(`/api/admin/edit_travel_order/${orderId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonData)
        });

        // Check if travel order save was successful.
        if (!orderResponse.ok) throw new Error("Napaka pri shranjevanju potnega naloga.");

        // STEP 2: Save billing calculation data (daily allowances, mileage, receipts).
        const calculationResponse = await fetch(`/api/admin/obracun/save/${orderId}`, {
            method: "POST",
            body: formData
        });

        // Check if billing data save was successful.
        if (!calculationResponse.ok) {
            const errorData = await calculationResponse.json().catch(() => ({}));
            throw new Error(errorData.error || "Napaka pri shranjevanju obračuna.");
        }

        // Display success message without regenerating the Word documents.
        const message = document.getElementById("message");
        message.textContent = "Zaključen potni nalog in obračun sta bila uspešno posodobljena.";
        message.style.color = "green";
        setTimeout(() => {
            window.location.replace("/admin/closed");
        }, 1000);
    } catch (error) {
        // Log error for debugging.
        console.error(error);
        
        // Display user-friendly error message.
        const message = document.getElementById("message");
        message.textContent = error.message;
        message.style.color = "red";
    }
}