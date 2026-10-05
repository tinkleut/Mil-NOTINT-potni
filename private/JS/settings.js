// FILE FOR MANAGING ADMIN DASHBOARD - COUNT USERS, DISPLAY EMPLOYEE LIST, AND DAILY ALLOWANCE RATES

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}



// COUNT TOTAL USERS AND ADMINS FROM THE SERVER
async function countUsers() {
    try {
        // Fetch user count statistics from the server.
        const response = await fetch("/api/admin/count_users");

        // Check if the request was successful.
        if(!response.ok) {
            throw new Error(`Napaka na serverju: ${response.status}`);
        }

        // Parse response to get user count data.
        const data = await response.json();

        // Display total number of users in the corresponding input field.
        document.getElementById("users-total").value = data.total;
        
        // Display number of admin users in the corresponding input field.
        document.getElementById("users-admins").value = data.admins;

    } catch (error) {
        // Log error if user count retrieval fails.
        console.error("Napaka pri štetju uporabnikov:", error);
    }    
}

// LOAD ALL USERS AND DISPLAY THEM IN A TABLE WITH EDIT BUTTONS
async function getAllUsersInfo() {
    try {
        // Fetch all user information from the server.
        const response = await fetch("/api/admin/all_user_info");

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error(`Napaka na serverju: ${response.status}`);
        }

        // Parse response to get array of users.
        const users = await response.json();

        // Get the table body container element where user rows will be inserted.
        const container = document.getElementById("users-tbody");

        let html = "";

        // Iterate through each user and build table row HTML.
        users.forEach(user => {
            html += `
                <tr>
                    <td>${escapeHTML(user.ime)}</td>
                    <td>${escapeHTML(user.priimek)}</td>
                    <td>${escapeHTML(user.username)}</td>
                    <td>${escapeHTML(user.prebivalisce)}</td>
                    <td>${escapeHTML(user.delovno_mesto)}</td>
                    <td>${escapeHTML(user.role)}</td>
                    <!-- Edit button for individual user record -->
                    <td><button class="login-button" onclick="urediZaposleni('${user.id}')">Uredi</button> </td>
                </tr>
            `;
        });

        // Insert generated HTML into the table body for display.
        container.innerHTML = html;

    } catch (error) {
        // Log error if user data loading fails.
        console.error(error);
    }
}

// LOAD ALL DAILY ALLOWANCE RATES AND DISPLAY THEM IN A TABLE WITH EDIT BUTTONS
async function getAllDnevniceInfo() {
    try {
        // Fetch all daily allowance information from the server.
        const response = await fetch("/api/admin/all_dnevnice_info");

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error(`Napaka na serverju: ${response.status}`);
        }

        // Parse response to get array of daily allowance rates.
        const dnevnice = await response.json();

        // Get the table body container element where daily allowance rows will be inserted.
        const container = document.getElementById("dnevnice-tbody");

        let html = "";

        // Iterate through each daily allowance rate and build table row HTML.
        const currencySymbols = {
            EUR: "€",
            USD: "$",
            GBP: "£",
            "€": "€",
            "$": "$",
            "£": "£"
        };

        dnevnice.forEach(dnevnica => {
            html += `
                <tr>
                    <td>${escapeHTML(dnevnica.drzava)}</td>
                    <td>${escapeHTML(currencySymbols[dnevnica.valuta] || dnevnica.valuta)}</td>
                    <td>${escapeHTML(dnevnica.dnevnica14)}</td>
                    <td>${escapeHTML(dnevnica.dnevnica8)}</td>
                    <td>${escapeHTML(dnevnica.dnevnica6)}</td>
                    <!-- Edit button for individual daily allowance record -->
                    <td><button class="login-button" onclick="urediDnevnico('${dnevnica.id}')">Uredi</button> </td>
                </tr>
            `;
        });

        // Insert generated HTML into the table body for display.
        container.innerHTML = html;

    } catch (error) {
        // Log error if daily allowance data loading fails.
        console.error(error);
    }
}

// NAVIGATE TO EDIT PAGE FOR SPECIFIC EMPLOYEE
async function urediZaposleni(userId) {
    // Redirect user to the employee edit page, passing the user ID as a query parameter.
    window.location.href = `/admin/users?id=${userId}`;
} 

// NAVIGATE TO EDIT PAGE FOR SPECIFIC DAILY ALLOWANCE RATE
async function urediDnevnico(dnevnicaId) {
    // Redirect user to the daily allowance edit page, passing the allowance ID as a query parameter.
    window.location.href = `/admin/dnevnice?id=${dnevnicaId}`;
} 

// INITIALIZE DASHBOARD DATA WHEN PAGE FINISHES LOADING
document.addEventListener("DOMContentLoaded", () => {
    // Count and display total users and admin count.
    countUsers();
    
    // Load and display all employees in the users table.
    getAllUsersInfo();
    
    // Load and display all daily allowance rates in the dnevnice table.
    getAllDnevniceInfo();
});