
const loadButton = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusMessage = document.getElementById("status");
const usersList = document.getElementById("users-list");

const API_URL = "https://jsonplaceholder.typicode.com/users";

// Store the users after the API request succeeds.
let users = [];

/**
 * Creates and displays list items for any array of users.
 */
function renderUsers(list) {
    // Remove previous results.
    usersList.replaceChildren();

    if (list.length === 0) {
        statusMessage.textContent = "No users match your filter.";
        return;
    }

    const fragment = document.createDocumentFragment();

    list.forEach((user) => {
        const listItem = document.createElement("li");

        const name = document.createElement("h3");
        name.textContent = user.name;

        const email = document.createElement("p");
        email.textContent = `Email: ${user.email}`;

        const city = document.createElement("p");
        city.textContent = `City: ${user.address.city}`;

        const company = document.createElement("p");
        company.textContent = `Company: ${user.company.name}`;

        listItem.append(name, email, city, company);
        fragment.appendChild(listItem);
    });

    usersList.appendChild(fragment);

    statusMessage.textContent =
        `Showing ${list.length} ${list.length === 1 ? "user" : "users"}.`;
}

/**
 * Fetches the users from the API.
 */
async function loadUsers() {
    loadButton.disabled = true;
    loadButton.textContent = "Loading...";
    statusMessage.textContent = "Loading users...";
    usersList.replaceChildren();

    try {
        const response = await fetch(API_URL);

        // fetch() does not reject automatically for HTTP 404 or 500.
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        // Validate the data before using it.
        if (!Array.isArray(data)) {
            throw new Error("The API returned an invalid users list.");
        }

        users = data;

        // Respect any filter already entered by the user.
        const searchTerm = filterInput.value.trim().toLowerCase();

        const filteredUsers = users.filter((user) =>
            user.name.toLowerCase().includes(searchTerm)
        );

        renderUsers(filteredUsers);

    } catch (error) {
        users = [];
        usersList.replaceChildren();

        statusMessage.textContent =
            `Error loading users: ${error.message}. Please try again.`;

    } finally {
        loadButton.disabled = false;
        loadButton.textContent = "Load Users";
    }
}

// Load users when the button is clicked.
loadButton.addEventListener("click", loadUsers);

// Filter the stored users without making another API request.
filterInput.addEventListener("input", () => {
    const searchTerm = filterInput.value.trim().toLowerCase();

    const filteredUsers = users.filter((user) =>
        user.name.toLowerCase().includes(searchTerm)
    );

    renderUsers(filteredUsers);
});
