
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

const DRAFT_KEY = "martine-javascript-study-draft";
const THEME_KEY = "martine-javascript-study-theme";

function updateCounts() {
    const text = noteText.value;
    const characters = text.length;
    const trimmedText = text.trim();

    const words = trimmedText === ""
        ? 0
        : trimmedText.split(/\s+/).length;

    charCount.textContent = `${characters} / 200 characters`;
    wordCount.textContent = `${words} words`;

    charCount.classList.remove("warning", "over");

    if (characters > 200) {
        charCount.classList.add("over");
    } else if (characters > 180) {
        charCount.classList.add("warning");
    }
}

function saveDraft() {
    localStorage.setItem(DRAFT_KEY, noteText.value);
}

function clearNote() {
    noteText.value = "";
    localStorage.removeItem(DRAFT_KEY);
    updateCounts();
}

function applyTheme(isDark) {
    document.body.classList.toggle("dark", isDark);

    themeToggle.textContent = isDark
        ? "Light mode"
        : "Dark mode";
}

function toggleTheme() {
    const isDark = !document.body.classList.contains("dark");

    applyTheme(isDark);

    localStorage.setItem(
        THEME_KEY,
        isDark ? "dark" : "light"
    );
}

// Restore the saved study note.
const savedDraft = localStorage.getItem(DRAFT_KEY);

if (savedDraft !== null) {
    noteText.value = savedDraft;
}

// Restore the selected theme.
const savedTheme = localStorage.getItem(THEME_KEY);
applyTheme(savedTheme === "dark");

// Initialize the counters.
updateCounts();

// Update and save whenever the user types.
noteText.addEventListener("input", () => {
    updateCounts();
    saveDraft();
});

// Clear button.
clearBtn.addEventListener("click", clearNote);

// Theme button.
themeToggle.addEventListener("click", toggleTheme);

// Escape clears the current note.
noteText.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        clearNote();
    }
});
