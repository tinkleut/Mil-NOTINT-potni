// FILE FOR FETCHING TRAVEL ORDER DATA AND POPULATING EXISTING OBRAČUN DATA



async function getObracunData() {
    try {
        // Extract order ID from URL query parameter.
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("id");

        if (!orderId) {
            console.error("Manjka ID potnega naloga v URL-ju.");
            return;
        }

        // Fetch travel order information from the server.
        const response = await fetch(`/api/obracun_info/${orderId}`);

        if (!response.ok) {
            throw new Error(`HTTP napaka: ${response.status}`);
        }

        // Parse response to get travel order details.
        const data = await response.json();

        // Get destination country ID to look up daily allowance rate.
        const drzavaId = data.drzava_prihoda_id;

        // Fetch daily allowance amount for the destination country.
        const dnevnicaData = await pridobiDnevnico(drzavaId);

        // Store daily allowance globally for calculations.
        if (dnevnicaData) {
            window.dnevnicaIzBaze = dnevnicaData.dnevnica14 || 0;
        }

        // Populate order ID display field.
        const id = document.getElementById("id");
        if (id) {
            id.textContent = data.display_id || data.id || "";
        }

        // Fill in departure date.
        const datum_odhoda = document.getElementById("datum_odhoda");
        if (datum_odhoda) {
            datum_odhoda.value = data.datum_odhoda || "";
        }

        // Fill in arrival date.
        const datum_prihoda = document.getElementById("datum_prihoda");
        if (datum_prihoda) {
            datum_prihoda.value = data.datum_prihoda || "";
        }

        // Fill in departure location for outbound mileage.
        const kilometrina_lokacija_odhoda = document.getElementById("kilometrina_lokacija_odhoda");
        if (kilometrina_lokacija_odhoda) {
            kilometrina_lokacija_odhoda.value = data.lokacija_odhoda || "";
        }

        // Fill in arrival location for outbound mileage.
        const kilometrina_lokacija_prihoda = document.getElementById("kilometrina_lokacija_prihoda");
        if (kilometrina_lokacija_prihoda) {
            kilometrina_lokacija_prihoda.value = data.lokacija_prihoda || "";
        }

        // Fill in arrival location for return mileage.
        const kilometrina_lokacija_prihoda_nazaj = document.getElementById("kilometrina_lokacija_prihoda_nazaj");
        if (kilometrina_lokacija_prihoda_nazaj) {
            kilometrina_lokacija_prihoda_nazaj.value = data.lokacija_prihoda || "";
        }

        // Fill in departure location for return mileage.
        const kilometrina_lokacija_odhoda_nazaj = document.getElementById("kilometrina_lokacija_odhoda_nazaj");
        if (kilometrina_lokacija_odhoda_nazaj) {
            kilometrina_lokacija_odhoda_nazaj.value = data.lokacija_odhoda || "";
        }

        // Calculate travel days if both dates are present.
        if (datum_odhoda && datum_prihoda) {
            izracunajTravelDays();
        }

        // Validate dates are in correct order.
        validateTimes();

        // Fetch and populate all billing records.
        await getAllObracunData(orderId);

    } catch (error) {
        console.error("Napaka pri nalaganju podatkov:", error);
    }
}

