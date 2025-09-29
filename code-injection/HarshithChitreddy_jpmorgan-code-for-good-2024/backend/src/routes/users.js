const express = require('express');
const User = require('../../models/User');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
require('dotenv').config();
const mailgun = require('mailgun-js');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
  });

//Function to send an email notification
const sendNotification = (recipient, subject, text, htmlContent) => {
  const data = {
    from: process.env.MAILGUN_FROM_EMAIL, // Sender email address
    to: recipient, // Recipient email address
    subject: subject, // Subject of the email
    text: text, // Plain text version of the email
    html: htmlContent, // HTML version of the email
  };
  
  console.log(text, subject)
  console.log(`I'm sending an email to ${recipient} from ${process.env.MAILGUN_FROM_EMAIL}`)

  mg.messages().send(data, (error, body) => {
    if (error) {
      console.error('Error sending email:', error); // NEW: Error logging for email sending
    } else {
      console.log('Email sent successfully:', body); // NEW: Success logging for email sending
    }
  });
};

dotenv.config();

//test route
router.get('/test', (req, res) => {
    res.send('Hello World');
});

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]; // Get token from header
    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Add user payload to request
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};

// fetch use just using jwt token?
router.get('/whoami', authenticateToken, async (req, res) => {
    const userRaw = req.user; // just jwt extracted info
    //db call with user id
    const user = await User.findById(userRaw._id); // actual info
    //console.log(user);
    res.json(user);
});

// Register User
router.post('/register', async (req, res) => {
    console.log(req.body);
    const { email, password, age, role, points, phone, orgID, refID } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // Hash the password
    const hashedPwd = await bcrypt.hash(password, 10); // salt rounds

    // Create new user
    const userObject = { email, password: hashedPwd, age, role, points, phone, orgID , referralCode: Math.random().toString(36).substring(2, 15)};
    const newUser = new User(userObject);

    try {
        const savedUser = await newUser.save();
        res.status(201).json({ message: 'User registered successfully', userId: savedUser._id });
    } catch (err) {
        res.status(500).json({ message: 'Error registering user', error: err.message });
    }

    //check if valid referral code & give points to referrer if so
    const referringUser = await User.findOne ({referralCode: refID})
    if (referringUser){
        referringUser.points += 100; // give rerfferring user 100 pts
        console.log('adding points')
        await referringUser.save();
    }
});

// onboard user
router.post('/onboard', authenticateToken, async (req, res) => {
    const { role, fullName, adminCode, gender, activityLevel } = req.body;
    console.log(req.body);

    // Validate input
    if (!role || !fullName || !gender || !activityLevel) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Assuming the user is already authenticated and we have their ID
        const userId = req.user._id;
        console.log(req.user)


        // Find the user by ID
        const user = await User.findById(userId).exec();

        //console.log( user )

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update the user's profile with the onboarding information
        user.role = role;
        user.fullName = fullName;
        user.gender = gender;
        user.activityLevel = activityLevel;

        console.log ( user )

        console.log("before admin role")
        if (role==='Admin'){
            console.log(fullName)
            user.adminCode = fullName.replaceAll(' ', '');
            console.log( user.adminCode )
        }
        if (adminCode!== ''){
            const admin = await User.findOne({adminCode: adminCode});
            user.adminID = admin._id;
        }

        user.onboarded = true;
        console.log("user: ", user);

        // Save the updated user
        const updatedUser = await user.save();

        console.log(updatedUser);

        res.status(200).json({ message: 'User onboarded successfully', user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: 'Error onboarding user', error: err.message });
    }
});

// Login User
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User does not exist' });

    // Validate password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

    // Create and assign JWT
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.header('Authorization', `Bearer ${token}`).json({ message: 'Logged in successfully', token });
});

// Fetch a user by id (protected route)
router.get('/getById/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id).exec();
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
});


// Update a user's points
// in the request body, include the userID and the points to be added 
router.put('/add_points', async (req, res) => {
    const { userId, points } = req.body; // Expecting points to be a number
    console.log(req.body);

    // Validate input
    if (typeof points !== 'number') {
        return res.status(400).json({ message: 'Points value must be a number' });
    }

    try {
        // Find the user by ID
        const user = await User.findById(userId).exec();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update the user's points
        user.points += points; // Update the points; can also handle negative values for deduction
        console.log('adding points')
        await user.save(); // Save the updated user document

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error updating user points', error: error.message });
    }
});

// Add a new route for creating a report
router.post('/:userId/reports', async (req, res) => {
    console.log("Inside the reports route");
    const { userId } = req.params;
    const { ecgRating, pdfLink } = req.body;

    // Validate input
    if (!ecgRating || !pdfLink) {
        return res.status(400).json({ message: 'EKG rating and PDF link are required' });
    }

    // Validate EKG rating
    const validRatings = ['take action', 'no action needed', 'critical'];
    if (!validRatings.includes(ecgRating)) {
        return res.status(400).json({ message: 'Invalid EKG rating' });
    }

    try {
        // Find the user by ID
        const user = await User.findById(userId).exec();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Create a new report
        const report = { ecgRating, pdfLink };

        // Add the report to the user's reports subcollection
        user.reports = user.reports || [];
        user.reports.push(report);

        // Save the updated user document
        await user.save();

    //Fetch the updated user data to get the email address
    const updatedUser = await User.findById(userId).select('email').lean().exec();

    // NEW: Check if user email is available
    if (updatedUser && updatedUser.email) {
      // Send a notification email to the user with the report details
      const subject = `Your EKG Report is Available`;
      const text = `Hello,\n\nYour EKG report is now available in your profile.\n\nECG Rating: ${ecgRating}\nPDF Report Link: ${pdfLink}\n\nPlease review the report and take necessary actions.\n\nThank you,\nHeart in the Game`;

      // Call the sendNotification function to send the email
      sendNotification(updatedUser.email, subject, text);
    }


        res.status(201).json({ message: 'Report created successfully', report });
    } catch (error) {
        res.status(500).json({ message: 'Error creating report', error: error.message });
    }
});

