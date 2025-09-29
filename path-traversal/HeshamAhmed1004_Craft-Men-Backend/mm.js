const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(bodyParser.json());
// Middleware to handle URL encoded form data
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB (make sure MongoDB is running locally on port 27017)
mongoose.connect('mongodb://localhost:27017/imageStorage', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Define a schema for the image data
const imageSchema = new mongoose.Schema({
    name: String,
    img: {
        data: Buffer,
        contentType: String,
    },
});

// Create a model from the schema
const ImageModel = mongoose.model('Image', imageSchema);

// Set up multer for file upload (adjust destination and filename as needed)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Store files in the 'uploads' directory
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extname = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + extname); // e.g., 'image-1234567890.jpg'
    },
});

const upload = multer({ storage: storage });

// Define the POST route to handle image upload
app.post('/upload', upload.single('image'), (req, res) => {
    // 'image' is the name attribute of the file input in the HTML form

    if (!req.file) {
        return res.status(400).send('No image file uploaded.');
    }

    // Read the image file data
    const imgData = {
        data: fs.readFileSync(req.file.path),  // Use fs.readFileSync
        contentType: req.file.mimetype,
    };

    // Create a new image document
    const newImage = new ImageModel({
        name: req.body.name, // You can add other form fields, like a name for the image
        img: imgData,
    });

    // Save the image to the database
    newImage.save()
        .then(() => {
            // Delete the temporary file
            fs.unlinkSync(req.file.path);
            res.send('Image uploaded and saved to database!');
        })
        .catch((err) => {
            console.error(err);
            res.status(500).send('Error saving image to database.');
        });
});

//  Add this line:
const fs = require('fs');

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
