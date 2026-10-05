// FILE FOR GETTING TRAVEL ORDER BILLING INFO AND SAVING DATA



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

// DELETE SAVED ATTACHMENT FILE FROM BILLING RECORD
async function clearFile(button) {
    // Get the table cell containing the file input and saved attachments.
    const fileCell = button.closest("td");
    
    // Get the file input element from the cell.
    const fileInput = fileCell?.querySelector('input[type="file"]');
    
    // Parse attachment IDs from the button's data attribute to identify files to delete.
    const attachmentIds = JSON.parse(button.dataset.attachmentIds || "[]");

    // If there are saved attachments, request confirmation before deletion.
    if (attachmentIds.length > 0) {
        if (!confirm("Odstranim shranjeno priponko?")) return;

        // Delete each attachment file from the server.
        for (const attachmentId of attachmentIds) {
            const response = await fetch(`/api/admin/obracun/file/${attachmentId}`, {
                method: "DELETE"
            });

            // Check if the deletion was successful.
            if (!response.ok) {
                showCalculationMessage("Priponke ni bilo mogoče odstraniti.");
                return;
            }
        }

        // Remove all saved attachment display elements from the DOM.
        fileCell.querySelectorAll(".saved-attachment").forEach(element => element.remove());
        
        // Clear the attachment IDs array in the button's data attribute.
        button.dataset.attachmentIds = "[]";
    }

    // Clear the file input field to allow selecting a new file.
    if (fileInput) fileInput.value = "";
}

// LOAD BASIC TRAVEL ORDER DATA AND INITIALIZE FORM
async function getObracunData() {
    try {
        // Extract travel order ID from URL query parameters.
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("id");

        // Ensure order ID exists before proceeding.
        if (!orderId) {
            console.error("Manjka ID potnega naloga v URL-ju.");
            return;
        }

        // Fetch basic travel order information from the server.
        const response = await fetch(`/api/admin/obracun_info/${orderId}`);

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error(`HTTP napaka: ${response.status}`);
        }

        // Parse response to get travel order data.
        const data = await response.json();

        // Extract destination country ID for daily allowance lookup.
        const drzavaId = data.drzava_prihoda_id;

        // Fetch and apply daily allowance rates for the destination country.
        await pridobiDnevnico(drzavaId);

        // Autofill order ID display field.
        const id = document.getElementById("id");
        if (id) {
            id.textContent = data.id || "";
        }

        // Autofill departure date field.
        const datum_odhoda = document.getElementById("datum_odhoda");
        if (datum_odhoda) {
            datum_odhoda.value = data.datum_odhoda || "";
        }

        // Autofill arrival date field.
        const datum_prihoda = document.getElementById("datum_prihoda");
        if (datum_prihoda) {
            datum_prihoda.value = data.datum_prihoda || "";
        }

        // Autofill departure location for mileage calculation.
        const kilometrina_lokacija_odhoda = document.getElementById("kilometrina_lokacija_odhoda");
        if (kilometrina_lokacija_odhoda) {
            kilometrina_lokacija_odhoda.value = data.lokacija_odhoda || "";
        }

        // Autofill arrival location for mileage calculation (outbound journey).
        const kilometrina_lokacija_prihoda = document.getElementById("kilometrina_lokacija_prihoda");
        if (kilometrina_lokacija_prihoda) {
            kilometrina_lokacija_prihoda.value = data.lokacija_prihoda || "";
        }

        // Autofill arrival location for mileage calculation (return journey).
        const kilometrina_lokacija_prihoda_nazaj = document.getElementById("kilometrina_lokacija_prihoda_nazaj");
        if (kilometrina_lokacija_prihoda_nazaj) {
            kilometrina_lokacija_prihoda_nazaj.value = data.lokacija_prihoda || "";
        }

        // Autofill departure location for mileage calculation (return journey).
        const kilometrina_lokacija_odhoda_nazaj = document.getElementById("kilometrina_lokacija_odhoda_nazaj");
        if (kilometrina_lokacija_odhoda_nazaj) {
            kilometrina_lokacija_odhoda_nazaj.value = data.lokacija_odhoda || "";
        }

        // Load all detailed billing data (daily allowances, mileage, receipts, totals).
        await getAllObracunData(orderId);

        // Calculate travel days if both dates are available.
        if (datum_odhoda && datum_prihoda) {
            izracunajTravelDays();
        }

        // Validate time field relationships.
        validateTimes();

    } catch (error) {
        console.error("Napaka pri nalaganju podatkov:", error);
    }
}

