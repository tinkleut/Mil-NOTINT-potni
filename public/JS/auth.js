// LOGIN AND LOGOUT LOGIC



// LOGIN SECTION

// Get references to the login form and error message display element.
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

// Only proceed if the login form exists on the page.
if (loginForm) {

    // Listen for the form submission event
    loginForm.addEventListener("submit", async (event) => {
        // Prevent the default form behavior (page reload).
        event.preventDefault();

        // Extract and clean up the username and password inputs.
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        try {

            // Send login credentials to the server.
            const response = await fetch("/login", {

                // Use the POST method for secure data transfer to server.
                method: "POST",

                // Tell the server we are sending the JSON data.
                headers: {
                    "Content-type": "application/json"
                },

                // Convert username and password into JSON format.
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            // The server sends as response a JSON object so we need to parse it into JS object.
            const data = await response.json();

            // Check if server confirmed that login was successful.
            if (data.success) {

                // Check if user logged in with admin credidentals.
                if (data.admin) {
                    window.location.href = "/admin";

                // Check if user logged in with non-admin credidentals.
                } else {
                    window.location.href = "/index";
                }
            
            // If login was unsuccessful, display a message.
            } else {
                message.textContent = data.message || "Prijava ni uspela.";
                message.className = "login-message error";
            }

        // Catch any errors that may occur.
        } catch (error) {
            console.error("Login request failed:", error);
            console.error("Error type:", error.constructor.name);
            message.textContent = "Povezava s strežnikom ni uspela.";
            message.className = "login-message error";
        }
    });
}



// LOGOUT SECTION
const logoutButton = document.getElementById("logoutButton");

// Only proceed if the logout button exists on the page.
if (logoutButton) {

    //Listen for the form submission event
    logoutButton.addEventListener("click", async (event) => {
        // Prevent the default form behavior (page reload).
        event.preventDefault();

        // Send logout request to the server.
        await fetch("/logout", {
            method: "POST"
        });

        // Redirect to login page.
        window.location.href = "/login";
    });
}
