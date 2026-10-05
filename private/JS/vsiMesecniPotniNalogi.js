// FILE FOR SHOWING ALL CREATED MONTHLY TRAVEL ORDERS



// Store all monthly travel orders fetched from server.
let allMonthlyTravelOrders = [];

// Display message to user with appropriate styling (error or success).
function showMessage(text, type = "error") {
    const message = document.getElementById("message");
    if (!message) return;
    message.textContent = text;
    message.style.display = "block";
    message.style.color = type === "success" ? "#72d6a2" : "#ff8995";
}

// Populate employee dropdown filter with unique users from all orders, sorted alphabetically.
function populateUserFilter(orders) {
    const select = document.getElementById("filterUser");
    if (!select) return;

    // Extract unique users and sort by name in Slovenian locale.
    const users = [...new Map(orders.map(order => [order.user_id, `${order.ime} ${order.priimek}`])).entries()]
        .sort((first, second) => first[1].localeCompare(second[1], "sl"));

    select.innerHTML = `<option value="">Vsi uporabniki</option>${users
        .map(([id, name]) => `<option value="${id}">${name}</option>`)
        .join("")}`;
}

// Filter and sort travel orders based on selected criteria and sort option.
function getFilteredOrders() {
    const from = document.getElementById("filterFrom")?.value || "";
    const to = document.getElementById("filterTo")?.value || "";
    const status = document.getElementById("filterStatus")?.value || "";
    const userId = document.getElementById("filterUser")?.value || "";

    // Apply all selected filters to the orders list.
    return allMonthlyTravelOrders
        .filter(order => {
            const date = String(order.datum_odhoda || "").slice(0, 10);
            return (!from || date >= from)
                && (!to || date <= to)
                && (!status || order.status === status)
                && (!userId || String(order.user_id) === userId);
        })
        // Sort by selected criteria (ID or date, ascending or descending).
        .sort((first, second) => {
            const sort = document.getElementById("sortOrders")?.value || "id-desc";
            if (sort === "id-asc" || sort === "id-desc") {
                const result = Number(first.id) - Number(second.id);
                return sort === "id-asc" ? result : -result;
            }

            const result = String(first.datum_odhoda).localeCompare(String(second.datum_odhoda));
            return sort === "date-asc" ? result : -result;
        });
}

// Render filtered travel orders as cards with employee info, status, dates, and action buttons.
function renderTravelOrders(orders) {
    const container = document.getElementById("travelOrders");
    const emptyState = document.getElementById("noTravelOrders");
    if (!container) return;

    // Show empty state message if no orders match filters.
    if (orders.length === 0) {
        container.innerHTML = "";
        if (emptyState) emptyState.style.display = "block";
        showMessage("Za izbrane pogoje ni mesečnih potnih nalogov.", "success");
        return;
    }

    if (emptyState) emptyState.style.display = "none";
    document.getElementById("message").style.display = "none";

    // Map order status codes to Slovenian display labels.
    const statusLabels = {
        Pending: "Čaka na obravnavo",
        Approved: "Odobren",
        Disapproved: "Zavrnjen",
        Active: "Aktiven",
        "Not paid": "Neplačan",
        Completed: "Zaključen"
    };

    // Generate HTML card for each travel order with styling based on status.
    container.innerHTML = orders.map(order => {
        const departureDate = new Date(order.datum_odhoda);
        const arrivalDate = new Date(order.datum_prihoda);
        const statusClass = `status-${order.status.toLowerCase().replace(/ /g, '-')}`;

        return `
            <div class="travel-order ${statusClass}">
                <div class="order-row"><span><b>Oseba:</b> ${order.ime} ${order.priimek}</span>&nbsp;&nbsp;<span><b>Status:</b> ${statusLabels[order.status] || order.status}</span>&nbsp;&nbsp;<span><b>Št. naloga:</b> ${order.display_id || order.id}</span></div>
                <div class="order-row"><span><b>Lokacija:</b> ${order.lokacija_prihoda}</span></div>
                <div class="order-row"><span><b>Odhod:</b> ${departureDate.toLocaleString("sl-SI")}</span>&nbsp;&nbsp;<span><b>Prihod:</b> ${arrivalDate.toLocaleString("sl-SI")}</span></div>
                <div class="order-buttons"><button class="login-button" onclick="urediMonthlyOrder('${order.id}')">Uredi</button><button class="login-button" onclick="izbrisiMonthlyOrder('${order.id}')">Izbriši</button></div>
            </div>`;
    }).join("");
}

// Fetch all monthly travel orders from admin API and render them with filters applied.
async function loadMonthlyTravelOrders() {
    try {
        const response = await fetch("/api/admin/all_travel_orders");
        const orders = await response.json();

        if (!response.ok) {
            throw new Error(orders.error || "Napaka pri pridobivanju mesečnih potnih nalogov.");
        }

        // Filter to only monthly orders (mesecni = 1).
        allMonthlyTravelOrders = orders.filter(order => Number(order.mesecni) === 1);
        populateUserFilter(allMonthlyTravelOrders);
        renderTravelOrders(getFilteredOrders());
    } catch (error) {
        showMessage(error.message || "Mesečnih potnih nalogov ni mogoče naložiti.");
    }
}

// Delete a monthly travel order after user confirmation.
async function izbrisiMonthlyOrder(orderId) {
    if (!confirm("Ali ste prepričani, da želite izbrisati ta mesečni potni nalog?")) return;

    try {
        const response = await fetch(`/api/admin/delete_travel_order/${orderId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Brisanje ni uspelo.");
        await loadMonthlyTravelOrders();
    } catch (error) {
        showMessage(error.message);
    }
}

// Redirect to edit page for a specific monthly travel order.
function urediMonthlyOrder(orderId) {
    window.location.href = `/admin/urediPotniNalog?id=${orderId}`;
}

// Set up event listeners for filters, sorting, and page load.
document.addEventListener("DOMContentLoaded", () => {
    // Load and display all monthly travel orders on page initialization.
    loadMonthlyTravelOrders();
    // Apply filters when apply button is clicked.
    document.getElementById("applyFilters")?.addEventListener("click", () => renderTravelOrders(getFilteredOrders()));
    // Re-render when sort option changes.
    document.getElementById("sortOrders")?.addEventListener("change", () => renderTravelOrders(getFilteredOrders()));
    // Clear all filters and show all orders.
    document.getElementById("clearFilters")?.addEventListener("click", () => {
        ["filterFrom", "filterTo", "filterStatus", "filterUser"].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = "";
        });
        renderTravelOrders(getFilteredOrders());
    });
});