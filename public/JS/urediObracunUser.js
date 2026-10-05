// FILE FOR CALCULATING TRAVEL ALLOWANCES, MILEAGE, TOTAL EXPENSES, AND SAVING THE OBRAČUN



// Global variables to store travel days and daily allowance rate.
let travelDays = 0;
let dnevnicaIzBaze = 0;

// Fetch daily allowance rate for destination country from database.
async function pridobiDnevnico(drzavaId) {
    if (!drzavaId) {
        console.error("Manjka drzavaId.");
        return;
    }

    try {

        // Fetch daily allowance data for the specified country.
        const response = await fetch(`/api/dnevnica/${drzavaId}`);

        // Parse server response.
        const data = await response.json();

        // Check if the response was successful, throw error if not.
        if (!response.ok) {
            throw new Error(data.error || "Napaka pri pridobivanju dnevnice");
        }

        // Store the base daily allowance for 14+ day trips.
        dnevnicaIzBaze = data.dnevnica14;

    // Log error if fetching dnevnica fails.
    } catch (error) {
        console.error("Napaka pri pridobivanju dnevnice:", error);
    }
}

// Calculate travel days and generate table rows for each day.
function izracunajTravelDays() {

    const datumOdhoda = document.getElementById("datum_odhoda").value;
    const datumPrihoda = document.getElementById("datum_prihoda").value;

    // 
    const tableBody = document.getElementById("table1-body");

    if (!datumPrihoda) {
        return;
    }

    if (!datumOdhoda) {
        alert("Napaka: Datum odhoda ni naložen.");
        return;
    }

    // Convert date strings to Date objects for comparison.
    const odhod = new Date(datumOdhoda);
    const prihod = new Date(datumPrihoda);

    // Validate that arrival is after departure.
    if (prihod <= odhod) {
        travelDays = 0;
        tableBody.innerHTML = "";
        alert("Datum prihoda mora biti po datumu odhoda.");
        return;
    }


    // Save currently selected meals before recreating rows.
    const obstoječiObroki = [
        ...tableBody.querySelectorAll(".meal-select")
    ].map(select => select.value);


    // Calculate number of travel days between departure and arrival.
    const razlikaMs = prihod - odhod;

    travelDays = Math.ceil(
        razlikaMs / (1000 * 60 * 60 * 24)
    );


    // Recreate table rows for each travel day.
    ustvariVrsticeDnevnic();

    // Restore previously selected meals to new rows.
    const noviObroki = tableBody.querySelectorAll(".meal-select");


    noviObroki.forEach((select, index) => {

        if (obstoječiObroki[index] !== undefined) {

            select.value = obstoječiObroki[index];

            // Trigger calculation with restored meal selection.
            select.dispatchEvent(new Event("change"));

        }

    });
}

// Calculate daily allowance based on provided meals (deductions apply).
function izracunajDnevnico(obroki) {

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

    // Get deduction percentage for selected meals.
    const odstotek = odbitki[obroki] ?? 0;

    // Return allowance reduced by meal deduction.
    return dnevnicaIzBaze * (1 - odstotek);
}


// Calculate mileage reimbursement at 0.43 per kilometer.
function izracunajObracunKilometrine() {

    const kilometri_naprej = Number(document.getElementById("kilometri_naprej").value) || 0;

    const kilometri_nazaj = Number(document.getElementById("kilometri_nazaj").value) || 0;

    // Calculate reimbursement at 0.43 per km.
    const obracun_kilometrine_naprej = kilometri_naprej * 0.43;

    const obracun_kilometrine_nazaj = kilometri_nazaj * 0.43;

    // Display calculated reimbursement amounts.
    document.getElementById("obracun_kilometrine_naprej").value = obracun_kilometrine_naprej.toFixed(2);

    document.getElementById("obracun_kilometrine_nazaj").value = obracun_kilometrine_nazaj.toFixed(2);

    // Recalculate total expenses.
    skupniStroski();
}


// Calculate total expenses from daily allowances, mileage, and receipts.
function skupniStroski() {

    // Sum all daily allowance amounts.
    const dnevnice =
        document.querySelectorAll(".daily-allowance");

    let skupnoDnevnice = 0;

    dnevnice.forEach(function (input) {
        skupnoDnevnice += Number(input.value) || 0;
    });


    // Sum outbound and return journey mileage reimbursement.
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


    // Sum all expense receipt amounts.
    const racuni = document.querySelectorAll(
        'input[name="znesek_racuna[]"]'
    );

    let skupnoRacuni = 0;

    racuni.forEach(function (input) {
        skupnoRacuni += Number(input.value) || 0;
    });


    // Calculate grand total of all expenses.
    const skupaj =
        skupnoDnevnice +
        skupnoKilometrina +
        skupnoRacuni;

    // Display total expenses.
    document.getElementById("skupni_stroski").value =
        skupaj.toFixed(2);

    // Ensure employee payment doesn't exceed total expenses.
    const placilo = parseFloat(document.getElementById("placilo_zaposlenemu").value) || 0;
    const skupni = skupaj;
    
    if (placilo > skupni) {
        document.getElementById("placilo_zaposlenemu").value = skupni.toFixed(2);
    }
}


