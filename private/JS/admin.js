// CODE FOR STATS OF ALL TRAVEL ORDERS



async function statistics() {
    try {
        // Initialize counters for each travel order status.
        let pen = 0;  // Pending
        let apr = 0;  // Approved
        let dis = 0;  // Disapproved
        let act = 0;  // Active
        let pay = 0;  // Not paid
        let clo = 0;  // Completed

        // Fetch statistics data from the server.
        const response = await fetch("/api/admin/stats");

        // Check if the request was successful.
        if (!response.ok) {
            throw new Error("Napaka pri dobivanju informacij...");
        }

        // Parse response to get array of travel order statistics.
        const stats = await response.json();

        // Iterate through each travel order and count by status.
        stats.forEach(stat => {
            // Increment the appropriate counter based on the order's current status.
            if (stat.status === "Pending") {
                pen += 1;
            } else if (stat.status === "Approved") {
                apr += 1;
            } else if (stat.status === "Disapproved") {
                dis += 1;
            } else if (stat.status === "Active") {
                act += 1;
            } else if (stat.status === "Not paid") {
                pay += 1;
            } else if (stat.status === "Completed") {
                clo += 1;
            }
        });

        // Get the container element where statistics cards will be displayed.
        const container = document.querySelector(".admin-statistics");

        // Build HTML string for all statistics cards.
        let html = "";

        html += `
        
        <!-- Pending travel orders card - navigates to pending page on click -->
        <div class="admin-card pending-card" onclick="document.location='/admin/pending'">

                <h3>Čakajoči</h3>

                <p class="stat-number" id="pendingCount">
                    
                </p>

                <span>
                    Čaka na obravnavo
                </span>

            </div>


            <!-- Approved travel orders card - navigates to approved page on click -->
            <div class="admin-card approved-card" onclick="document.location='/admin/approved'">

                <h3>Odobreni</h3>

                <p class="stat-number" id="approvedCount">
                    
                </p>

                <span>
                    Odobreni nalogi
                </span>

            </div>


            <!-- Disapproved travel orders card - navigates to disapproved page on click -->
            <div class="admin-card disapproved-card" onclick="document.location='/admin/disapproved'">

                <h3>Zavrnjeni</h3>

                <p class="stat-number" id="disapprovedCount">
                    
                </p>

                <span>
                    Zavrnjeni nalogi
                </span>

            </div>


            <!-- Active travel orders card - navigates to active page on click -->
            <div class="admin-card active-card" onclick="document.location='/admin/active'">

                <h3>Aktivni</h3>

                <p class="stat-number" id="activeCount">
                    
                </p>

                <span>
                    Trenutno aktivni
                </span>

            </div>


            <!-- Not paid travel orders card - navigates to paid page on click -->
            <div class="admin-card not-paid-card" onclick="document.location='/admin/paid'">

                <h3>Neplačani</h3>

                <p class="stat-number" id="notPaidCount">
                    
                </p>

                <span>
                    Še ne plačani potni nalogi
                </span>

            </div>


            <!-- Completed travel orders card - navigates to closed page on click -->
            <div class="admin-card closed-card" onclick="document.location='/admin/closed'">

                <h3>Zaključeni</h3>

                <p class="stat-number" id="completedCount">
                    
                </p>

                <span>
                    Vsi že končani potni nalogi
                </span>

            </div>
        
        `;

        // Insert generated HTML string into the container for display.
        container.innerHTML = html;

        // Fill in each statistics card with the actual count values.
        document.querySelector("#pendingCount").textContent = pen;
        document.querySelector("#approvedCount").textContent = apr;
        document.querySelector("#disapprovedCount").textContent = dis;
        document.querySelector("#activeCount").textContent = act;
        document.querySelector("#notPaidCount").textContent = pay;
        document.querySelector("#completedCount").textContent = clo;

    // Catch any errors that may occur during statistics loading.
    } catch (error) {
        console.error(error);
    }
}

// Load and display statistics when page finishes loading.
document.addEventListener("DOMContentLoaded", statistics);