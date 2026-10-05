// FILE FOR ALLOWING US TO HAVE AUTOFILL FOR VEHICLE


const vozilo = document.getElementById("vehicle");
const carDetails = document.getElementById("carDetails");
const otherVehicleDetails = document.getElementById("otherVehicleDetails");

function updateVehicleDetails() {
    if (vozilo.value === "car") {

    // Show the car details section.
    carDetails.classList.remove("hidden");

    // Hide the other vehicle details section.
    otherVehicleDetails.classList.add("hidden");

// Check if the user selected another type of vehicle.
    } else if (vozilo.value === "other") {

    // Hide the car details section.
    carDetails.classList.add("hidden");

    // Show the other vehicle details section.
    otherVehicleDetails.classList.remove("hidden");

// If no valid vehicle type is selected.
    } else {

    // Hide both vehicle detail sections.
    carDetails.classList.add("hidden");
    otherVehicleDetails.classList.add("hidden");
    }
}

// Keeping the vehicle-related UI/values in sync with the user's current choice.
if (vozilo && carDetails && otherVehicleDetails) {
    vozilo.addEventListener("change", updateVehicleDetails);
    updateVehicleDetails();
}


