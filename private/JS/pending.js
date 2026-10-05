// FILE FOR DISPLAYING PENDING TRAVEL ORDERS WITH ESSENTIAL INFO



// LOAD ALL PENDING TRAVEL ORDERS
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
        const orders = await response.json();

        // Get the container element where travel orders will be displayed.
        const container = document.querySelector("#travelOrders");

        let html = "";

        // Iterate through each travel order and build HTML for pending orders only.
        orders.forEach(order => {
            // Convert date strings to Date objects for proper formatting.
            const departureDate = new Date(order.datum_odhoda);
            const arrivalDate = new Date(order.datum_prihoda);

            // Only display travel orders with "Pending" status.
            if (order.status === "Pending") {
                html += `
                <div class="travel-order" data-order-id="${order.id}" data-status="${order.status}" data-date="${order.datum_odhoda.slice(0, 10)}" data-user="${order.ime} ${order.priimek}">
                    <!-- Display project type as heading -->
                    <h2>${order.vrsta_projekta}</h2>

                    <!-- First row: Person name, status, and order number -->
                    <div class="order-row">
                        <span><b>Oseba:</b> ${order.ime} ${order.priimek}</span>

                        &nbsp;&nbsp;&nbsp;&nbsp;

                        <span><b>Status:</b> ${order.status}</span>

                        &nbsp;&nbsp;&nbsp;&nbsp;

                        <span><b>Št. naloga:</b> ${order.display_id || order.id}</span>

                    </div>

                    <!-- Second row: Arrival location -->
                    <div class="order-row">
                        <span><b>Lokacija:</b> ${order.lokacija_prihoda}</span>
                    </div>

                    <!-- Third row: Departure and arrival times formatted for display -->
                    <div class="order-row">
                        <span>
                            <b>Odhod:</b> ${departureDate.toLocaleString("sl-SI")}
                        </span>

                        &nbsp;&nbsp;&nbsp;&nbsp;

                        <span>
                            <b>Prihod:</b> ${arrivalDate.toLocaleString("sl-SI")}
                        </span>

                    </div>

                    <br>

                    <!-- Action buttons: Approve and Disapprove -->
                    <button class="login-button" onclick="approve('${order.id}')">Odobri</button>
                    <button class="login-button" onclick="disapprove('${order.id}')">Zavrni</button>

                </div>

                <br>
                <br>
            `;
            }
        });

        // Insert generated HTML into the container for display.
        container.innerHTML = html;

    } catch (error) {
        // Log error if data loading fails.
        console.error(error);
    }
}

// APPROVE A PENDING TRAVEL ORDER
async function approve(orderId) {
    // Request user confirmation before approving the travel order.
    if (!confirm("Ali želite odobriti ta potni nalog?")) return;

    try {
        // Send POST request to the server to approve the travel order.
        const response = await fetch(`/api/admin/all_travel_orders/${orderId}/approve`, {
            method: "POST"
        });

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error("Failed to approve order");
        }

        // Display success message to the user.
        showAdminMessage("Potni nalog je bil odobren.", "success");

        // Reload the travel orders list after successful approval to reflect changes.
        await loadTravelOrders();

    } catch (error) {
        // Log error for debugging.
        console.error(error);
        
        // Display user-friendly error message.
        showAdminMessage(error.message || "Potnega naloga ni mogoče odobriti.");
    }
}

// DISAPPROVE A PENDING TRAVEL ORDER
async function disapprove(orderId) {
    // Request user confirmation before disapproving the travel order.
    if (!confirm("Ali želite zavrniti ta potni nalog?")) return;
    
    try {
        // Send POST request to the server to disapprove the travel order.
        const response = await fetch(`/api/admin/all_travel_orders/${orderId}/disapprove`, {
            method: "POST"
        });

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error("Failed to disapprove order");
        }

        // Reload the travel orders list after successful disapproval to reflect changes.
        await loadTravelOrders();

        // Display success message to the user.
        showAdminMessage("Potni nalog je bil zavrnjen.", "success");

    } catch (error) {
        // Log error for debugging.
        console.error(error);
        
        // Display user-friendly error message.
        showAdminMessage(error.message || "Potnega naloga ni mogoče zavrniti.");
    }
}

// NAVIGATE TO EDIT PAGE FOR SPECIFIC TRAVEL ORDER
async function urediOrder(orderId) {
    // Redirect user to the travel order edit page, passing the order ID as a query parameter.
    window.location.href = `/admin/urediPotniNalog?id=${orderId}`;
}

// Load and display all pending travel orders when page finishes loading.
document.addEventListener("DOMContentLoaded", loadTravelOrders);