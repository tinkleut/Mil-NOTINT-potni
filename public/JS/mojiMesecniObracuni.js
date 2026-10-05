// FILE FOR DISPLAYING USER'S MONTHLY TRAVEL ORDERS AND BILLING CALCULATIONS



// ARRAY OF MONTH NAMES IN SLOVENIAN LANGUAGE
// Used for displaying month names instead of numbers in calendar format.
const monthNames = [
    "Januar", "Februar", "Marec", "April", "Maj", "Junij",
    "Julij", "Avgust", "September", "Oktober", "November", "December"
];

// FUNCTION FOR FORMATTING CURRENCY VALUES
function formatMoney(value) {
    // Format number with 2 decimal places and EUR currency symbol.
    return `${Number(value || 0).toFixed(2)} EUR`;
}

// LOAD ALL MONTHLY BILLING CALCULATIONS FOR CURRENT USER
async function loadMonthlyCalculations() {
    // Get the container element where monthly calculations will be displayed.
    const container = document.getElementById("monthlyCalculations");
    
    // Get the message display element for showing errors.
    const message = document.getElementById("message");

    try {
        // Fetch all monthly billing calculations for the logged-in user from the server.
        const response = await fetch("/api/mesecni_obracuni");
        
        // Parse response data as JSON.
        const calculations = await response.json();
        
        // Check if the request was successful.
        if (!response.ok) throw new Error(calculations.error || "Napaka pri nalaganju podatkov.");

        // Display message if no monthly calculations exist.
        if (calculations.length === 0) {
            container.innerHTML = "<p>Še nimate shranjenega mesečnega obračuna.</p>";
            return;
        }

        // Build HTML for all monthly billing calculations with summary information and action links.
        container.innerHTML = calculations.map(calculation => `
            <!-- Article element for each monthly calculation record -->
            <article class="travel-order">
                <!-- Display month and year of the billing calculation -->
                <h3>${monthNames[calculation.mesec - 1]} ${calculation.leto}</h3>
                
                <!-- Display total expenses for this billing month formatted as currency -->
                <p><strong>Skupni stroški:</strong> ${formatMoney(calculation.skupni_stroski)}</p>
                
                <!-- Display last modification date and time formatted for display -->
                <p><strong>Sprememba:</strong> ${new Date(calculation.datum_spremembe).toLocaleString("sl-SI")}</p>
                
                <!-- Link button to edit this monthly billing calculation -->
                <a class="btn btn-primary" href="/mesecniObracun?id=${calculation.id}">Uredi</a>
            </article>
        `).join("");
    } catch (error) {
        // Display error message to user if loading fails.
        message.textContent = error.message;
    }
}

// LOAD ALL MONTHLY TRAVEL ORDERS FOR CURRENT USER
async function loadMonthlyOrders() {
    // Get the container element where monthly travel orders will be displayed.
    const container = document.getElementById("monthlyOrders");
    
    // Exit if container doesn't exist on the page.
    if (!container) return;

    try {
        // Fetch all travel orders for the logged-in user from the server.
        const response = await fetch("/api/my_travel_orders");
        
        // Parse response data as JSON.
        const orders = await response.json();
        
        // Check if the request was successful.
        if (!response.ok) throw new Error(orders.error || "Napaka pri nalaganju potnih nalogov.");

        // Filter travel orders to get only monthly-recurring orders.
        const monthlyOrders = orders.filter(order => Number(order.mesecni) === 1);
        
        // Display message if no monthly travel orders exist.
        if (monthlyOrders.length === 0) {
            container.innerHTML = "<p>Še nimate shranjenega mesečnega potnega naloga.</p>";
            return;
        }

        // Build HTML for all monthly travel orders with route and date information.
        container.innerHTML = monthlyOrders.map(order => `
            <!-- Article element for each monthly travel order -->
            <article class="travel-order">
                <!-- Display order ID or display ID as heading -->
                <h3>${order.display_id || order.id}</h3>
                
                <!-- Display departure and arrival locations for the monthly route -->
                <p><strong>Relacija:</strong> ${order.lokacija_odhoda} - ${order.lokacija_prihoda}</p>
                
                <!-- Display month and year of the monthly travel order in natural language format -->
                <p><strong>Mesec:</strong> ${new Date(order.datum_odhoda).toLocaleDateString("sl-SI", { month: "long", year: "numeric" })}</p>
                
                <!-- Link button to edit this monthly travel order -->
                <a class="btn btn-primary" href="/urediMesecniPotniNalog?id=${order.id}">Uredi mesečni potni nalog</a>
            </article>
        `).join("");
    } catch (error) {
        // Display error message to user if loading fails.
        container.textContent = error.message;
    }
}

// Load and display monthly travel orders and billing calculations when page finishes loading.
document.addEventListener("DOMContentLoaded", () => {
    // Load monthly travel orders for the user.
    loadMonthlyOrders();
    
    // Load monthly billing calculations for the user.
    loadMonthlyCalculations();
});