// FILE FOR ADDING AND EDITING USER ACCOUNTS



// Get form element and submit button for later use.
const userForm = document.getElementById("userForm");
const submitBtn = document.getElementById("submitBtn");

// CHECK IF PAGE IS IN EDIT MODE OR CREATE MODE
document.addEventListener("DOMContentLoaded", async () => {
    // Extract user ID from URL query parameters to determine if editing existing user.
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("id");

    // If user ID exists, load the user data for editing.
    if (userId) {
        try {
            // Fetch the specific user data from the server using the user ID.
            const response = await fetch(`/api/admin/users/${userId}`);
            
            // Check if the request was successful.
            if (!response.ok) {
                throw new Error("Uporabnik ni najden");
            }

            // Parse response to get user data.
            const user = await response.json();

            // Autofill profile fields; leave the password blank unless changing it.
            document.getElementById("ime").value = user.ime || "";
            document.getElementById("priimek").value = user.priimek || "";
            document.getElementById("prebivalisce").value = user.prebivalisce || "";
            document.getElementById("registerska").value = user.registerska || "";
            document.getElementById("vin").value = user.vin || "";
            document.getElementById("username").value = user.username || "";
            document.getElementById("geslo").value = "";
            document.getElementById("delovno_mesto").value = user.delovno_mesto || "";
            document.getElementById("role").value = user.role || "";
            document.getElementById("status").value = user.status || "";
            
            // Store user ID in hidden form field for later use during update.
            document.getElementById("userId").value = userId;
            
            // Change submit button text to indicate we are updating a user.
            submitBtn.textContent = "💾 Posodobi uporabnika";

        } catch (error) {
            // Log error if user data loading fails.
            console.error("Napaka pri nalaganju podatkov:", error);
            document.getElementById("message").textContent = "Napaka pri nalaganju podatkov";
            document.getElementById("message").style.color = "red";
        }
    } else {
        // If no user ID in URL, set button text to indicate we are creating a new user.
        submitBtn.textContent = "💾 Dodaj uporabnika";
    }
});

// HANDLE FORM SUBMISSION FOR ADDING OR UPDATING USER
userForm.addEventListener("submit", async (event) => {
    // Prevent page reload on form submission.
    event.preventDefault();

    // Extract all input values from the form fields.
    const ime = document.getElementById("ime").value;
    const priimek = document.getElementById("priimek").value;
    const prebivalisce = document.getElementById("prebivalisce").value;
    const registerska = document.getElementById("registerska").value;
    const vin = document.getElementById("vin").value;
    const username = document.getElementById("username").value;
    const geslo = document.getElementById("geslo").value;
    const delovno_mesto = document.getElementById("delovno_mesto").value;
    const role = document.getElementById("role").value;
    const status = document.getElementById("status").value;
    const userId = document.getElementById("userId").value;

    // Validate that all required fields are filled in.
    if (!ime || !priimek || !prebivalisce || !registerska || !vin || !username || !delovno_mesto || !role || !status || (!userId && !geslo)) {
        document.getElementById("message").textContent = "Prosim izpolnite vsa polja";
        document.getElementById("message").style.color = "red";
        return;
    }

    try {
        // Determine the correct API endpoint based on whether we are updating or creating a user.
        // If userId exists, use update endpoint; otherwise use create endpoint.
        const endpoint = userId ? "/api/admin/posodobi_user" : "/api/admin/dodaj_user";
        
        // Build request body with all user data.
        const body = {
            ime,
            priimek,
            prebivalisce,
            registerska,
            vin,
            username,
            geslo,
            delovno_mesto,
            status,
            role
        };

        // Only add user ID to body when updating existing user.
        if (userId) {
            body.id = userId;
        }

        // Send POST request to the server to add or update user data.
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // Convert all form field values into JSON format for server.
            body: JSON.stringify(body)
        });

        // Parse response data as JSON.
        const data = await response.json();

        // Check if the server returned a success status.
        if (data.success) {
            // Display appropriate success message based on whether updating or creating user.
            const message = userId ? "Uporabnik je bil uspešno posodobljen!" : "Novi uporabnik je bil uspešno ustvarjen!";
            document.getElementById("message").textContent = message;
            document.getElementById("message").style.color = "green";
            
            // Clear all form fields after successful submission.
            userForm.reset();
        } else {
            // Display error message from server if operation failed.
            document.getElementById("message").textContent = data.message || "Napaka pri shranjevanju";
            document.getElementById("message").style.color = "red";
            console.log(data.message);
        }
    } catch (error) {
        // Display error message if request fails.
        document.getElementById("message").textContent = "Napaka pri pošiljanju podatkov na strežnik!";
        document.getElementById("message").style.color = "red";
        console.error("Request failed:", error);
    }
});