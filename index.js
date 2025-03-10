const jsonServer = require("json-server"); 
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt'); 
const FileStore = require('session-file-store')(session);

const app = express();
const port = 4000;

// ✅ Define session directory
const sessionDir = path.join(__dirname, 'sessions');
const usersFilePath = path.join(__dirname, 'users.json');
const paymentsFilePath = path.join(__dirname, 'payments.json');

// ✅ Ensure required JSON files exist
if (!fs.existsSync(usersFilePath)) fs.writeFileSync(usersFilePath, '[]');
if (!fs.existsSync(paymentsFilePath)) fs.writeFileSync(paymentsFilePath, '{}');

// ✅ Ensure `sessions` directory exists
if (!fs.existsSync(sessionDir)) {
    console.log("Creating sessions directory...");
    fs.mkdirSync(sessionDir, { recursive: true });
} else {
    console.log("Sessions directory already exists.");
}

// ✅ Set EJS as the View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public1')); 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Set up session management
app.use(session({
    store: new FileStore({ path: sessionDir, retries: 0 }),
    secret: 'secretKey123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 30 }
}));

// ✅ Middleware: Make `user` Available in All Views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// ✅ Load and Save Functions
function loadUsers() {
    return JSON.parse(fs.readFileSync(usersFilePath));
}

function saveUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

function loadPayments() {
    return JSON.parse(fs.readFileSync(paymentsFilePath));
}

function savePayments(payments) {
    fs.writeFileSync(paymentsFilePath, JSON.stringify(payments, null, 2));
}

// ✅ Routes
app.get('/', (req, res) => res.render('home', { user: req.session.user || null }));
app.get('/about', (req, res) => res.render('about', { user: req.session.user || null }));
app.get('/contact', (req, res) => res.render('contact', { user: req.session.user || null }));

app.post('/contact', (req, res) => {
    console.log(`Contact Form Submission: ${JSON.stringify(req.body)}`);
    res.send("<h2>Thank you! Your message has been received.</h2> <a href='/'>Go Back</a>");
});

app.get('/login', (req, res) => res.render('register', { user: req.session.user || null, showSignup: false }));
app.get('/register', (req, res) => res.render('register', { user: req.session.user || null, showSignup: true }));

// ✅ Signup
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Username and password are required." });

    let users = loadUsers();
    if (users.find(u => u.username === username)) return res.status(400).json({ success: false, message: "Username already taken!" });

    users.push({ username, password: await bcrypt.hash(password, 10) });
    saveUsers(users);

    req.session.user = username;
    res.json({ success: true, redirect: "/" });
});

// ✅ Login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    let users = loadUsers();
    const user = users.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: "Invalid credentials" });

    req.session.user = username;
    res.json({ success: true, redirect: "/" });
});

// ✅ Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// ✅ Bill Pages
const protectedRoutes = ['/bill', '/tax', '/phone', '/electricity'];
protectedRoutes.forEach(route => {
    app.get(route, (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        res.render(route.substring(1), { user: req.session.user });
    });
});

// ✅ Payment Handling
app.post('/pay/:billType', (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: "User not logged in" });

    const username = req.session.user;
    let { amount, taxType } = req.body;
    const billType = req.params.billType;
    const timestamp = new Date();

    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({ success: false, message: "Invalid amount" });

    let payments = loadPayments();
    if (!payments[username]) payments[username] = [];

    const paymentType = taxType ? `${taxType.charAt(0).toUpperCase() + taxType.slice(1)} Tax` : billType;
    payments[username].push({ type: paymentType, amount, date: timestamp.toLocaleDateString(), time: timestamp.toLocaleTimeString() });

    savePayments(payments);
    res.json({ message: `${username} paid ₹${amount} for ${paymentType}`, payments: payments[username] });
});

// ✅ Payment History
app.get('/history', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    let payments = loadPayments();
    res.render('history', { payments: payments[req.session.user] || [] });
});

// ✅ Start Express Server
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));

// ✅ Start JSON Server (on a different port)
const jsonPort = 5000;
const jsonServerApp = jsonServer.create();
const jsonRouter = jsonServer.router("db.json");
const jsonMiddlewares = jsonServer.defaults();

jsonServerApp.use(jsonMiddlewares);
jsonServerApp.use(jsonRouter);
jsonServerApp.listen(jsonPort, () => console.log(`JSON Server running at http://localhost:${jsonPort}`));
