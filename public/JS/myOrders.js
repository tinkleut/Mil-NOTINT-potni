// FILE FOR DISPLAYING USERS TRAVEL ORDERS BUT ONLY WITH NECESARY INFO



// Function for displaying all users travel orders
async function loadTravelOrders() {
    try {

        // Fetch user's travel orders from the server. 
        const response = await fetch("/api/my_travel_orders");

        // Check if the response was successful, throw error if not.
        if (!response.ok) {
            throw new Error("Napaka pri pridobivanju informacij o potnih nalogih...");
        }

        // Parse the response as JSON to get array of travel orders.
        const orders = await response.json();

        // We use this to show status of travel order to user.
        const statusLabels = {
            Pending: "Čaka na obravnavo",
            Approved: "Odobren",
            Disapproved: "Zavrnjen",
            Active: "Aktiven",
            "Not paid": "Neplačan",
            Completed: "Zaključen"
        };

        // Sort orders by ID in descending order so newest orders appear first.
        orders.sort((a, b) => b.id - a.id);

        // Get the container element where orders will be displayed.
        const container = document.querySelector("#travelOrders");

        // // Build HTML string to display all orders.
        let html = "";

        // Loop through each order and create HTML for display.
        orders.forEach(order => {

            // Convert date strings to Date objects for proper formatting.
            const departureDate = new Date(order.datum_odhoda);
            const arrivalDate = new Date(order.datum_prihoda);

            // Build HTML card for each travel order with key information.
            html += `
                <div class="travel-order status-${order.status.toLowerCase()}">
                    <h2>${order.vrsta_projekta} <small>${order.display_id || order.id}</small></h2>

                    <p><strong>Status:</strong> ${statusLabels[order.status] || order.status}</p>

                    <h3>
                        <span class="label">Lokacija:</span>
                        <span>${order.lokacija_prihoda}</span>
                    </h3>

                    <h3>
                        <span class="label">Predviden odhod:</span>
                        <span>${departureDate.toLocaleString("sl-SI")}</span>
                    </h3>

                    <h3>
                        <span class="label">Predviden prihod:</span>
                        <span>${arrivalDate.toLocaleString("sl-SI")}</span>
                    </h3>

                    <button class="login-button" onclick="urediObracun('${order.id}')">Uredi obračun</button>
                    <button class="login-button" onclick="urediOrder('${order.id}')">Uredi</button>
                    <button class="login-button" onclick="izbrisiOrder('${order.id}')">Izbriši</button>

                </div>

                <br>
                <br>

            `;
        });

        // Insert generated HTML into the container on the page.
        container.innerHTML = html;

    } catch (error) {
        // Log error if fetching or displaying orders fails.
        console.error(error);
    }
}


// Function for deleting a travel order
async function izbrisiOrder(orderId) {

    // Ask user to confirm deletion before proceeding.
    if (confirm("Ali ste prepričani, da želite izbrisati ta potni nalog?")) {
        try {
            
            // Send DELETE request to remove the order from the database.
            const response = await fetch(`/api/delete_travel_order/${orderId}`, {
                method: "DELETE"
            });

            // Parse server response to check if deletion was successful.
            const data = await response.json();

            // If deletion was successful, refresh the orders list and show confirmation.
            if (response.ok) {
                loadTravelOrders();
                alert("Potni nalog je bil uspešno izbrisan!");
            } 
            else
                {
                // If deletion failed, display error message from server.
                alert("Napaka: " + (data.error || "Neznana napaka"));
            }

        } catch (error) {
            // Handle network errors or connection issues.
            console.error("Fetch error:", error);
            alert("Napaka pri komuniciranju s strežnikom: " + error.message);
        }
    }
}


// Function for editing a specific travel order..
async function urediOrder(orderId) {
    window.location.href = `/urediNalog?id=${orderId}`;
} 


// Function for editing obracun that is connected to this travel order
async function urediObracun(orderId) {
    window.location.href = `/obracunUser?id=${orderId}`;
} 

//Load and display travel orders when the page finishes loading.
document.addEventListener("DOMContentLoaded", loadTravelOrders);
