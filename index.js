const jsonServer = require("json-server"); // importing json-server library
const server = jsonServer.create();
const router = jsonServer.router("db.json");
const middlewares = jsonServer.defaults();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt'); // ✅ Secure Password Hashing

const app = express();
const port = 4000;

server.use(middlewares);
server.use(router);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public1')); // ✅ Serve CSS, images, etc.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Session Setup
app.use(session({
    secret: 'secretKey123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 1000 * 60 * 30 }
}));

const usersFilePath = path.join(__dirname, 'users.json');
const paymentsFilePath = path.join(__dirname, 'payments.json');

// ✅ Load Users from `users.json`
function loadUsers() {
    if (!fs.existsSync(usersFilePath)) return [];
    const data = fs.readFileSync(usersFilePath);
    return JSON.parse(data);
}

// ✅ Save Users to `users.json`
function saveUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

function loadPayments() {
    if (!fs.existsSync(paymentsFilePath)) return {};
    return JSON.parse(fs.readFileSync(paymentsFilePath));
}

function savePayments(payments) {
    fs.writeFileSync(paymentsFilePath, JSON.stringify(payments, null, 2));
}

// ✅ Middleware: Make `user` Available in All Views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// ✅ Home Page Route
app.get('/', (req, res) => {
    res.render('home', { user: req.session.user || null });
});

// ✅ About Page Route
app.get('/about', (req, res) => {
    res.render('about', { user: req.session.user || null });
});

// ✅ Contact Page Route
app.get('/contact', (req, res) => {
    res.render('contact', { user: req.session.user || null });
});

// ✅ Handle Contact Form Submission
app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    console.log(`New Contact Form Submission:
        Name: ${name}
        Email: ${email}
        Message: ${message}
    `);
    res.send("<h2>Thank you! Your message has been received.</h2> <a href='/'>Go Back</a>");
});

// ✅ Show Login & Signup Page Dynamically
app.get('/login', (req, res) => {
    res.render('register', { user: req.session.user || null, showSignup: false });
});

app.get('/register', (req, res) => {
    res.render('register', { user: req.session.user || null, showSignup: true });
});

// ✅ Signup Route (With Secure Password Hashing)
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required." });
    }

    let users = loadUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: "Username already taken!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10); // ✅ Hash Password
    users.push({ username, password: hashedPassword });
    saveUsers(users); // ✅ Save User to JSON File

    req.session.user = username;
    res.json({ success: true, redirect: "/" });
});

// ✅ Login Route (With Secure Password Verification)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    let users = loadUsers();
    const user = users.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    req.session.user = username;
    res.json({ success: true, redirect: "/" });
});

// ✅ Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Logout failed. Try again." });
        }
        res.redirect('/');
    });
});

app.get('/bill', (req, res) => {
    if (!req.session.user) return res.redirect('/login'); // ✅ Redirect if not logged in
    res.render('bill', { user: req.session.user });
});

app.get('/tax', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('tax', { user: req.session.user });
});

app.get('/phone', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('phone', { user: req.session.user });
});

app.get('/electricity', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('electricity', { user: req.session.user });
});

app.post('/pay/:billType', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "User not logged in" });
    }

    const username = req.session.user;
    const billType = req.params.billType;
    let { amount, taxType } = req.body; // taxType is optional (for tax payments)
    const timestamp = new Date();

    // Ensure amount is a valid number
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    let payments = loadPayments();
    if (!payments[username]) {
        payments[username] = [];
    }

    // ✅ Properly Format Tax Type (e.g., "Income Tax" instead of "Tax (income)")
    let paymentType = billType;
    if (taxType) {
        paymentType = `${taxType.charAt(0).toUpperCase() + taxType.slice(1)} Tax`; // Capitalize first letter
    }

    const paymentRecord = {
        type: paymentType,
        amount,
        date: timestamp.toLocaleDateString(),
        time: timestamp.toLocaleTimeString()
    };

    payments[username].push(paymentRecord);
    savePayments(payments);

    res.json({ message: `${username} paid ₹${amount} for ${paymentType}`, payments: payments[username] });
});

// ✅ Payment History Route
app.get('/history', (req, res) => {
    if (!req.session.user) return res.redirect('/login');

    let payments = loadPayments();
    const userPayments = payments[req.session.user] || [];

    res.render('history', { payments: userPayments });
});

// ✅ Start Server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});