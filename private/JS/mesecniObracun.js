// FILE FOR SHOWING MONTLHY TRAVEL ORDERS IN NEED OF OBRACUN



// Map order status codes to Slovenian display labels.
const statusLabels = {
    Active: "Aktiven",
    "Not paid": "Neplačan"
};

// Display message to user with appropriate styling (error or success).
function showMessage(text, type = "error") {
    const message = document.getElementById("message");
    if (!message) return;
    message.textContent = text;
    message.style.display = "block";
    message.style.color = type === "success" ? "#72d6a2" : "#ff8995";
}

// Render monthly calculation orders as cards with employee info, status, dates, and edit button.
function renderMonthlyCalculations(orders) {
    const container = document.getElementById("monthlyCalculations");
    const emptyState = document.getElementById("noMonthlyCalculations");
    if (!container) return;

    // Show empty state message if no orders to display.
    if (orders.length === 0) {
        container.innerHTML = "";
        emptyState.style.display = "block";
        return;
    }

    emptyState.style.display = "none";
    // Generate HTML card for each monthly calculation with status-based styling.
    container.innerHTML = orders.map(order => {
        const departureDate = new Date(order.datum_odhoda);
        const arrivalDate = new Date(order.datum_prihoda);
        const statusClass = order.status === "Not paid" ? "status-not-paid" : "";

        return `
            <div class="travel-order ${statusClass}">
                <div class="order-row">
                    <span><b>Oseba:</b> ${order.ime} ${order.priimek}</span>&nbsp;&nbsp;
                    <span><b>Status:</b> ${statusLabels[order.status] || order.status}</span>&nbsp;&nbsp;
                    <span><b>Št. naloga:</b> ${order.display_id || order.id}</span>
                </div>
                <div class="order-row"><span><b>Lokacija:</b> ${order.lokacija_prihoda}</span></div>
                <div class="order-row">
                    <span><b>Odhod:</b> ${departureDate.toLocaleString("sl-SI")}</span>&nbsp;&nbsp;
                    <span><b>Prihod:</b> ${arrivalDate.toLocaleString("sl-SI")}</span>
                </div>
                <div class="order-buttons">
                    <button class="login-button" onclick="editMonthlyCalculation('${order.id}')">Uredi mesečni obračun</button>
                </div>
            </div>`;
    }).join("");
}

// Fetch all monthly travel orders from admin API and display only active or unpaid ones.
async function loadMonthlyCalculations() {
    try {
        const response = await fetch("/api/admin/all_travel_orders");
        const orders = await response.json();

        if (!response.ok) {
            throw new Error(orders.error || "Mesečnih obračunov ni mogoče naložiti.");
        }

        // Filter to monthly orders with Active or Not paid status, sorted by ID descending.
        const activeOrders = orders
            .filter(order => Number(order.mesecni) === 1)
            .filter(order => order.status === "Active" || order.status === "Not paid")
            .sort((first, second) => Number(second.id) - Number(first.id));

        renderMonthlyCalculations(activeOrders);
    } catch (error) {
        showMessage(error.message || "Napaka pri nalaganju mesečnih obračunov.");
    }
}

// Redirect to edit page for a specific monthly calculation.
function editMonthlyCalculation(orderId) {
    window.location.href = `/admin/urediMesecniObracun?id=${orderId}`;
}

// Load and display monthly calculations when page loads.
document.addEventListener("DOMContentLoaded", loadMonthlyCalculations);