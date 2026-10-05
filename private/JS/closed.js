// FILE FOR DISPLAYING COMPLETED TRAVEL ORDERS WITH ESSENTIAL INFO



// LOAD ALL COMPLETED TRAVEL ORDERS
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

        // Iterate through each travel order and build HTML for completed orders only.
        orders.forEach(order => {
            // Convert date strings to Date objects for proper formatting.
            const departureDate = new Date(order.datum_odhoda);
            const arrivalDate = new Date(order.datum_prihoda);

            // Only display travel orders with "Completed" status.
            if (order.status === "Completed") {
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

                    <!-- Action buttons: Edit completed order and Delete -->
                    <button class="login-button" onclick="urediFinishedOrder('${order.id}')">Uredi zaključen potni nalog</button>
                    <button class="login-button" onclick="izbrisiZakljucenOrder('${order.id}')">Izbriši</button>

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

// NAVIGATE TO EDIT PAGE FOR SPECIFIC COMPLETED TRAVEL ORDER
async function urediFinishedOrder(orderId) {
    const response = await fetch(`/api/admin/edit_travel_order/${orderId}`);
    const order = await response.json();
    const editPage = Number(order.mesecni) === 1
        ? "/admin/urediMesecniPotniNalog"
        : "/admin/urediKoncaniPotniNalog";
    window.location.href = `${editPage}?id=${orderId}`;
}

// DELETE A COMPLETED TRAVEL ORDER
async function izbrisiZakljucenOrder(orderId) {
    // Request user confirmation before permanently deleting the completed travel order.
    if (!confirm("Ali ste prepričani, da želite izbrisati ta zaključen potni nalog?")) return;

    try {
        // Send DELETE request to the server to remove the travel order.
        const response = await fetch(`/api/admin/delete_travel_order/${orderId}`, {
            method: "DELETE"
        });

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error("Napaka pri brisanju zaključenega naloga");
        }

        // Reload the travel orders list after successful deletion to reflect changes.
        await loadTravelOrders();

    } catch (error) {
        // Log error if deletion fails.
        console.error(error);
    }
}

// Load and display all completed travel orders when page finishes loading.
document.addEventListener("DOMContentLoaded", loadTravelOrders);