// CODE FOR FILTERING AND SORTING ADMIN TRAVEL ORDERS



document.addEventListener("DOMContentLoaded", () => {
    // Get the container element where travel orders are displayed.
    const container = document.getElementById("travelOrders");
    if (!container) return;

    // Create a new div element to hold all filter and sort controls, it creates it only in memory, but does not display it just yet on the page.
    const controls = document.createElement("div");

    // Give div a class name for CSS.
    controls.className = "order-filters admin-order-filters";
    
    // Build HTML for all filter and sort options with input fields and buttons.
    controls.innerHTML = `
        <!-- Date range filter: from date -->
        <label>Od datuma <input type="date" id="adminFilterFrom"></label>
        
        <!-- Date range filter: to date -->
        <label>Do datuma <input type="date" id="adminFilterTo"></label>
        
        <!-- User filter dropdown - populated dynamically with available users -->
        <label>Uporabnik <select id="adminFilterUser"><option value="">Vsi uporabniki</option></select></label>
        
        <!-- Status filter dropdown with predefined status options -->
        <label>Status <select id="adminFilterStatus">
            <option value="">Vsi statusi</option>
            <option value="Pending">Čakajoči</option>
            <option value="Approved">Odobreni</option>
            <option value="Disapproved">Zavrnjeni</option>
            <option value="Active">Aktivni</option>
            <option value="Not paid">Neplačani</option>
            <option value="Completed">Zaključeni</option>
        </select></label>
        
        <!-- Sort order dropdown with various sorting options -->
        <label>Razvrsti <select id="adminSortOrders">
            <option value="id-desc">ID, padajoče</option>
            <option value="id-asc">ID, naraščajoče</option>
            <option value="date-desc">Datum, novejši najprej</option>
            <option value="date-asc">Datum, starejši najprej</option>
        </select></label>
        
        <!-- Button to apply selected filters and sorting -->
        <button type="button" class="login-button" id="adminApplyFilters">Filtriraj</button>
        
        <!-- Button to clear all filters and reset to default view -->
        <button type="button" class="login-button" id="adminClearFilters">Počisti</button>
    `;
    
    // Insert the controls div before the travel orders container.
    // container.parentNode gets the parent element of #travelOrders.
    container.parentNode.insertBefore(controls, container);

    // Array to store all travel order card elements currently in the DOM.
    let cards = [];
    
    // Get reference to the user filter dropdown for later use.
    const userSelect = document.getElementById("adminFilterUser");

    // UPDATE CARDS AND POPULATE USER DROPDOWN
    function updateCardsAndUsers() {
        // Refresh the cards array with all current travel order elements.
        cards = [...container.querySelectorAll(".travel-order")];
        
        // Store the currently selected user value to preserve it after refresh.
        const selectedUser = userSelect.value;
        
        // Extract all unique user names from card dataset, trim whitespace, and sort alphabetically in Slovenian.
        const users = [...new Set(cards.map(card => (card.dataset.user || "").trim()).filter(Boolean))]
            .sort((first, second) => first.localeCompare(second, "sl", { sensitivity: "base" }));
        
        // Rebuild the user dropdown with "all users" option first.
        userSelect.innerHTML = '<option value="">Vsi uporabniki</option>';
        
        // Add each unique user as an option to the dropdown.
        users.forEach(user => {
            const option = document.createElement("option");
            option.value = user;
            option.textContent = user;
            userSelect.appendChild(option);
        });
        
        // Restore the previously selected user if it still exists in the updated list.
        if (users.includes(selectedUser)) {
            userSelect.value = selectedUser;
        }
    }

    // APPLY FILTERS AND SORTING
    const apply = () => {
        // Update the cards array and user dropdown with current data.
        updateCardsAndUsers();
        
        // Get the current values from all filter inputs.
        const from = document.getElementById("adminFilterFrom").value;
        const to = document.getElementById("adminFilterTo").value;
        const user = document.getElementById("adminFilterUser").value.trim();
        const status = document.getElementById("adminFilterStatus").value;
        const sort = document.getElementById("adminSortOrders").value;
        
        // Filter cards based on date range, user, and status criteria.
        const visible = cards.filter(card => {
            // Extract the date from the card's data attribute.
            const date = card.dataset.date || "";
            
            // Return true if card matches all active filters.
            return (!from || date >= from) && (!to || date <= to)
                && (!user || (card.dataset.user || "").trim() === user)
                && (!status || card.dataset.status === status);
        });
        
        // Sort the visible cards based on the selected sort option.
        visible.sort((a, b) => {
            // Determine sort value based on whether sorting by ID or date.
            const value = sort.startsWith("id")
                ? Number(a.dataset.orderId) - Number(b.dataset.orderId)
                : String(a.dataset.date).localeCompare(String(b.dataset.date));
            
            // Return ascending or descending order based on sort selection.
            return sort.endsWith("asc") ? value : -value;
        });
        
        // Hide all cards first, then show only the filtered ones.
        cards.forEach(card => { card.hidden = !visible.includes(card); });
        
        // Reorder cards in the DOM to match the sorted order.
        visible.forEach(card => container.appendChild(card));
    };

    // Add click event listener to apply filters button.
    document.getElementById("adminApplyFilters").addEventListener("click", apply);
    
    // Add click event listener to clear filters button.
    document.getElementById("adminClearFilters").addEventListener("click", () => {

        // Clear all input and select values in the controls.
        controls.querySelectorAll("input, select").forEach(element => { element.value = ""; });
        
        // Reset sort dropdown to default (ID descending) option.
        document.getElementById("adminSortOrders").value = "id-desc";
        
        // Apply filters to update the display with cleared filters.
        apply();
    });
    
    // Wait for travel order cards to load before applying initial filters.
    let attempts = 0;
    const waitForOrders = window.setInterval(() => {
        attempts += 1;
        
        // If at least one card is found or max attempts reached, stop waiting and apply filters.
        if (container.querySelector(".travel-order") || attempts >= 100) {
            window.clearInterval(waitForOrders);
            apply();
        }
    }, 50);
});