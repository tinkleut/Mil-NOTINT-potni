// FILE FOR DISPLAYING ALL TRAVEL ORDERS WITH FILTERING, SORTING, AND MANAGEMENT OPTIONS



// GLOBAL VARIABLE TO STORE ALL TRAVEL ORDERS FETCHED FROM SERVER
let allTravelOrders = [];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

// DISPLAY MESSAGE TO USER WITH SPECIFIED TYPE (ERROR OR SUCCESS)
function showMessage(text, type = "error") {
    // Get the message display element from the DOM.
    const message = document.getElementById("message");
    if (!message) return;
    
    // Set message text and apply color based on message type.
    message.textContent = text;
    message.style.display = "block";
    message.style.color = type === "success" ? "#72d6a2" : "#ff8995";
}

// POPULATE USER FILTER DROPDOWN WITH UNIQUE USERS FROM ALL TRAVEL ORDERS
function populateUserFilter(orders) {
    // Get the user filter select element from the DOM.
    const select = document.getElementById("filterUser");
    if (!select) return;
    
    // Extract unique users from orders and sort them alphabetically by name.
    const users = [...new Map(orders.map(order => [order.user_id, `${escapeHTML(order.ime)} ${escapeHTML(order.priimek)}`])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1], "sl"));
    
    // Build and insert HTML options for each user into the select element.
    select.innerHTML = `<option value="">Vsi uporabniki</option>${users.map(([id, name]) => `<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`).join("")}`;
}

// GET FILTERED AND SORTED TRAVEL ORDERS BASED ON USER-SELECTED FILTER CRITERIA
function getFilteredOrders() {
    // Retrieve filter values from input fields.
    const from = document.getElementById("filterFrom")?.value || "";
    const to = document.getElementById("filterTo")?.value || "";
    const status = document.getElementById("filterStatus")?.value || "";
    const userId = document.getElementById("filterUser")?.value || "";

    // Filter travel orders based on date range, status, and selected user.
    const filtered = allTravelOrders.filter(order => {
        const date = String(order.datum_odhoda || "").slice(0, 10);
        return (!from || date >= from) && (!to || date <= to)
            && (!status || order.status === status)
            && (!userId || String(order.user_id) === userId);
    });
    
    // Get the selected sort option from the dropdown.
    const sort = document.getElementById("sortOrders")?.value || "id-desc";
    
    // Sort filtered orders based on selected sorting criteria.
    return filtered.sort((a, b) => {
        // Sort by order ID (ascending or descending).
        if (sort === "id-asc" || sort === "id-desc") {
            const result = Number(a.id) - Number(b.id);
            return sort === "id-asc" ? result : -result;
        }
        // Sort by departure date (ascending or descending).
        const result = String(a.datum_odhoda).localeCompare(String(b.datum_odhoda));
        return sort === "date-asc" ? result : -result;
    });
}

// RENDER FILTERED TRAVEL ORDERS TO THE PAGE WITH DISPLAY INFORMATION AND ACTION BUTTONS
function renderTravelOrders(orders) {
    // Get the container element where travel orders will be displayed.
    const container = document.querySelector("#travelOrders");
    if (!container) return;
    
    // Display message if no orders match the selected filters.
    if (orders.length === 0) {
        container.innerHTML = "";
        showMessage("Za izbrane pogoje ni potnih nalogov.", "success");
        return;
    }

    // Hide the message element when orders are being displayed.
    document.getElementById("message").style.display = "none";
    let html = "";
    
    // Map English status values to Slovenian display labels.
    const statusLabels = {
        Pending: "Čaka na obravnavo", Approved: "Odobren", Disapproved: "Zavrnjen",
        Active: "Aktiven", "Not paid": "Neplačan", Completed: "Zaključen"
    };

    // Iterate through each order and build HTML for display.
    orders.forEach(order => {
        // Convert date strings to Date objects for proper formatting.
        const departureDate = new Date(order.datum_odhoda);
        const arrivalDate = new Date(order.datum_prihoda);
        
        // Set CSS class based on order status for visual styling.
        const statusClass = `status-${order.status.toLowerCase().replace(/ /g, '-')}`;
        
        // Build HTML string for this travel order with all necessary information.
        html += `
            <div class="travel-order ${statusClass}">
                <div class="order-row"><span><b>Oseba:</b> ${order.ime} ${order.priimek}</span>&nbsp;&nbsp;<span><b>Status:</b> ${escapeHTML(statusLabels[order.status] || order.status)}</span>&nbsp;&nbsp;<span><b>Št. naloga:</b> ${escapeHTML(order.display_id || order.id)}</span></div>
                <div class="order-row"><span><b>Lokacija:</b> ${escapeHTML(order.lokacija_prihoda)}</span></div>
                <div class="order-row"><span><b>Odhod:</b> ${departureDate.toLocaleString("sl-SI")}</span>&nbsp;&nbsp;<span><b>Prihod:</b> ${arrivalDate.toLocaleString("sl-SI")}</span></div>
                <div class="order-buttons"><button class="login-button" onclick="urediOrder('${order.id}')">Uredi</button><button class="login-button" onclick="izbrisiOrder('${order.id}')">Izbriši</button></div>
            </div>`;
    });
    
    // Insert generated HTML into the container for display.
    container.innerHTML = html;
}

