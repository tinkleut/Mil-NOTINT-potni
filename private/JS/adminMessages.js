// FUNCTION FOR DISPLAYING ADMIN MESSAGES



function showAdminMessage(text, type = "error") {
    // Get the message display element from the DOM.
    const message = document.getElementById("message");
    
    // Exit early if message element does not exist on the page.
    if (!message) return;
    
    // Set the message text content to the provided text parameter.
    message.textContent = text;
    
    // Apply CSS classes for styling: base "form-message" class plus type-specific class (e.g., "error", "success").
    message.className = `form-message ${type}`;
    
    // Make the message visible by setting display to "block".
    message.style.display = "block";
}