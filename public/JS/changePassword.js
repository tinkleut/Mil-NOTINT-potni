// FILE FOR CHANGING THE USERS PASSWORD



// Store html element into a JS variable.
const passwordChange = document.getElementById("passwordChange");
const passwordMessage = document.getElementById("message");

function showPasswordMessage(text, type = "error") {
    if (!passwordMessage) return;
    passwordMessage.textContent = text;
    passwordMessage.className = `login-message ${type}`;
}


// Only proceed if password change form exists on the page.
if (passwordChange) {

    passwordChange.addEventListener("submit", async (event) => {
        // Prevent page reload on form submission.
        event.preventDefault();

        // Extract username and both password inputs.
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const Apassword = document.getElementById("Apassword").value;

        // Ensure all fields are filled before proceeding.
        if (!username || !password || !Apassword) {
            showPasswordMessage("Prosim izpolnite vsa polja.");
            return;
        }

        // Verify that both password inputs match.
        if (password !== Apassword) {
            showPasswordMessage("Gesli se ne ujemata.");
            return;
        }

        // Ensure password meets minimum length requirement of 14 characters.
        if (password.length < 14) {
            showPasswordMessage("Geslo mora imeti najmanj 15 znakov.");
            return;
        }

        try {

            // Send password change request with username and new password.
            const response = await fetch("/changePassword", {

                // Use the POST method for secure data transfer to server.
                method: "POST",

                // Tell the server we are sending the JSON data.
                headers: {
                        "Content-type": "application/json"
                    },

                // Convert username and both passwords into JSON format.
                body: JSON.stringify({
                    username: username,
                    password: password,
                    Apassword: Apassword
                })
            });

            // Parse server response.
            const data = await response.json().catch(() => ({
                success: false,
                message: "Strežnik je vrnil neveljaven odgovor."
            }));

            // Display success message to user if response is successful,
            if (data.success) {
                showPasswordMessage(data.message || "Geslo je bilo uspešno spremenjeno.", "success");
                
                //  Clear the form fields after successful password change
                passwordChange.reset();

                // Redirect to index page after 0.5 seconds
                setTimeout(() => {
                    window.location.href = "/index";
                }, 1500);
            } 

            // Display error message returned from server.
            else {
                showPasswordMessage(data.message || "Napaka pri spremembi gesla.");
            }

        // Catch any errors that may occur.
        } catch (error) {
            showPasswordMessage("Napaka pri pošiljanju zahteve.");
            console.error("🚨 Request failed:", error);
        }
    });

}
    
