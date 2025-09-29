require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const openAiApiKey = process.env.OPENAI_API_KEY;

// Middleware
app.use(bodyParser.json());

// Generate Lesson Recommendations
app.post('/api/generate-recommendations', async (req, res) => {
    const { studentName, gradeLevel, iepAccommodations, groupLevel, lessonFocus } = req.body;

    if (!studentName || !gradeLevel || !iepAccommodations || !groupLevel || !lessonFocus) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const prompt = `
    Create a personalized lesson plan:
    - Name: ${studentName}
    - Grade: ${gradeLevel}
    - IEP: ${iepAccommodations}
    - Group Level: ${groupLevel}
    - Focus: ${lessonFocus}
    Provide actionable steps and justify your suggestions.
    `;

    try {
        const response = await axios.post('https://api.openai.com/v1/completions', {
            model: "gpt-4",
            prompt,
            max_tokens: 800
        }, {
            headers: { Authorization: `Bearer ${openAiApiKey}` }
        });

        res.json({ success: true, recommendations: response.data.choices[0].text.trim() });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ success: false, message: "AI consultation failed." });
    }
});

// Feedback Submission
app.post('/api/feedback', (req, res) => {
    const { feedback } = req.body;

    if (!feedback) {
        return res.status(400).json({ success: false, message: "Feedback is required." });
    }

    console.log(`Feedback: ${feedback}`);
    res.json({ success: true, message: "Feedback submitted." });
});

app.listen(5000, () => {
    console.log('Server running on port 5000');
});

let classrooms = {}; // Local storage of classrooms

// Handle classroom creation
document.getElementById("classroom-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const classroomName = document.getElementById("classroom-name").value.trim();
    if (!classroomName) return alert("Please enter a classroom name.");

    if (!classrooms[classroomName]) classrooms[classroomName] = [];
    updateClassroomSelector();
    alert(`Classroom "${classroomName}" created!`);
});

// Update classroom selector
function updateClassroomSelector() {
    const selector = document.getElementById("classroom-selector");
    selector.innerHTML = `<option value="" disabled selected>Select a classroom</option>`;
    for (const name in classrooms) {
        selector.innerHTML += `<option value="${name}">${name}</option>`;
    }
}

// Display students in a classroom
document.getElementById("classroom-selector").addEventListener("change", function () {
    const classroomName = this.value;
    const studentList = document.getElementById("student-list");
    studentList.innerHTML = classrooms[classroomName]
        .map(student => `<p>${student.name} (${student.grade})</p>`)
        .join("");
});

// Example: Add a student to a classroom (update when saving profiles)
function addStudentToClassroom(classroomName, student) {
    if (!classrooms[classroomName]) classrooms[classroomName] = [];
    classrooms[classroomName].push(student);
} 


