// FILE FOR DISPLAYING USER'S MONTHLY TRAVEL ORDERS



// LOAD ALL MONTHLY TRAVEL ORDERS FOR CURRENT USER
async function loadMonthlyTravelOrders() {
    try {
        // Fetch all travel orders for the logged-in user from the server.
        const response = await fetch("/api/my_travel_orders");
        
        // Check if the request was successful.
        if (!response.ok) throw new Error("Napaka pri pridobivanju informacij o mesečnih potnih nalogih...");

        // Parse response to get array of travel orders and filter for monthly-recurring orders only.
        const orders = (await response.json())
            .filter(order => Number(order.mesecni) === 1)
            .sort((first, second) => second.id - first.id);
        
        // Define status labels for translation from database values to user-friendly text.
        const statusLabels = {
            Pending: "Čaka na obravnavo",
            Approved: "Odobren",
            Disapproved: "Zavrnjen",
            Active: "Aktiven",
            "Not paid": "Neplačan",
            Completed: "Zaključen"
        };
        
        // Get the container element where travel orders will be displayed.
        const container = document.querySelector("#travelOrders");

        // Display message if no monthly travel orders exist.
        if (orders.length === 0) {
            container.innerHTML = "<p>Še nimate shranjenega mesečnega potnega naloga.</p>";
            return;
        }

        // Build HTML for all monthly travel orders with order details and action buttons.
        container.innerHTML = orders.map(order => {
            // Convert date strings to Date objects for proper formatting.
            const departureDate = new Date(order.datum_odhoda);
            const arrivalDate = new Date(order.datum_prihoda);
            
            return `
                <div class="travel-order status-${order.status.toLowerCase().replace(/ /g, '-')}">
                    <!-- Display project type as heading with order number -->
                    <h2>${order.vrsta_projekta} <small>${order.display_id || order.id}</small></h2>
                    
                    <!-- Display current order status translated to user-friendly label -->
                    <p><strong>Status:</strong> ${statusLabels[order.status] || order.status}</p>
                    
                    <!-- Display scheduled departure date and time formatted for display -->
                    <h3><span class="label">Predviden odhod:</span> <span>${departureDate.toLocaleString("sl-SI")}</span></h3>
                    
                    <!-- Display scheduled arrival date and time formatted for display -->
                    <h3><span class="label">Predviden prihod:</span> <span>${arrivalDate.toLocaleString("sl-SI")}</span></h3>
                    
                    <!-- Action buttons: Edit billing, Edit order details, and Delete -->
                    <button class="login-button" onclick="urediObracun('${order.id}')">Uredi obračun</button>
                    <button class="login-button" onclick="urediOrder('${order.id}')">Uredi</button>
                    <button class="login-button" onclick="izbrisiOrder('${order.id}')">Izbriši</button>
                </div>
                <br>
                <br>
            `;
        }).join('');
    } catch (error) {
        // Log error for debugging purposes.
        console.error(error);
        
        // Display error message to user.
        document.querySelector("#message").textContent = error.message;
    }
}

// DELETE A MONTHLY TRAVEL ORDER
async function izbrisiOrder(orderId) {
    // Request user confirmation before permanently deleting the travel order.
    if (!confirm("Ali ste prepričani, da želite izbrisati ta potni nalog?")) return;

    // Send DELETE request to the server to remove the travel order.
    const response = await fetch(`/api/delete_travel_order/${orderId}`, { method: "DELETE" });
    
    // Parse response data as JSON.
    const data = await response.json();
    
    // Check if the delete request was successful.
    if (!response.ok) {
        // Display error message to user if deletion failed.
        alert("Napaka: " + (data.error || "Neznana napaka"));
        return;
    }
    
    // Reload the monthly travel orders list after successful deletion to reflect changes.
    loadMonthlyTravelOrders();
}

// NAVIGATE TO EDIT PAGE FOR SPECIFIC MONTHLY TRAVEL ORDER
function urediOrder(orderId) {
    // Redirect user to the monthly travel order edit page, passing the order ID as a query parameter.
    window.location.href = `/urediMesecniPotniNalog?id=${orderId}`;
}

// NAVIGATE TO BILLING PAGE FOR SPECIFIC MONTHLY TRAVEL ORDER
function urediObracun(orderId) {
    // Redirect user to the monthly travel order billing calculation page, passing the order ID as a query parameter.
    window.location.href = `/mesecniObracunUser?id=${orderId}`;
}

// Load and display all monthly travel orders when page finishes loading.
document.addEventListener("DOMContentLoaded", loadMonthlyTravelOrders);