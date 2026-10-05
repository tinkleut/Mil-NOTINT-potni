// FILE FOR CREATING NEW MONTHLY TRAVEL ORDERS



// Get the monthly travel order form element for event listener attachment.
const monthlyTravelOrderForm = document.getElementById("travelOrderForm");

// FUNCTION TO SET DEPARTURE DATE TO FIRST DAY OF CURRENT MONTH
function setCurrentMonthFirstDay() {
    // Get the departure date input field from the form.
    const input = document.getElementById("departureDate");
    
    // Exit if input field doesn't exist or already has a value.
    if (!input || input.value) return;

    // Get current date to extract year and month.
    const today = new Date();
    
    // Extract month and pad with leading zero if needed (e.g., "01" for January).
    const month = String(today.getMonth() + 1).padStart(2, "0");
    
    // Set input value to first day of current month in ISO format.
    input.value = `${today.getFullYear()}-${month}-01`;
}

// FUNCTION TO CALCULATE LAST DAY OF MONTH WITH END-OF-DAY TIMESTAMP
function monthlyEndDate(dateValue) {
    // Parse the provided date string and create a Date object at midnight.
    const date = new Date(`${dateValue}T00:00:00`);
    
    // Calculate the last day of the month by moving to first day of next month, then back one day.
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    // Helper function to pad numbers with leading zeros (e.g., 5 -> "05").
    const pad = value => String(value).padStart(2, "0");
    
    // Return formatted date string with time set to 23:59 (end of day).
    return `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}T23:59`;
}

// HANDLE MONTHLY TRAVEL ORDER FORM SUBMISSION
if (monthlyTravelOrderForm) {
    monthlyTravelOrderForm.addEventListener("submit", async event => {
        // Prevent page reload on form submission.
        event.preventDefault();

        // Convert form data to FormData object for submission.
        const formData = new FormData(monthlyTravelOrderForm);
        
        // Extract key form field values for validation.
        const departureDate = formData.get("departureDate");
        const vehicle = formData.get("vehicle");
        const residence = formData.get("prebivalisce") || "Slovenija";
        const message = document.getElementById("message");

        // Validate that all required fields are filled in.
        if (!departureDate || !formData.get("purpose") || !vehicle) {
            message.textContent = "Prosim izpolnite vsa obvezna polja.";
            return;
        }

        // Map form field names to API field names for server submission.
        formData.set("namen", formData.get("purpose"));
        formData.set("vrsta_projekta", "Mesečni potni nalog");
        formData.set("lokacija_odhoda", `${residence}, Slovenija`);
        formData.set("lokacija_prihoda", "Slovenija");
        
        // Set departure time to midnight (start of the month).
        formData.set("datum_odhoda", `${departureDate}T00:00`);
        
        // Set arrival time to end of month (23:59).
        formData.set("datum_prihoda", monthlyEndDate(departureDate));
        
        // Set vehicle information fields.
        formData.set("vozilo", vehicle);
        formData.set("registerska", formData.get("registerska") || "");
        formData.set("vin", formData.get("vin") || "");
        formData.set("drugo_vozilo", formData.get("drugo_vozilo") || "");
        
        // Set advance payment and notes fields.
        formData.set("placilo_predujema", formData.get("predujem") || "Ne");
        formData.set("opombe", formData.get("notes") || "");
        
        // Mark this as a monthly recurring travel order (1 = yes, 0 = no).
        formData.set("mesecni", "1");

        try {
            // Send POST request to create new monthly travel order on the server.
            const response = await fetch("/api/travel_order", {
                method: "POST",
                body: formData
            });
            
            // Parse response data as JSON.
            const data = await response.json();

            // Check if the request was successful and server returned success flag.
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Shranjevanje ni uspelo.");
            }

            // Redirect user to monthly travel orders list page after successful creation.
            window.location.href = "/mojiMesecniPotniNalogi";
        } catch (error) {
            // Display error message to user if creation fails.
            message.textContent = error.message;
        }
    });
}

// Set departure date to first day of current month when page finishes loading.
document.addEventListener("DOMContentLoaded", () => {
    setCurrentMonthFirstDay();
});