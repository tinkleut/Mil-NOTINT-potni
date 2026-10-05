// FILE FOR EDITING DAILY ALLOWANCE (DNEVNICA) INFORMATION



// Get form element, extract dnevnica ID from URL, and get message display element.
const dnevnicaForm = document.getElementById("dnevnicaForm");
const dnevnicaId = new URLSearchParams(window.location.search).get("id");
const messageElement = document.getElementById("message");

const currencySymbols = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    "€": "€",
    "$": "$",
    "£": "£"
};

// FUNCTION FOR DISPLAYING MESSAGES
function showMessage(text, type = "error") {
    // Set the message text content to the provided text parameter.
    messageElement.textContent = text;
    
    // Apply CSS classes for styling: base "form-message" class plus type-specific class (e.g., "error", "success").
    messageElement.className = `form-message ${type}`;
}

// LOAD EXISTING DNEVNICA DATA FOR EDITING
async function loadDnevnica() {
    // Check if dnevnica ID exists in the URL query parameters.
    if (!dnevnicaId) {
        showMessage("Manjka ID dnevnice v naslovu strani.");
        return;
    }
    
    // Fetch the dnevnica data from the server using the dnevnica ID.
    const response = await fetch(`/api/admin/dnevnica/${dnevnicaId}`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || data.error || "Dnevnice ni mogoče naložiti.");
    }
    
    // Update the form title to indicate we are editing an existing dnevnica.
    document.getElementById("dnevnicaModalTitle").textContent = "Uredi dnevnico";
    
    // Extract country name from various possible field names in the response.
    const drzava = data.drzava || data.naziv || data.drzava_naziv || "";
    
    // Ensure country data was retrieved successfully.
    if (!drzava) throw new Error("Države za to dnevnico ni mogoče najti.");
    
    // Autofill all form fields with existing dnevnica data.
    document.getElementById("dnevnica-drzava").value = drzava;
    document.getElementById("dnevnica-valuta").value = currencySymbols[data.valuta] || data.valuta || "€";
    document.getElementById("dnevnica-14-celota").value = data.dnevnica14;
    document.getElementById("dnevnica-8-celota").value = data.dnevnica8;
    document.getElementById("dnevnica-6-celota").value = data.dnevnica6;
}

// HANDLE FORM SUBMISSION FOR SAVING DNEVNICA DATA
dnevnicaForm.addEventListener("submit", async (event) => {
    // Prevent page reload on form submission.
    event.preventDefault();

    // Extract all input values from the form fields.
    const dnevnica_drzava = document.getElementById("dnevnica-drzava").value;
    const dnevnica_valuta = document.getElementById("dnevnica-valuta").value;
    const dnevnica_14_celota = document.getElementById("dnevnica-14-celota").value;
    const dnevnica_8_celota = document.getElementById("dnevnica-8-celota").value;
    const dnevnica_6_celota = document.getElementById("dnevnica-6-celota").value;

    // Validate that all required fields are filled in.
    if (
        !dnevnica_drzava ||
        dnevnica_14_celota === "" ||
        dnevnica_8_celota === "" ||
        dnevnica_6_celota === ""
    ) {
        showMessage("Prosim izpolnite vsa polja");
        return;
    }

    try {
        // Determine whether to use PUT (edit) or POST (create) method based on dnevnica ID.
        // If editing existing dnevnica, use PUT; if creating new, use POST.
        const response = await fetch(dnevnicaId ? `/api/admin/dnevnica/${dnevnicaId}` : "/api/admin/dodaj_dnevnico", {
            method: dnevnicaId ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // Convert all form field values into JSON format for server.
            body: JSON.stringify({
                dnevnica_drzava,
                dnevnica_valuta,
                dnevnica_14_celota,
                dnevnica_8_celota,
                dnevnica_6_celota
            }) 
        });

        // Parse response data as JSON.
        const data = await response.json();

        // Check if the server returned a success status.
        if (response.ok && data.success) {
            // Display success message to the user.
            showMessage(data.message || "Dnevnica je bila uspešno shranjena.", "success");
            
            // Clear all form fields after successful submission.
            document.getElementById("dnevnicaForm").reset();
        } else {
            // Display error message from server if operation failed.
            showMessage(data.message || data.error || "Napaka pri shranjevanju");
        }
    } catch (error) {
        // Display error message if request fails.
        showMessage("Napaka pri pošiljanju podatkov na strežnik!");
        console.error("Request failed:", error);
    }

});

// Load and display existing dnevnica data when page finishes loading, or show error if loading fails.
loadDnevnica().catch(error => {
    showMessage(error.message);
    console.error("Napaka pri nalaganju dnevnice:", error);
});