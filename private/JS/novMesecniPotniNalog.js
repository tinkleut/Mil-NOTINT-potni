// FILE FOR CRATEING A NEW MONTHLY TRAVEL ORDER



// Get form element and employee dropdown from the page.
const monthlyTravelOrderForm = document.getElementById("monthlyTravelOrderForm");
const employeeSelect = document.getElementById("user_id");
let selectedEmployee = null;

// Display message to user with appropriate styling (error or success).
function showMessage(text, type = "error") {
    const message = document.getElementById("message");
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`;
}

// Set the value of a form field by its ID, or clear it if value is empty.
function setFieldValue(id, value) {
    const field = document.getElementById(id);
    if (field) field.value = value || "";
}

// Set departure date to the first day of the current month.
function setCurrentMonthFirstDay() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    document.getElementById("departureDate").value = `${today.getFullYear()}-${month}-01`;
}

// Show or hide vehicle-specific fields based on selected vehicle type.
function toggleOtherVehicle() {
    const vehicle = document.getElementById("vehicle").value;
    const carDetails = document.getElementById("carDetails");
    const details = document.getElementById("otherVehicleDetails");
    carDetails.classList.toggle("hidden", vehicle !== "car");
    details.classList.toggle("hidden", vehicle !== "other");
    document.getElementById("drugo_vozilo").required = vehicle === "other";
}

// Fetch list of all employees from server and populate dropdown.
async function loadEmployees() {
    const response = await fetch("/api/employees");
    const employees = await response.json();

    if (!response.ok) {
        throw new Error(employees.message || "Zaposlenih ni mogoče naložiti.");
    }

    // Add each employee to the dropdown with their name and username.
    employees.forEach(employee => {
        const option = document.createElement("option");
        option.value = employee.id;
        option.textContent = `${employee.ime} ${employee.priimek} (${employee.username})`;
        employeeSelect.appendChild(option);
    });
}

// Fetch and display employee details (name, residence, vehicle info) based on selected employee ID.
async function loadEmployeeDetails(employeeId) {

    // if none employee is picked then clear the form.
    if (!employeeId) {
        selectedEmployee = null;
        ["ime", "priimek", "prebivalisce", "delovno_mesto", "registerska", "vin"].forEach(id => setFieldValue(id, ""));
        return;
    }

    const response = await fetch(`/api/user_info_admin?employee_id=${encodeURIComponent(employeeId)}`);
    const employee = await response.json();

    if (!response.ok) {
        throw new Error(employee.message || "Podatkov zaposlenega ni mogoče naložiti.");
    }

    // Store employee data and populate form fields with their information.
    selectedEmployee = employee;
    setFieldValue("ime", employee.ime);
    setFieldValue("priimek", employee.priimek);
    setFieldValue("prebivalisce", employee.prebivalisce);
    setFieldValue("delovno_mesto", employee.delovno_mesto);
    setFieldValue("registerska", employee.registerska);
    setFieldValue("vin", employee.vin);
}

// Calculate first and last day of the month for the selected date.
function monthlyDates(dateValue) {
    const selectedDate = new Date(`${dateValue}T00:00:00`);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const pad = value => String(value).padStart(2, "0");
    const firstDay = `${year}-${pad(month + 1)}-01T00:00`;
    const lastDay = new Date(year, month + 1, 0);
    const lastDate = `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}T23:59`;
    return { firstDay, lastDate };
}

// Validate form data and submit monthly travel order to server.
async function submitMonthlyTravelOrder(event) {
    event.preventDefault();

    const employeeId = employeeSelect.value;
    const dateValue = document.getElementById("departureDate").value;
    const vehicle = document.getElementById("vehicle").value;
    const purpose = document.getElementById("purpose").value.trim();
    const advancePayment = document.getElementById("predujem").value.trim();
    const otherVehicle = document.getElementById("drugo_vozilo").value.trim();

    // Ensure all required fields are filled before submission.
    if (!employeeId || !selectedEmployee || !dateValue || !purpose || !vehicle || !advancePayment) {
        showMessage("Prosim izpolnite vsa obvezna polja.");
        return;
    }

    // Validate employee has car details if vehicle type is "car".
    if (vehicle === "car" && (!selectedEmployee.registerska || !selectedEmployee.vin)) {
        showMessage("Izbrani zaposleni nima vnesene registrske tablice ali VIN številke.");
        return;
    }

    // Validate other vehicle description if vehicle type is "other".
    if (vehicle === "other" && !otherVehicle) {
        showMessage("Vnesite drugo prevozno sredstvo.");
        return;
    }

    // Calculate month span from selected date.
    const { firstDay, lastDate } = monthlyDates(dateValue);
    const formData = new FormData(monthlyTravelOrderForm);
    const residence = document.getElementById("prebivalisce").value.trim();

    // Build form payload with monthly travel order details.
    formData.set("employee_id", employeeId);
    formData.set("namen", purpose);
    formData.set("vrsta_projekta", "Mesečni potni nalog");
    formData.set("lokacija_odhoda", `${residence}, Slovenija`);
    formData.set("lokacija_prihoda", "Slovenija");
    formData.set("datum_odhoda", firstDay);
    formData.set("datum_prihoda", lastDate);
    formData.set("vozilo", vehicle);
    formData.set("registerska", vehicle === "car" ? selectedEmployee.registerska : "");
    formData.set("vin", vehicle === "car" ? selectedEmployee.vin : "");
    formData.set("drugo_vozilo", vehicle === "other" ? otherVehicle : "");
    formData.set("placilo_predujema", advancePayment);
    formData.set("mesecni", "1");

    try {
        // Send monthly travel order data to server for storage.
        const response = await fetch("/api/travel_order", {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Shranjevanje mesečnega potnega naloga ni uspelo.");
        }

        showMessage("Mesečni potni nalog je bil uspešno ustvarjen.", "success");
        // Reset form to initial state after successful creation.
        monthlyTravelOrderForm.reset();
        selectedEmployee = null;
        ["ime", "priimek", "prebivalisce", "delovno_mesto", "registerska", "vin"].forEach(id => setFieldValue(id, ""));
        setCurrentMonthFirstDay();
        toggleOtherVehicle();
    } catch (error) {
        showMessage(error.message);
    }
}

// Set up event listeners and load initial data when page loads.
document.addEventListener("DOMContentLoaded", async () => {
    // Initialize departure date to first day of current month.
    setCurrentMonthFirstDay();
    // Toggle vehicle fields when vehicle selection changes.
    document.getElementById("vehicle").addEventListener("change", toggleOtherVehicle);
    // Load employee details when employee selection changes.
    employeeSelect.addEventListener("change", async event => {
        try {
            await loadEmployeeDetails(event.target.value);
        } catch (error) {
            showMessage(error.message);
        }
    });

    monthlyTravelOrderForm.addEventListener("submit", submitMonthlyTravelOrder);

    try {
        // Load employee dropdown list and initialize vehicle field visibility.
        await loadEmployees();
        toggleOtherVehicle();
    } catch (error) {
        showMessage(error.message);
    }
});