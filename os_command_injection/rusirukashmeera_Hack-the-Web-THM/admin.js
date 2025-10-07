const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');
const Student = require('../models/Student');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Middleware to check if user is logged in as admin
const requireAdmin = (req, res, next) => {
    console.log('[AUTH] Checking admin authentication');
    console.log('[AUTH] Session data:', req.session);
    
    if (!req.session.userType || req.session.userType !== 'admin') {
        console.log('[AUTH] Access denied - not logged in as admin');
        return res.redirect('/login');
    }
    next();
};

// Admin dashboard
router.get('/dashboard', requireAdmin, (req, res) => {
    console.log('[INFO] Loading admin dashboard for:', req.session.username);
    res.render('admin-dashboard');
});

// Search students page - Vulnerable to XSS (Task 3)
router.get('/search', requireAdmin, (req, res) => {
    console.log('[INFO] Loading search students page');
    res.render('admin-search');
});

// Search students POST - Vulnerable to XSS (Task 3)
router.post('/search', requireAdmin, async (req, res) => {
    const { searchQuery } = req.body;
    
    console.log('[INFO] Student search request');
    console.log('[DEBUG] Search query:', searchQuery);
    
    try {
        // Vulnerable: XSS - directly rendering user input without sanitization
        if (searchQuery.includes('<script>')) {
            console.log('[SECURITY] XSS vulnerability detected');
            // Show flag in alert box for XSS
            return res.send(`
                <h1>Search Results</h1>
                <p>Search query: ${searchQuery}</p>
                <script>alert('Flag: THM{xss_vulnerability_found}');</script>
                <a href="/admin/search">Back to Search</a>
            `);
        }
        
        const students = await Student.find({
            $or: [
                { fullName: new RegExp(searchQuery, 'i') },
                { studentId: new RegExp(searchQuery, 'i') },
                { email: new RegExp(searchQuery, 'i') }
            ]
        });
        
        console.log(`[INFO] Found ${students.length} students matching query`);
        res.render('admin-search', { students, searchQuery });
        
    } catch (error) {
        console.error('[ERROR] Search error:', error);
        res.render('admin-search', { error: 'Search failed. Please try again.' });
    }
});

// Add student page
router.get('/add-student', requireAdmin, (req, res) => {
    console.log('[INFO] Loading add student page');
    res.render('admin-add-student');
});

// Add student POST - Vulnerable to Command Injection (Task 3)
router.post('/add-student', requireAdmin, upload.single('photo'), async (req, res) => {
    const { fullName, email, contactNumber, currentYear, currentSemester, age } = req.body;
    
    console.log('[INFO] Add student request');
    console.log('[DEBUG] Student data:', req.body);
    
    try {
        // Vulnerable: Command injection through age field (Task 3)
        if (age && age.includes(';')) {
            console.log('[SECURITY] Command injection detected in age field');
            
            // Execute the command (vulnerable)
            exec(`echo "Processing age: ${age}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error('[ERROR] Command execution error:', error);
                } else {
                    console.log('[INFO] Command output:', stdout);
                }
                
                // Show flag (username from whoami command)
                return res.send(`
                    <h1>Student Added Successfully</h1>
                    <p>Command executed: echo "Processing age: ${age}"</p>
                    <p>Flag: ${process.env.USERNAME || 'administrator'}</p>
                    <a href="/admin/add-student">Add Another Student</a>
                `);
            });
            return;
        }
        
        // Generate student ID
        const studentCount = await Student.countDocuments();
        const studentId = `NCA${String(studentCount + 1).padStart(4, '0')}`;
        
        // Create new student
        const newStudent = new Student({
            studentId,
            fullName,
            email,
            contactNumber,
            currentYear: parseInt(currentYear),
            currentSemester: parseInt(currentSemester),
            username: `student${studentCount + 1}`,
            password: 'student123', // Default password
            photo: req.file ? `/uploads/${req.file.filename}` : '/uploads/default-student.jpg',
            age: age || '20',
            examResults: [
                {
                    semester: 1,
                    year: 1,
                    subjects: [
                        { name: 'Mathematics', grade: 'A', credits: 3 },
                        { name: 'Programming', grade: 'B+', credits: 4 }
                    ],
                    gpa: 3.5
                }
            ]
        });
        
        await newStudent.save();
        
        console.log('[INFO] Student added successfully:', studentId);
        res.render('admin-add-student', { 
            success: `Student ${studentId} added successfully! Username: ${newStudent.username}, Password: student123` 
        });
        
    } catch (error) {
        console.error('[ERROR] Add student error:', error);
        res.render('admin-add-student', { error: 'Failed to add student. Please try again.' });
    }
});

module.exports = router;