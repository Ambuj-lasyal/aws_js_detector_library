const express = require("express");
const mongoose = require("mongoose");
const multer = require('multer');
const path = require("path");
const dotenv = require("dotenv");
const authRoutes = require("./routers/auth");
const genreRoutes = require("./routers/genre");
const searchRoutes = require("./routers/search")
const giamgiaRoutes = require("./routers/giamgia");
const Book = require("./models/Book");
const User = require("./models/User");

dotenv.config();

const app = express();

const cors = require("cors");
app.use(cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Kết nối MongoDB
mongoose
    .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ Kết nối MongoDB thành công!"))
    .catch((err) => console.error("❌ Kết nối MongoDB thất bại:", err));

// Multer config
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('thumbnail');

function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only!');
    }
}

// Routes
app.use("/auth", authRoutes);
app.use("/genres", genreRoutes);
app.use("/search", searchRoutes);
app.use("/giamgia", giamgiaRoutes);
const paymentRoutes = require("./routers/payment");
app.use("/api", paymentRoutes);


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📌 API lấy toàn bộ sách
app.get('/api/books', async (req, res) => {
    try {
        const books = await Book.find(); // Kiểm tra xem Book đã import đúng chưa
        res.json(books);
    } catch (err) {
        console.error("Lỗi khi lấy danh sách sách:", err);
        res.status(500).json({ message: err.message });
    }
});

// 📌 API lấy toàn bộ user
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        console.error("Lỗi khi lấy danh sách sách:", err);
        res.status(500).json({ message: err.message });
    }
});

// 📌 API thêm sách
app.post('/api/books', upload, async (req, res) => {
    const book = new Book({
        id: req.body.id,
        title: req.body.title,
        author: req.body.author,
        price: req.body.price,
        thumbnail: `/uploads/${req.file.filename}`,
        description: req.body.description,
        genre: req.body.genre,
        quality: req.body.quality,
        pageCount: req.body.pageCount,
        giamgia: req.body.giamgia,
    });

    try {
        const newBook = await book.save();
        res.status(201).json(newBook);
    } catch (err) {
        console.error("Lỗi khi thêm sách:", err);
        res.status(400).json({ message: err.message });
    }
});

// 📌 API cập nhật sách
app.put('/api/books/:id', upload, async (req, res) => {
    try {
        const book = await Book.findOne({ id: req.params.id });
        if (!book) return res.status(404).json({ message: "Không tìm thấy sách" });

        if (req.body.title) book.title = req.body.title;
        if (req.body.author) book.author = req.body.author;
        if (req.body.price) book.price = req.body.price;
        if (req.file) book.thumbnail = `/uploads/${req.file.filename}`;
        if (req.body.description) book.description = req.body.description;
        if (req.body.genre) book.genre = req.body.genre;
        if (req.body.quality) book.quality = req.body.quality;
        if (req.body.pageCount) book.pageCount = req.body.pageCount;
        if (req.body.giamgia) book.giamgia = req.body.giamgia;

        const updatedBook = await book.save();
        res.json(updatedBook);
    } catch (err) {
        console.error("Lỗi khi cập nhật sách:", err);
        res.status(400).json({ message: err.message });
    }
});

// 📌 API xóa sách
app.delete('/api/books/:id', async (req, res) => {
    try {
        await Book.deleteOne({ id: req.params.id });
        res.json({ message: 'Book deleted' });
    } catch (err) {
        console.error("Lỗi khi xóa sách:", err);
        res.status(500).json({ message: err.message });
    }
});

// Khởi động server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
