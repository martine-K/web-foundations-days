// Starting notes data

let notes = [
    { id: 1, text: "Buy milk and bread", category: "personal" },
    { id: 2, text: "Finish the Day 3 assignment", category: "study" },
    { id: 3, text: "Email the project report to Grace", category: "work" },
    { id: 4, text: "Revise JavaScript arrays", category: "study" },
    { id: 5, text: "Call mum", category: "personal" },
];


// 1. Search notes
function searchNotes(word) {
    return notes.filter(note =>
        note.text.toLowerCase().includes(word.toLowerCase())
    );
}


// Test searchNotes
console.log(
    searchNotes("javascript")
);
// Expected: [{ id: 4, text: "Revise JavaScript arrays", category: "study" }]

console.log(
    searchNotes("python")
);
// Expected: []



// 2. Find the longest note
function longestNote() {
    if (notes.length === 0) {
        return null;
    }

    let longest = notes[0];

    for (let i = 1; i < notes.length; i++) {
        if (notes[i].text.length > longest.text.length) {
            longest = notes[i];
        }
    }

    return longest;
}


// Test longestNote
console.log(
    longestNote()
);
// Expected: { id: 3, text: "Email the project report to Grace", category: "work" }

console.log(
    (() => {
        const originalNotes = notes;
        notes = [];
        const result = longestNote();
        notes = originalNotes;
        return result;
    })()
);
// Expected: null



// 3. Count notes by category
function countByCategory() {
    const counts = {};

    for (const note of notes) {
        if (counts[note.category]) {
            counts[note.category]++;
        } else {
            counts[note.category] = 1;
        }
    }

    return counts;
}


// Test countByCategory
console.log(
    countByCategory()
);
// Expected: { personal: 2, study: 2, work: 1 }

console.log(
    (() => {
        const originalNotes = notes;
        notes = [];
        const result = countByCategory();
        notes = originalNotes;
        return result;
    })()
);
// Expected: {}



// 4. Get notes summary
function getSummary() {
    const counts = countByCategory();
    const total = notes.length;

    const noteWord = total === 1 ? "note" : "notes";

    const categories = [];

    if (counts.personal) {
        categories.push(`${counts.personal} personal`);
    }

    if (counts.work) {
        categories.push(`${counts.work} work`);
    }

    if (counts.study) {
        categories.push(`${counts.study} study`);
    }

    return `${total} ${noteWord}: ${categories.join(", ")}.`;
}


// Test getSummary
console.log(
    getSummary()
);
// Expected: "5 notes: 2 personal, 1 work, 2 study."

console.log(
    (() => {
        const originalNotes = notes;
        notes = [{ id: 6, text: "Study", category: "study" }];
        const result = getSummary();
        notes = originalNotes;
        return result;
    })()
);
// Expected: "1 note: 1 study."



// 5. Check for duplicate notes
function isDuplicate(text) {
    const normalizedText = text.trim().toLowerCase();

    return notes.some(note =>
        note.text.trim().toLowerCase() === normalizedText
    );
}


// Test isDuplicate
console.log(
    isDuplicate("  BUY MILK AND BREAD  ")
);
// Expected: true

console.log(
    isDuplicate("Buy eggs")
);
// Expected: false



// 6. Add a new note
function addNote(text, category) {
    const trimmedText = text.trim();
    const validCategories = ["personal", "work", "study"];

    if (trimmedText.length < 1 || trimmedText.length > 200) {
        console.log("Note was not added: text must be between 1 and 200 characters.");
        return false;
    }

    if (isDuplicate(trimmedText)) {
        console.log("Note was not added: duplicate note.");
        return false;
    }

    if (!validCategories.includes(category)) {
        console.log("Note was not added: invalid category.");
        return false;
    }

    const newId = notes.length > 0
        ? Math.max(...notes.map(note => note.id)) + 1
        : 1;

    notes.push({
        id: newId,
        text: trimmedText,
        category: category
    });

    console.log("Note added successfully.");

    return true;
}


// Test addNote - normal case
console.log(
    addNote("Learn JavaScript functions", "study")
);
// Expected: true


// Test addNote - duplicate case
console.log(
    addNote("  BUY MILK AND BREAD  ", "personal")
);
// Expected: false


// Test addNote - invalid category
console.log(
    addNote("Prepare presentation", "school")
);
// Expected: false


// Test addNote - empty text
console.log(
    addNote("", "study")
);
// Expected: false