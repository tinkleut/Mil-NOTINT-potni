// LOAD ALL EMPLOYEES FROM THE SERVER AND POPULATE THE DROPDOWN SELECT



async function loadEmployees() {
    try {
        
        // Fetch all employees from the server.
        const response = await fetch("/api/employees");
        const employees = await response.json();

        // Get the select dropdown element where employee options will be added.
        const select = document.getElementById("uname");
        
        // Check if the select element exists on the page.
        if (!select) {
            console.error("Element #uname ne obstaja!");
            return;
        }

        // Iterate through each employee and create an option element.
        employees.forEach(emp => {
            const option = document.createElement("option");
            option.value = emp.id;
            option.textContent = `${emp.username} - ${emp.ime} ${emp.priimek}`;
            select.appendChild(option);
        });

    } catch (error) {
        // Log error if employee data loading fails.
        console.error("Napaka pri nalaganju zaposlenih:", error);
    }
}

// INITIALIZE EMPLOYEE LOADING AND SET UP EVENT LISTENERS WHEN PAGE LOADS
document.addEventListener("DOMContentLoaded", () => {
    // Load all available employees into the dropdown.
    loadEmployees();
    
    // Get the employee name input/select element.
    const unameInput = document.getElementById("uname");
    
    // Set up change event listener to fetch user info when employee is selected.
    if (unameInput) {
        unameInput.addEventListener("change", (e) => {
            const employeeId = e.target.value.trim();
            
            // Fetch and populate user information when a valid employee is selected.
            if (employeeId) {
                getUserInfo(employeeId);
            }
        });
    }
});

// FETCH AND POPULATE USER INFORMATION FOR A SPECIFIC EMPLOYEE
async function getUserInfo(employeeId = null) {
    try {
        
        // Build the URL based on whether an employee ID was provided.
        const url = employeeId  
            ? `/api/user_info_admin?employee_id=${encodeURIComponent(employeeId)}`
            : `/api/user_info`;
        
        // Fetch user information from the server.
        const response = await fetch(url);
        const data = await response.json();
        
        // Populate the first name field if element exists.
        const ime = document.getElementById("ime");
        if (ime) ime.value = data.ime || "";
        
        // Populate the last name field if element exists.
        const priimek = document.getElementById("priimek");
        if (priimek) priimek.value = data.priimek || "";
        
        // Populate the residence/address field if element exists.
        const prebivalisce = document.getElementById("prebivalisce");
        if (prebivalisce) prebivalisce.value = data.prebivalisce || "";
        
        // Populate the job position field if element exists.
        const delovnoMesto = document.getElementById("delovno_mesto");
        if (delovnoMesto) delovnoMesto.value = data.delovno_mesto || "";
        
        // Populate the registration number field if element exists.
        const registerska = document.getElementById("registerska");
        if (registerska) registerska.value = data.registerska || "";
        
        // Populate the VIN (vehicle identification number) field if element exists.
        const vin = document.getElementById("vin");
        if (vin) vin.value = data.vin || "";
        
    } catch (error) {
        // Log error if user data loading fails.
        console.error("Napaka pri nalaganju podatkov:", error);
    }
}