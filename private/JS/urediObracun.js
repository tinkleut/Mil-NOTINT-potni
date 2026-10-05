// FILE FOR BILLING CALCULATIONS WITH VARIABLE DAILY ALLOWANCE RATES



// VARIABLES FOR CALCULATION
let travelDays = 0;
let dnevnicaIzBaze = 0;
let dnevnicePoUrah = { 14: 0, 8: 0, 6: 0 };

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

// GET DAILY ALLOWANCE RATE FOR SPECIFIC HOURS
function dnevnicaZaUre(ure) {
    // Return the daily allowance rate for the specified hours (14, 8, or 6 hour rates).
    return dnevnicePoUrah[ure] || 0;
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

        // Store daily allowance rates for all hour categories (14-hour, 8-hour, 6-hour).
        dnevnicePoUrah = {
            14: Number(data.dnevnica14) || 0,
            8: Number(data.dnevnica8) || 0,
            6: Number(data.dnevnica6) || 0
        };
        
        // Set the base daily allowance to the 14-hour rate.
        dnevnicaIzBaze = dnevnicaZaUre("14");

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

// CALCULATE DAILY ALLOWANCE BASED ON PROVIDED MEALS AND HOURS
function izracunajDnevnico(obroki, ure = "14") {
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

    // Return the adjusted daily allowance based on hours and meals (base rate minus deduction).
    return dnevnicaZaUre(ure) * (1 - odstotek);
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

        // Initialize meal selection, allowance, and hours for this day.
        let obrok = '';
        let dnevnica = dnevnicaIzBaze;
        let ure = "14";

        // If existing data is provided, use it to restore previous selections.
        if (dnevnici && dnevnici[i]) {
            obrok = dnevnici[i].zagotovljeni_obroki || '';
            dnevnica = dnevnici[i].dnevnica || dnevnicaIzBaze;
            ure = String(dnevnici[i].dnevnica_ure || 14);
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

            <!-- Daily allowance hours dropdown - select rate category (14, 8, or 6 hours) -->
            <td>
                <select
                    name="dnevnicaUre[]"
                    class="daily-allowance-hours"
                >
                    <option value="14">14 ur</option>
                    <option value="8">8 ur</option>
                    <option value="6">6 ur</option>
                </select>
            </td>

            <!-- Daily allowance amount - calculated based on meals provided and hours selected -->
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

        // Get the meal select dropdown, hours select dropdown, and allowance input for this row.
        const mealSelect = row.querySelector(".meal-select");

        const allowanceInput = row.querySelector(".daily-allowance");

        const hoursSelect = row.querySelector(".daily-allowance-hours");

        // SET PREVIOUSLY SAVED MEAL SELECTION AND HOURS
        mealSelect.value = obrok;
        hoursSelect.value = ure;

        // IMMEDIATELY CALCULATE DAILY ALLOWANCE FOR THIS DAY
        allowanceInput.value =
            izracunajDnevnico(mealSelect.value, hoursSelect.value).toFixed(2);

        // ADD EVENT LISTENER FOR HOURS SELECTION CHANGES
        hoursSelect.addEventListener("change", function () {
            // Recalculate allowance when hours category changes.
            allowanceInput.value =
                izracunajDnevnico(mealSelect.value, this.value).toFixed(2);
            
            // Recalculate total expenses.
            skupniStroski();
        });

        // ADD EVENT LISTENER FOR MEAL SELECTION CHANGES
        mealSelect.addEventListener("change", function () {

            // Recalculate allowance when meal selection changes.
            const novaDnevnica =
                izracunajDnevnico(this.value, hoursSelect.value);

            allowanceInput.value =
                novaDnevnica.toFixed(2);

            // Recalculate total expenses.
            skupniStroski();
        });
    }

    // CALCULATE TOTAL EXPENSES FOR ALL DAYS
    skupniStroski();
}

// SAVE BILLING CALCULATION DATA
async function saveObracun() {
    // Extract travel order ID from URL query parameters.
    const orderId = new URLSearchParams(window.location.search).get('id');
    
    // Get the form element for collecting all billing data.
    const form = document.getElementById('travelOrderForm');
    
    // Ensure file input names are correctly indexed for server processing.
    document.querySelectorAll('input[type="file"][name="racun_priponka[]"]').forEach((input, index) => {
        input.name = `racun_priponka[${index}]`;
    });
    
    // Convert form data to FormData object for submission.
    const formData = new FormData(form);

    try {
        // Send POST request to save billing calculation data.
        const response = await fetch(`/api/admin/obracun/save/${orderId}`, {
            method: 'POST',
            body: formData
        });

        // Check if the request was successful.
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Parse response data as JSON.
        const result = await response.json();

        const messageDiv = document.getElementById('message');

        // Check if the server returned a success status.
        if (result.success) {
            
            // Display detailed summary of saved expenses with styled HTML.
            messageDiv.innerHTML = `
                <div style="background: #d4edda; color: #155724; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
                    ✅ Obračun je bil uspešno shranjen!<br>
                    <strong>Povzetek:</strong><br>
                    Dnevnice: €${result.povzetek.dnevnice}<br>
                    Kilometrina: €${result.povzetek.kilometrina}<br>
                    Računi: €${result.povzetek.racuni}<br>
                    <strong>SKUPAJ: €${result.povzetek.skupaj}</strong>
                </div>
            `;
            
            // Display confirmation message.
            showCalculationMessage(`Obračun je bil uspešno shranjen. Skupaj: €${result.povzetek.skupaj}`, "success");
            
        } else {
            // Display error message from server if operation failed.
            console.log("Server success=false:", result.error);
            messageDiv.innerHTML = `
                <div style="background: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
                    ❌ Napaka: ${result.error}
                </div>
            `;
        }

    } catch (error) {
        console.error('Napaka:', error);
        
        // Display error message with styled HTML.
        messageDiv.innerHTML = `
            <div style="background: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
                ❌ Napaka pri shranjevanju: ${error.message}
            </div>
        `;
        
        showCalculationMessage(`Napaka: ${error.message}`);
    }
}

// COMPLETE AND FINALIZE BILLING CALCULATION
async function endObracun() {
    // Extract travel order ID from URL query parameters.
    const orderId = new URLSearchParams(window.location.search).get('id');
    
    // Get the form element for collecting all billing data.
    const form = document.getElementById('travelOrderForm');
    
    // Convert form data to FormData object for submission.
    const formData = new FormData(form);

    try {
        // Send POST request to complete and finalize the billing calculation.
        const response = await fetch(`/api/admin/obracun/end/${orderId}`, {
            method: 'POST',
            body: formData
        });

        console.log("Response status:", response.status);
        console.log("Response OK:", response.ok);

        // Check if the request was successful.
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Parse response data as JSON.
        const result = await response.json();

        const messageDiv = document.getElementById('message');

        // Check if the server returned a success status.
        if (result.success) {            
            // Display detailed summary of completed billing with styled HTML.
            messageDiv.innerHTML = `
                <div style="background: #d4edda; color: #155724; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
                    ✅ Obračun je bil uspešno končan!<br>
                    <strong>Povzetek:</strong><br>
                    Dnevnice: €${result.povzetek.dnevnice}<br>
                    Kilometrina: €${result.povzetek.kilometrina}<br>
                    Računi: €${result.povzetek.racuni}<br>
                    <strong>SKUPAJ: €${result.povzetek.skupaj}</strong><br>
                    <strong>Status: COMPLETED</strong>
                </div>
            `;
            
            // Display confirmation message.
            showCalculationMessage(`Obračun je bil uspešno končan. Skupaj: €${result.povzetek.skupaj}`, "success");
            
        } else {
            // Display error message from server if operation failed.
            console.log("Server success=false:", result.error);
            messageDiv.innerHTML = `
                <div style="background: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
                    ❌ Napaka: ${result.error}
                </div>
            `;
        }

    } catch (error) {
        console.error('Napaka:', error);
        
        // Display error message with styled HTML.
        messageDiv.innerHTML = `
            <div style="background: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
                ❌ Napaka pri končanju obračuna: ${error.message}
            </div>
        `;
        
        showCalculationMessage(`Napaka: ${error.message}`);
    }
}

// INITIALIZE FORM ON PAGE LOAD
document.addEventListener("DOMContentLoaded", async function () {

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

    // Allow form submission with Enter key.
    const form = document.getElementById('travelOrderForm');
    if (form) {
        form.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveObracun();
            }
        });
    }

});