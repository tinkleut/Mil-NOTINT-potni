// FILE FOR DISPLAYING UNPAID TRAVEL ORDERS WITH ESSENTIAL INFO



// LOAD ALL UNPAID TRAVEL ORDERS
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

                    <!-- Action buttons: Edit payment, Edit travel order, and Complete order -->
                    <button class="login-button" onclick="urediObracun('${order.id}', ${Number(order.mesecni) === 1})">Uredi obračun</button>
                    <button class="login-button" onclick="urediOrder('${order.id}')">Uredi potni nalog</button>
                    <button class="login-button" onclick="endOrder('${order.id}')">Končaj</button>

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

// NAVIGATE TO EDIT PAGE FOR SPECIFIC TRAVEL ORDER
async function urediOrder(orderId) {
    // Redirect user to the travel order edit page, passing the order ID as a query parameter.
    window.location.href = `/admin/urediPotniNalog?id=${orderId}`;
}

// NAVIGATE TO PAYMENT/BILLING EDIT PAGE FOR SPECIFIC TRAVEL ORDER
async function urediObracun(orderId, isMonthly) {
    const editPage = isMonthly ? "/admin/urediMesecniObracun" : "/admin/prikazObracuna";
    window.location.href = `${editPage}?id=${orderId}`;
}

// COMPLETE A TRAVEL ORDER AND GENERATE WORD DOCUMENT
async function endOrder(orderId) {
    // Request user confirmation before completing the order and generating the document.
    if (!confirm("Ali ste prepričani, da želite končati ta potni nalog in ustvariti Word dokument?")) {
        return;
    }

    try {
        // Send POST request to the server to end the travel order and generate the document.
        const response = await fetch(`/api/admin/all_travel_orders/${orderId}/end_order`, {
            method: "POST"
        });

        // Check if the request was successful.
        if (!response.ok) {
            // Parse error data from response, fallback to empty object if parsing fails.
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Napaka pri končanju potnega naloga");
        }

        // Convert response to a Blob (binary large object - raw file data)
        const documentBlob = await response.blob();

        // Create a temporary URL that points to the blob in memory
        const downloadUrl = URL.createObjectURL(documentBlob);

        // Create an invisible anchor <a> tag to trigger the download
        const downloadLink = document.createElement("a");

        // Get the Content-Disposition header from the server response
        const contentDisposition = response.headers.get("Content-Disposition") || "";

        // Extract the filename from the header using regex pattern matching
        // The regex looks for: filename="ACTUAL_FILENAME_HERE"
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);

        // Set the link's href to the blob URL and download attribute to the filename
        downloadLink.href = downloadUrl;
        downloadLink.download = filenameMatch?.[1] || `potni-nalog-${orderId}.zip`;

        // Add the link to the page, click it to trigger download, then remove it
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();

        // Revoke the temporary URL to free up memory and prevent memory leaks
        URL.revokeObjectURL(downloadUrl);

        // Reload the travel orders list after successful completion to reflect changes.
        await loadTravelOrders();

    } catch (error) {
        // Log error for debugging.
        console.error(error);
        
        // Display user-friendly error message.
        showAdminMessage(error.message || "Potnega naloga ni mogoče zaključiti.");
    }
}

// Load and display all unpaid travel orders when page finishes loading.
document.addEventListener("DOMContentLoaded", loadTravelOrders);