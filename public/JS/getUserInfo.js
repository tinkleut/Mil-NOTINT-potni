// FILE FOR GETTING USER INFO FOR AUTOFILL



// Store the current user's ID for use in other parts of the application.
let userId = null;

// Function for getting users data.
async function getUserInfo() {

    try {

        // Here we fetch user data from the API in the server side. 
        const response = await fetch("/api/user_info");

        // The server sends as response a JSON object so we need to parse it into JS object.
        const data = await response.json();

        // store userId globaly
        userId = data.id;
        
        // Autofill greeting element if it exists (index.html only).
        const imePozdrav = document.getElementById("imePozdrav");
        if (imePozdrav) imePozdrav.textContent = data.ime;

        // Autofill form input fields if they exist on the page.
        const username = document.getElementById("username");
        if (username) username.value = data.username;
        
        // Input, but only if they are avaliabe.
        const ime = document.getElementById("ime");
        if (ime) ime.value = data.ime;
        
        const priimek = document.getElementById("priimek");
        if (priimek) priimek.value = data.priimek;
        
        const prebivalisce = document.getElementById("prebivalisce");
        if (prebivalisce) prebivalisce.value = data.prebivalisce;
        
        const delovnoMesto = document.getElementById("delovno_mesto");
        if (delovnoMesto) delovnoMesto.value = data.delovno_mesto;
        
        const registerska = document.getElementById("registerska");
        if (registerska) registerska.value = data.registerska;
        
        const vin = document.getElementById("vin");
        if (vin) vin.value = data.vin;

    // Catch any errors that may occour.
    } catch (error) {
        console.error("Napaka pri nalaganju podatkov:", error);
    }
}

// Wait for the DOM to load before running autofill to ensure all elements exist.
document.addEventListener("DOMContentLoaded", getUserInfo);