router.get('/studentsOfAdmin', async (req, res) => {
    try {
        const adminId = req.query.adminId;
        console.log( adminId )
      // Find top users sorted by points in descending order
      const adminsStudents = await User.find( {adminID: adminId} ).select('fullName hadEKG').exec()// Select only full name and points for notifications
    console.log(adminsStudents)
      res.status(200).json(adminsStudents);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // send email with qr code pass 
  
// Directory to store temporary QR code images
const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Function to upload image to Cloudflare Images
async function uploadImageToCloudflare(imagePath) {
    console.log("here");
    const image = fs.readFileSync(imagePath);

    // Create a FormData object
    const form = new FormData();
    form.append('file', image, {
        filename: path.basename(imagePath),
        contentType: 'image/png'
    });

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ID}/images/v1`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.CF_TOKEN}`, // Replace with your Cloudflare API token
            ...form.getHeaders() // Include form headers
        },
        body: form
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Cloudflare upload failed: ${data.errors[0].message}`);
    }

    return data.result.variants[0]; // This is the URL of the uploaded image
}

router.get('/bulkEmail', async (req, res) => {
    try {
        const adminId = req.query.adminId;
        console.log(adminId);
        const adminsStudents = await User.find({ adminID: adminId }).select('email _id').exec();

        for (const student of adminsStudents) {
            const genUrl = `http://localhost:3001/api/users/validate?email=${student.email}&id=${student._id}`;
            console.log("here")
            // Generate QR code and save it as a file
            const qrCodePath = path.join(__dirname, '../../temp', `${student._id}_qrcode.png`);
            await QRCode.toFile(qrCodePath, genUrl);

            // Upload the QR code image to Cloudflare
            const imageUrl = await uploadImageToCloudflare(qrCodePath);
            console.log(imageUrl)
            // Delete the temporary QR code image
            fs.unlinkSync(qrCodePath);

            // Email template with embedded image URL
            const subject = 'Your QR Code for Event Participation';
            const text = `Hello,\n\nPlease find your QR code below for event participation.\n\n`;
            const html = `
                <p>Hello,</p>
                <p>Please find your QR code below for event participation.</p>
                <img src="${imageUrl}"/>
                <a href="http://localhost:3001/users/view-qr?imageUrl=${imageUrl}"> View QR </a>
            `;

            // Call the sendNotification function to send the email
            sendNotification(student.email, subject, text, html);
        }
        res.status(200).json(adminsStudents);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get("/view-qr", async (req, res) => {
    document.write(`<img src="${req.query.imageUrl}"/>`)
})
  // endpoint to validate a student by setting  hadEKG given a user id in teh query parameter (See bulk email)
  
router.get('/validate', async (req, res) => {
    const { id } = req.query; // Get user ID from query parameter

    try {
        // Find the user by ID
        const user = await User.findById(id).exec();

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Set hadEKG to true
        user.hadEKG = true;

        // Save the updated user document
        await user.save();
        return res.send("User is validated.")
    } catch (error) {
        res.status(500).json({ message: 'Error validating user', error: error.message });
    }
});

router.get('/adminPoints', async (req, res) => {
    try {
        // Fetch all admins with their adminID and fullName
        const admins = await User.find({ role: 'Admin' }).select('_id fullName').exec();
        console.log("Admins:", admins);
        
        // Initialize an array to hold the results
        const adminsPoints = [];

        // Iterate over each admin to calculate the total points
        for (const admin of admins) {
            const adminId = admin._id;
            const adminFullName = admin.fullName;

            //console.log(`Processing adminID: ${adminId}, fullName: ${adminFullName}`);

            // Find all records for the current admin
            const records = await User.find({ adminID: adminId }).select('points').exec();
            //console.log(`Records for adminID ${adminId}:`, records);
            
            // Initialize totalPoints for the current admin
            let totalPoints = 0;
            
            // Use an inner for loop to sum the points for these records
            for (const record of records) {
                totalPoints += record.points;
            }

            //console.log(`Total points for adminID ${adminId}: ${totalPoints}`);

            // Store the result including fullName
            adminsPoints.push({ adminID: adminId, fullName: adminFullName, totalPoints: totalPoints });
        }

        // Sort the adminsPoints array from most to least points
        adminsPoints.sort((a, b) => b.totalPoints - a.totalPoints);

        console.log("Sorted adminsPoints:", adminsPoints);

        // Send the aggregated results
        res.status(200).json(adminsPoints);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Fetch the coach of a user
router.get('/getCoach', authenticateToken, async (req, res) => {
    const adminID  = req.query.adminID;
    console.log(adminID)
    const admin = await User.findOne( {_id : adminID}).select('fullName').exec();
    console.log(admin)
    if (!admin) {
        return res.status(404).json({ message: 'User not found' });
    }
    res.json(admin);
});

module.exports = router;