async function getAllObracunData(orderId) {
    try {
        // Fetch all billing data for this travel order.
        const response = await fetch(`/api/obracun/${orderId}`);
        const data = await response.json();

        // If no billing record exists yet, create rows based on travel dates.
        if (!data.exists) {
            const datumOdhoda = document.getElementById("datum_odhoda");
            const datumPrihoda = document.getElementById("datum_prihoda");
            if (datumOdhoda && datumPrihoda && datumOdhoda.value && datumPrihoda.value) {
                izracunajTravelDays();
            }
            return;
        }

        // Populate daily allowance table with dates and meal selections.
        if (data.dnevnice && data.dnevnice.length > 0) {
            const tableBody = document.getElementById("table1-body");
            tableBody.innerHTML = "";

            data.dnevnice.forEach((dnevnica, index) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${index + 1}</td>

                    <td>
                        <input
                            type="date"
                            name="travelDate[]"
                            value="${dnevnica.datum}"
                        >
                    </td>

                    <td>
                        <select name="providedMeals[]" class="meal-select">
                            <option value="">Izberite obroke</option>
                            <option value="nic">Nič</option>
                            <option value="zajtrk">Zajtrk</option>
                            <option value="kosilo">Kosilo</option>
                            <option value="vecerja">Večerja</option>
                            <option value="zajtrk_kosilo">Zajtrk in kosilo</option>
                            <option value="zajtrk_vecerja">Zajtrk in večerja</option>
                            <option value="kosilo_vecerja">Kosilo in večerja</option>
                            <option value="zajtrk_kosilo_vecerja">Zajtrk, kosilo in večerja</option>
                        </select>
                    </td>

                    <td>
                        <input
                            type="number"
                            name="dailyAllowance[]"
                            class="daily-allowance"
                            value="${parseFloat(dnevnica.dnevnica).toFixed(2)}"
                            readonly
                        >
                    </td>
                `;
                tableBody.appendChild(row);

                // Set meal select to previously saved value.
                const mealSelect = row.querySelector(".meal-select");
                mealSelect.value = dnevnica.zagotovljeni_obroki || "";

                const allowanceInput = row.querySelector(".daily-allowance");

                // Recalculate allowance when meal selection changes.
                mealSelect.addEventListener("change", function () {
                    const novaDnevnica = izracunajDnevnico(this.value);
                    allowanceInput.value = novaDnevnica.toFixed(2);
                    skupniStroski();
                });
            });
        }

        // Populate mileage data for outbound and return journeys.
        if (data.kilometrine && data.kilometrine.length > 0) {
            data.kilometrine.forEach((km) => {
                if (km.smer === 'naprej') {
                    document.getElementById("kilometri_naprej").value = km.kilometri;
                    document.getElementById("obracun_kilometrine_naprej").value = parseFloat(km.obracun).toFixed(2);
                } else if (km.smer === 'nazaj') {
                    document.getElementById("kilometri_nazaj").value = km.kilometri;
                    document.getElementById("obracun_kilometrine_nazaj").value = parseFloat(km.obracun).toFixed(2);
                }
            });
        }

        // Populate expense receipt table with company, description, and amounts.
        if (data.racuni && data.racuni.length > 0) {
            const tbody = document.getElementById("table2-body");
            const rows = tbody.querySelectorAll("tr");

            data.racuni.forEach((racun, index) => {
                if (rows[index]) {
                    rows[index].querySelector('input[name="racun_podjetje[]"]').value = racun.podjetje || '';
                    rows[index].querySelector('input[name="opis_stroska[]"]').value = racun.opis_stroska || '';
                    rows[index].querySelector('input[name="znesek_racuna[]"]').value = parseFloat(racun.znesek).toFixed(2) || '';
                }
            });
        }

        // Fill in total expenses and employee payment amounts.
        if (data.obracun) {
            document.getElementById("skupni_stroski").value = parseFloat(data.obracun.skupni_stroski || 0).toFixed(2);
            document.getElementById("placilo_zaposlenemu").value = parseFloat(data.obracun.placilo_zaposlenemu || 0).toFixed(2);
        }

        // Refresh total costs calculation with all values.
        skupniStroski();

    } catch (error) {
        console.error("Napaka pri dobivanju informacij obračuna:", error);
    }
}

// Validate that dates and times are in correct chronological order.
function validateTimes() {
    const datumOdhoda = document.getElementById("datum_odhoda");
    const datumPrihoda = document.getElementById("datum_prihoda");

    const odhodVLjubljano = document.getElementById("odhod_v_ljubljano");
    const prihodVljubljano = document.getElementById("prihod_v_ljubljano");

    // Ensure arrival at destination is not before departure from Ljubljana.
    if (datumOdhoda && datumPrihoda) {
        if (datumOdhoda.value && datumPrihoda.value) {
            if (new Date(datumPrihoda.value) < new Date(datumOdhoda.value)) {
                datumPrihoda.setCustomValidity(
                    "Datum in ura prihoda na končno destinacijo ne moreta biti pred datumom in uro odhoda iz Ljubljane."
                );
            } else {
                datumPrihoda.setCustomValidity("");
            }
        }
    }

    // Ensure return departure is not after return arrival.
    if (odhodVLjubljano && prihodVljubljano) {
        if (odhodVLjubljano.value && prihodVljubljano.value) {
            if (new Date(odhodVLjubljano.value) > new Date(prihodVljubljano.value)) {
                odhodVLjubljano.setCustomValidity(
                    "Datum in ura odhoda v Ljubljano ne moreta biti po datumu in uri prihoda v Ljubljano."
                );
            } else {
                odhodVLjubljano.setCustomValidity("");
            }
        }
    }
}

// Initialize page on load and set up event listeners.
document.addEventListener("DOMContentLoaded", async function () {

    // Load all billing data for the travel order.
    await getObracunData();

    // Recalculate travel days when arrival date changes.
    const datumPrihoda = document.getElementById("datum_prihoda");

    if (datumPrihoda) {
        datumPrihoda.addEventListener(
            "change",
            izracunajTravelDays
        );
    }

    // Array of date/time fields to validate.
    const fields = [
        "datum_odhoda",
        "datum_prihoda",
        "odhod_v_ljubljano",
        "prihod_v_ljubljano"
    ];

    // Add validation listeners to all date fields.
    fields.forEach(id => {

        const field = document.getElementById(id);

        if (field) {
            field.addEventListener(
                "input",
                validateTimes
            );

            field.addEventListener(
                "change",
                validateTimes
            );
        }
    });

});