const dotenv = require("dotenv");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");

const app = require("./app");

dotenv.config();

// Middlewares
app.use(express.json()); 
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'  // Allow all origins or restrict based on environment variable
}));

// IMPORTED ROUTES
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const questionRoutes = require("./routes/question");

// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/questions", questionRoutes);

app.get("/run-python/:age/:description", (req, res) => {
  let { age, description } = req.params;

  // Validate and convert age to integer
  let ageInt;
  try {
    ageInt = parseInt(age, 10);
    if (isNaN(ageInt)) {
      return res.status(400).json({ error: "Age must be a valid integer." });
    }
  } catch (error) {
    return res.status(400).json({ error: "Invalid age parameter." });
  }

  // Input sanitization to avoid command injection
  if (!description || typeof description !== "string" || description.length > 100) {
    return res.status(400).json({ error: "Invalid description input." });
  }

  // Run the Python script with arguments
  const pythonProcess = spawn("python3", [
    "check.py",  // Updated path (ensure correct relative path)
    ageInt.toString(),
    "Vega",
    "False",
    description,
    "fish",
  ]);

  let output = "";
  let errorOutput = "";

  // Collect the stdout
  pythonProcess.stdout.on("data", (data) => {
    output += data.toString();
  });

  // Collect the stderr
  pythonProcess.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });

  // On close, parse the output
  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python script failed with error: ${errorOutput}`);
      return res.status(500).json({ error: "Error executing Python script" });
    }

    try {
      const result = JSON.parse(output); // Assuming JSON output from Python
      res.json(result);
    } catch (parseError) {
      console.error(`Error parsing Python script output: ${parseError}`);
      res.status(500).json({ error: "Error parsing Python response" });
    }
  });

  // Error handling for process spawn failure
  pythonProcess.on("error", (err) => {
    console.error("Failed to start Python process:", err);
    res.status(500).json({ error: "Failed to start Python process" });
  });
});

// MONGOOSE SETUP
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || "your-default-mongodb-uri-here";

mongoose
  .connect(MONGO_URI, {})
  .then(() => {
    if (process.env.NODE_ENV !== "test") {
      app.listen(PORT, () => console.log(`Server running on port: ${PORT}`));
    }
  })
  .catch((error) => console.error("Database connection error:", error));