// LOAD ALL TRAVEL ORDERS FROM SERVER AND PREPARE THEM FOR DISPLAY
async function loadTravelOrders() {
    try {
        // Fetch all travel orders from the server.
        const response = await fetch("/api/admin/all_travel_orders");

        // Check if the request was successful.
        if (!response.ok) {
            // Parse error details from the response for debugging.
            const errorData = await response.json();
            console.error("Error response:", errorData);
            throw new Error("Napaka pri pridobivanju informacij o potnih nalogih...");
        }

        // Parse response to get array of travel orders.
        const orders = (await response.json())
            .filter(order => Number(order.mesecni) !== 1);
        
        // Store orders globally for filtering and sorting operations.
        allTravelOrders = orders;
        
        // Populate the user filter dropdown with unique users from orders.
        populateUserFilter(orders);
        
        // Render all orders to the page with applied filters and sorting.
        renderTravelOrders(getFilteredOrders());
        return;

    } catch (error) {
        // Log error for debugging.
        console.error(error);
        
        // Display user-friendly error message.
        showMessage(error.message || "Potnih nalogov ni mogoče naložiti.");
    }
}

// DELETE A SPECIFIC TRAVEL ORDER AFTER USER CONFIRMATION
async function izbrisiOrder(orderId) {
    // Request user confirmation before deleting the order.
    if (confirm("Ali ste prepričani, da želite izbrisati ta potni nalog?")) {
        try {
            // Send DELETE request to server to remove the travel order.
            const response = await fetch(`/api/admin/delete_travel_order/${orderId}`, {
                method: "DELETE"
            });

            // Parse server response to check for success or error.
            const data = await response.json();

            // Reload travel orders list if deletion was successful.
            if (response.ok) {
                loadTravelOrders();

            } else {
                // Display error message if deletion failed.
                showMessage("Napaka: " + (data.error || "Neznana napaka"));
            }
        } catch (error) {
            // Log and display error if request to server fails.
            console.error("Fetch error:", error);
            showMessage("Napaka pri komuniciranju s strežnikom: " + error.message);
        }
    }
}

// NAVIGATE TO EDIT PAGE FOR SPECIFIC TRAVEL ORDER
async function urediOrder(orderId) {
    // Redirect user to the travel order edit page, passing the order ID as a query parameter.
    window.location.href = `/admin/urediPotniNalog?id=${orderId}`;
}

// INITIALIZE PAGE AND LOAD TRAVEL ORDERS WHEN PAGE FINISHES LOADING
document.addEventListener("DOMContentLoaded", loadTravelOrders);

// SET UP EVENT LISTENERS FOR FILTER, SORT, AND CLEAR BUTTONS
document.addEventListener("DOMContentLoaded", () => {
    // Apply filters and re-render orders when apply filters button is clicked.
    document.getElementById("applyFilters")?.addEventListener("click", () => renderTravelOrders(getFilteredOrders()));
    
    // Re-render orders when sort option is changed.
    document.getElementById("sortOrders")?.addEventListener("change", () => renderTravelOrders(getFilteredOrders()));
    
    // Clear all filters and display all travel orders when clear filters button is clicked.
    document.getElementById("clearFilters")?.addEventListener("click", () => {
        // Reset all filter input fields to empty values.
        ["filterFrom", "filterTo", "filterStatus", "filterUser"].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = "";
        });
        // Render all travel orders without any filters applied.
        renderTravelOrders(allTravelOrders);
    });
});