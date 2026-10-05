// FILE FOR DISPLAYING USER TRAVEL ORDERS WITH ONLY NECESSARY INFORMATION



// LOAD ALL UNPAID TRAVEL ORDERS FROM THE SERVER AND DISPLAY THEM
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

        // Iterate through each travel order and build HTML for unpaid orders only.
        orders.forEach(order => {
            // Convert date strings to Date objects for proper formatting.
            const departureDate = new Date(order.datum_odhoda);
            const arrivalDate = new Date(order.datum_prihoda);

            // Only display travel orders with "Not paid" status.
            if (order.status === "Not paid") {
                html += `
                    <div class="travel-order status-${order.status.toLowerCase().replace(/\s+/g, "-")}">
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

                        <!-- Action button: Edit payment/billing for this travel order -->
                        <button class="login-button" onclick="urediObracun('${order.id}')">Uredi</button>

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

// NAVIGATE TO PAYMENT/BILLING EDIT PAGE FOR SPECIFIC TRAVEL ORDER
async function urediObracun(orderId) {
    // Redirect user to the payment/billing edit page, passing the order ID as a query parameter.
    window.location.href = `/admin/prikazObracuna?id=${orderId}`;
}

// INITIALIZE TRAVEL ORDERS LOADING WHEN PAGE FINISHES LOADING
document.addEventListener("DOMContentLoaded", function() {
    // Get the container element where travel orders will be displayed.
    const container = document.querySelector("#travelOrders");
    
    // Load and display all unpaid travel orders if the container exists on the page.
    if (container) {
        loadTravelOrders();
    }
});