// LOAD ALL DETAILED BILLING DATA FOR THE TRAVEL ORDER
async function getAllObracunData(orderId) {
    try {
        // Fetch all billing data for the specific travel order.
        const response = await fetch(`/api/admin/obracun/${orderId}`);
        const data = await response.json();

        // Check if billing record exists for this order.
        if (!data.exists) {
            return;
        }

        // POPULATE DAILY ALLOWANCE TABLE
        if (data.dnevnice && data.dnevnice.length > 0) {
            // Get the table body element where daily allowance rows will be inserted.
            const tableBody = document.getElementById("table1-body");
            tableBody.innerHTML = "";

            // Create a row for each day of the travel order.
            data.dnevnice.forEach((dnevnica, index) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <!-- Row number -->
                    <td>${index + 1}</td>

                    <!-- Travel date input field -->
                    <td>
                        <input
                            type="date"
                            name="travelDate[]"
                            value="${dnevnica.datum}"
                        >
                    </td>

                    <!-- Provided meals dropdown - select which meals were provided -->
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

                    <!-- Daily allowance amount - calculated based on meals provided -->
                    <td>
                        <input
                            type="number"
                            name="dailyAllowance[]"
                            class="daily-allowance"
                            value="${dnevnica.dnevnica.toFixed(2)}"
                            readonly
                        >
                    </td>
                `;
                tableBody.appendChild(row);

                // Set the meal select dropdown to the saved value from database.
                const mealSelect = row.querySelector(".meal-select");
                mealSelect.value = dnevnica.zagotovljeni_obroki || "";

                // Get the daily allowance input field for updating when meals change.
                const allowanceInput = row.querySelector(".daily-allowance");

                // Add event listener to recalculate allowance when meal selection changes.
                mealSelect.addEventListener("change", function () {
                    const novaDnevnica = izracunajDnevnico(this.value);
                    allowanceInput.value = novaDnevnica.toFixed(2);
                    skupniStroski();
                });
            });
        }

        // POPULATE MILEAGE DATA
        if (data.kilometrine && data.kilometrine.length > 0) {
            // Process each mileage record (outbound and return journeys).
            data.kilometrine.forEach((km) => {
                // Set outbound journey mileage.
                if (km.smer === 'naprej') {
                    document.getElementById("kilometri_naprej").value = km.kilometri;
                    document.getElementById("obracun_kilometrine_naprej").value =
                        Number(km.obracun || 0).toFixed(2);

                // Set return journey mileage.
                } else if (km.smer === 'nazaj') {
                    document.getElementById("kilometri_nazaj").value = km.kilometri;
                    document.getElementById("obracun_kilometrine_nazaj").value =
                        Number(km.obracun || 0).toFixed(2);

                }
            });
        }

        // POPULATE RECEIPTS/INVOICES TABLE
        if (data.racuni && data.racuni.length > 0) {
            // Get the table body element for receipts.
            const tbody = document.getElementById("table2-body");
            const rows = tbody.querySelectorAll("tr");

            // Fill each receipt row with saved data.
            data.racuni.forEach((racun, index) => {
                if (rows[index]) {
                    // Set company/vendor name.
                    rows[index].querySelector('input[name="racun_podjetje[]"]').value = racun.podjetje || '';
                    
                    // Set expense description.
                    rows[index].querySelector('input[name="opis_stroska[]"]').value = racun.opis_stroska || '';
                    
                    // Set receipt amount.
                    rows[index].querySelector('input[name="znesek_racuna[]"]').value = racun.znesek || '';

                    // Set saved attachments for this receipt.
                    const fileCell = rows[index].querySelector('input[type="file"]')?.parentElement;
                    if (fileCell && Array.isArray(racun.priponke)) {
                        const clearButton = fileCell.querySelector(".clear-file");
                        const attachmentIds = racun.priponke.map(priponka => priponka.id);
                        if (clearButton) clearButton.dataset.attachmentIds = JSON.stringify(attachmentIds);

                        // Display links to saved attachment files.
                        racun.priponke.forEach(priponka => {
                            const link = document.createElement("a");
                            link.className = "saved-attachment";
                            link.href = `/api/admin/obracun/file/${priponka.id}`;
                            link.target = "_blank";
                            link.rel = "noopener";
                            link.textContent = `Odpri: ${priponka.originalno_ime}`;
                            fileCell.appendChild(link);
                            fileCell.appendChild(document.createElement("br"));
                        });
                    }
                }
            });
        }

        // POPULATE BILLING SUMMARY TOTALS
        if (data.obracun) {
            // Set total expenses field.
            document.getElementById("skupni_stroski").value =
                Number(data.obracun.skupni_stroski || 0).toFixed(2);

            // Set payment to employee field.
            document.getElementById("placilo_zaposlenemu").value =
                Number(data.obracun.placilo_zaposlenemu || 0).toFixed(2);
        }

        // Recalculate total expenses to ensure consistency.
        skupniStroski();

    } catch (error) {
        console.error("Napaka pri dobivanju informacij obračuna:", error);
    }
}

// FUNCTION FOR VALIDATING TIME FIELD RELATIONSHIPS
function validateTimes() {
    // Get departure and arrival date/time fields for final destination.
    const datumOdhoda = document.getElementById("datum_odhoda");
    const datumPrihoda = document.getElementById("datum_prihoda");

    // Get departure and arrival time fields for Ljubljana (home city).
    const odhodVLjubljano = document.getElementById("odhod_v_ljubljano");
    const prihodVljubljano = document.getElementById("prihod_v_ljubljano");

    // VALIDATION: Arrival at final destination cannot be before departure from Ljubljana.
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

    // VALIDATION: Departure from Ljubljana cannot be after arrival in Ljubljana.
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

// INITIALIZE FORM ON PAGE LOAD
document.addEventListener("DOMContentLoaded", async function () {

    // Load all billing data when page loads.
    await getObracunData();

    // Get the arrival date field for event listener attachment.
    const datumPrihoda = document.getElementById("datum_prihoda");

    // Recalculate travel days when arrival date changes.
    if (datumPrihoda) {
        datumPrihoda.addEventListener(
            "change",
            izracunajTravelDays
        );
    }

    // List of date/time field IDs that need validation.
    const fields = [
        "datum_odhoda",
        "datum_prihoda",
        "odhod_v_ljubljano",
        "prihod_v_ljubljano"
    ];

    // Attach validation listeners to each date/time field.
    fields.forEach(id => {

        const field = document.getElementById(id);

        if (field) {
            // Validate on input change.
            field.addEventListener(
                "input",
                validateTimes
            );

            // Validate on value change.
            field.addEventListener(
                "change",
                validateTimes
            );
        }
    });

});