// Create table rows for each day of travel with date and meal selection.
function ustvariVrsticeDnevnic(dnevnici = null) {

    const tableBody = document.getElementById("table1-body");
    const datumOdhoda = document.getElementById("datum_odhoda").value;

    tableBody.innerHTML = "";

    const odhod = new Date(datumOdhoda);

    // Create a row for each travel day.
    for (let i = 0; i <= travelDays; i++) {

        const datum = new Date(odhod);

        datum.setDate(odhod.getDate() + i);

        const datumString =
            datum.toISOString().split("T")[0];

        let obrok = '';
        let dnevnica = dnevnicaIzBaze;

        // If loading existing data, use saved meal and allowance.
        if (dnevnici && dnevnici[i]) {
            obrok = dnevnici[i].zagotovljeni_obroki || '';
            dnevnica = dnevnici[i].dnevnica || dnevnicaIzBaze;
        }

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                ${i + 1}
            </td>

            <td>
                <input
                    type="date"
                    name="travelDate[]"
                    value="${datumString}"
                >
            </td>

            <td>
                <select
                    name="providedMeals[]"
                    class="meal-select"
                >
                    <option value="">Izberite obroke</option>
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

        const mealSelect =
            row.querySelector(".meal-select");

        const allowanceInput =
            row.querySelector(".daily-allowance");

        // Set meal selection to previously saved value.
        mealSelect.value = obrok;

        // Calculate allowance based on current meal selection.        
        allowanceInput.value =
            izracunajDnevnico(mealSelect.value).toFixed(2);


        // Recalculate allowance when meal selection changes.
        mealSelect.addEventListener("change", function () {

            const novaDnevnica =
                izracunajDnevnico(this.value);

            allowanceInput.value =
                novaDnevnica.toFixed(2);

            skupniStroski();
        });
    }

    // Recalculate total expenses after creating all rows.
    skupniStroski();
}


// Save billing data and file attachments to server.
async function saveObracun() {
    const orderId = new URLSearchParams(window.location.search).get('id');
    const form = document.getElementById('travelOrderForm');
    document.querySelectorAll('input[type="file"][name="racun_priponka[]"]').forEach((input, index) => {
        input.name = `racun_priponka[${index}]`;
    });
    const formData = new FormData(form);

    try {
        // Send billing data with file attachments to server.
        const response = await fetch(`/api/obracun/save/${orderId}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        const messageDiv = document.getElementById('message');

        if (result.success) {
            
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
            
            alert(`✅ Obračun je bil uspešno shranjen!\n\nSKUPAJ: €${result.povzetek.skupaj}`);
            
        } else {
            messageDiv.innerHTML = `
                <div style="background: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
                    ❌ Napaka: ${result.error}
                </div>
            `;
        }

    } catch (error) {
        console.error('Napaka:', error);
        
        messageDiv.innerHTML = `
            <div style="background: #f8d7da; color: #721c24; padding: 1rem; border-radius: 5px; margin-top: 1rem;">
                ❌ Napaka pri shranjevanju: ${error.message}
            </div>
        `;
        
        alert(`❌ Napaka: ${error.message}`);
    }
}


// Set up event listeners on page load.
document.addEventListener("DOMContentLoaded", async function () {

    // Recalculate travel days when arrival date changes.
    const datumPrihoda =
        document.getElementById("datum_prihoda");

    if (datumPrihoda) {
        datumPrihoda.addEventListener(
            "change",
            izracunajTravelDays
        );
    }

    // Calculate mileage reimbursement when kilometers change.
    const kilometriNaprej =
        document.getElementById("kilometri_naprej");

    const kilometriNazaj =
        document.getElementById("kilometri_nazaj");

    if (kilometriNaprej) {
        kilometriNaprej.addEventListener(
            "input",
            izracunajObracunKilometrine
        );
    }

    if (kilometriNazaj) {
        kilometriNazaj.addEventListener(
            "input",
            izracunajObracunKilometrine
        );
    }

    // Recalculate total expenses when receipt amounts change.
    const racuni = document.querySelectorAll(
        'input[name="znesek_racuna[]"]'
    );

    racuni.forEach(function (input) {

        input.addEventListener(
            "input",
            skupniStroski
        );

    });

    // Allow saving billing with Enter key.
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