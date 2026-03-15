import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import pgSession from "connect-pg-simple";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import Tesseract from "tesseract.js";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import PDFDocument from "pdfkit";
import { WebSocketServer } from "ws";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
dotenv.config();
const { Pool } = pkg;

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= BASIC MIDDLEWARE ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.use(cors({
  origin: true,
  credentials: true
}));
/* ================= FILE UPLOAD ================= */
const uploadDir = path.join(__dirname, "public/uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }
});

/* ================= DATABASE ================= */
const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: process.env.DB_PASSWORD,
  database: "expense_analyzer"
});

/* ================= SESSIONS ================= */
const PgSession = pgSession(session);

app.use(
  session({
    store: new PgSession({ pool, tableName: "user_sessions" }),
    name: "expense.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30
    }
  })
);

/* ================= AUTH ================= */
function auth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

/* ================= PROFILE ================= */
/* ================= USER ================= */
app.get("/api/user", auth, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT name FROM users WHERE id = $1",
      [req.session.userId]
    );

    if (!r.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ name: r.rows[0].name });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});
app.get("/api/balance", auth, async (req, res) => {
  const r = await pool.query(
    "SELECT starting_balance FROM users WHERE id=$1",
    [req.session.userId]
  );

  res.json({
    startingBalance: Number(r.rows[0].starting_balance)
  });
});
/* ================= CURRENT BALANCE ================= */
app.get("/api/balance/current", auth, async (req,res)=>{

  const balanceResult = await pool.query(
    "SELECT starting_balance FROM users WHERE id=$1",
    [req.session.userId]
  );

  const expenseResult = await pool.query(
    "SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE user_id=$1",
    [req.session.userId]
  );

  const starting = Number(balanceResult.rows[0].starting_balance);
  const spent = Number(expenseResult.rows[0].total);

  res.json({
    startingBalance: starting,
    spent: spent,
    currentBalance: starting - spent
  });

});
app.post("/api/balance", auth, async (req, res) => {
  const { startingBalance } = req.body;

  if (startingBalance == null) {
    return res.status(400).json({ error: "Missing balance" });
  }

  await pool.query(
    "UPDATE users SET starting_balance=$1 WHERE id=$2",
    [startingBalance, req.session.userId]
  );

  res.json({ success: true });
});

/* ================= PROFILE ================= */

// Update avatar
app.post("/api/profile", auth, upload.single("avatar"), async (req, res) => {
  try {
    const avatarPath = `/uploads/${req.file.filename}`;

    await pool.query(
      "UPDATE users SET avatar = $1 WHERE id = $2",
      [avatarPath, req.session.userId]
    );

    res.json({ avatar: avatarPath });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});
/* UPDATE PROFILE */
app.get("/api/profile", auth, async (req, res) => {
  try {

    const r = await pool.query(
      `
      SELECT
        id,
        username,
        email,
        currency,
        timezone,
        avatar,
        account_id,
        created_at,
        last_login
      FROM users
      WHERE id = $1
      `,
      [req.session.userId]
    );

    if (!r.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = r.rows[0];

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      currency: user.currency,
      timezone: user.timezone,
      avatar: user.avatar,

      accountId: user.account_id,
      createdAt: user.created_at,
      lastLogin: user.last_login
    });

  } catch (err) {

    console.error("PROFILE ERROR:", err);

    res.status(500).json({
      error: "Profile fetch failed"
    });

  }
});

/* DELETE ACCOUNT */
app.delete("/api/profile", auth, async (req,res)=>{

await pool.query(
"DELETE FROM users WHERE id=$1",
[req.session.userId]
);

req.session.destroy(()=>{

res.json({success:true});

});

});
/* ================= UPDATE PROFILE INFO ================= */
app.post("/api/profile/update", auth, async (req, res) => {
  try {

    const { username, email, currency, timezone } = req.body;

    if (!username || username.length < 3) {
      return res.status(400).json({
        error: "Username must be at least 3 characters"
      });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        error: "Invalid email"
      });
    }

    await pool.query(
      `
      UPDATE users
      SET
        username = $1,
        email = $2,
        currency = $3,
        timezone = $4
      WHERE id = $5
      `,
      [
        username,
        email,
        currency,
        timezone,
        req.session.userId
      ]
    );

    res.json({ success: true });

  } catch (err) {

    console.error("Profile update error:", err);

    res.status(500).json({
      error: "Profile update failed"
    });

  }
});
/* ================= GOALS ================= */
app.get("/api/goal", auth, async (req, res) => {
  try {
    const r = await pool.query(
      `
      SELECT
        id,
        title,
        target_amount AS "targetAmount",
        due_date AS "dueDate"
      FROM goals
      WHERE user_id = $1::uuid
      ORDER BY due_date ASC
      `,
      [req.session.userId]
    );

    res.json(r.rows);
  } catch (err) {
    console.error("Goal fetch failed:", err);
    res.status(500).json({ error: "Goal fetch failed" });
  }
});

app.post("/api/goal", auth, async (req, res) => {
  const { title, targetAmount, dueDate } = req.body;

  if (!title || !targetAmount || !dueDate) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const r = await pool.query(
      `
      INSERT INTO goals (user_id, title, target_amount, due_date)
      VALUES ($1::uuid, $2, $3, $4)
      RETURNING id, title,
                target_amount AS "targetAmount",
                due_date AS "dueDate"
      `,
      [req.session.userId, title, targetAmount, dueDate]
    );

    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("Add goal failed:", err);
    res.status(500).json({ error: "Failed to add goal" });
  }
});

app.delete("/api/goal/:id", auth, async (req, res) => {

  try {

    await pool.query(
      "DELETE FROM goals WHERE id = $1::uuid AND user_id = $2::uuid",
      [req.params.id, req.session.userId]
    );

    res.json({ success: true });

  }
  catch (err) {

    console.error("Goal delete failed:", err);

    res.status(500).json({
      error: "Goal delete failed"
    });

  }

});
/* ================= ROOT ================= */
app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard.html");
  res.redirect("/login.html");
});

/* ================= AUTH ================= */
app.post("/api/login", async (req, res) => {

  try {

    const { mobile, password } = req.body;

    const r = await pool.query(
      "SELECT id, password_hash FROM users WHERE phone=$1",
      [mobile]
    );

    if (!r.rows.length)
      return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(
      password,
      r.rows[0].password_hash
    );

    if (!ok)
      return res.status(401).json({ error: "Invalid credentials" });

    req.session.userId = r.rows[0].id;

    await pool.query(
      "UPDATE users SET last_login = NOW() WHERE id=$1",
      [r.rows[0].id]
    );

    res.json({ success: true });

  }
  catch (err) {

    console.error("Login error:", err);

    res.status(500).json({
      error: "Login failed"
    });

  }

});
/* ================= REGISTER ================= */
app.post("/api/register", async (req, res) => {

  try {

    const { name, mobile, password } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({
        error: "All fields required"
      });
    }

    // check if mobile exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE phone=$1",
      [mobile]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: "Mobile already registered"
      });
    }

    // hash password
    const hash = await bcrypt.hash(password, 10);

    // generate account id
    const accountId = "ACC" + Date.now();

    // insert user
    await pool.query(
      `
      INSERT INTO users
      (username, phone, password_hash, account_id, starting_balance)
      VALUES ($1,$2,$3,$4,0)
      `,
      [name, mobile, hash, accountId]
    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error("Register error:", err);

    res.status(500).json({
      error: "Registration failed"
    });

  }

});
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("expense.sid");
    res.json({ success: true });
  });
});


/* ================= EXPENSES ================= */
app.get("/api/expenses", auth, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id, amount, expense_date AS date, merchant, category FROM expenses WHERE user_id=$1 ORDER BY expense_date DESC",
      [req.session.userId]
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.post("/api/expenses", auth, async (req, res) => {
  const { amount, date, merchant, category } = req.body;
  try {
    const r = await pool.query(
      "INSERT INTO expenses (user_id, amount, expense_date, merchant, category) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [req.session.userId, amount, date || null, merchant || null, category || "Other"]
    );
    res.status(201).json(r.rows[0]);
  } catch {
    res.status(500).json({ error: "Manual entry failed" });
  }
});
/* ================= CLEAR ALL EXPENSES ================= */
app.delete("/api/expenses", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM expenses WHERE user_id = $1",
      [req.session.userId]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear expenses" });
  }
});


/* ================= PDF TEXT EXTRACTION ================= */
async function extractTextWithPdfJS(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjs.getDocument({ data }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(i => i.str).join(" ") + "\n";
  }
  return text;
}

/* ================= BANK UPLOAD ================= */
app.post("/api/bank/upload", auth, upload.single("statement"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = req.file.path;
  let text = "";

  try {
    text = await extractTextWithPdfJS(filePath);

    if (text.trim().length < 50) {
      const ocr = await Tesseract.recognize(filePath, "eng");
      text = ocr.data.text || "";
    }
    const transactions = parseBankText(text);

    if (!transactions.length) {
      fs.unlinkSync(filePath);
      return res.status(422).json({ error: "No transactions found" });
    }

    for (const t of transactions) {
      await pool.query(
        "INSERT INTO expenses (user_id, amount, expense_date, merchant, category, source) VALUES ($1,$2,$3,$4,$5,'bank_pdf')",
        [req.session.userId, t.amount, t.date, t.merchant, t.category]
      );
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, imported: transactions.length });

  } catch (err) {
    console.error(err);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: "PDF processing failed" });
  }
});

/* ================= PARSER ================= */
function parseBankText(text) {
  const transactions = [];

  // Normalize whitespace (pdfjs merges lines randomly)
  const clean = text.replace(/\s+/g, " ");

  // Pattern for Navi / SBI UPI statements
  const pattern =
    /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM)).{0,120}?paid to\s+([A-Za-z0-9 &.-]{3,}).{0,120}?₹\s*([\d,]+)/gi;

  let match;
  while ((match = pattern.exec(clean)) !== null) {
    const date = new Date(`${match[1]} ${match[2]}`);
    const merchant = match[3].trim();
    const amount = Number(match[4].replace(/,/g, ""));

    if (isNaN(date) || !amount || !merchant) continue;

    transactions.push({
      date,
      merchant,
      amount,
      category: autoCategory(merchant)
    });
  }

  return transactions;
}
/* ================= AUTO-CATEGORIZATION ================= */
function autoCategory(merchantRaw) {

  if (!merchantRaw) return "Other";

  const m = merchantRaw.toLowerCase();

  /* ================= CLEAN NAME ================= */

  const merchant = merchantRaw
    .replace(/\bupi\b.*$/i, "")
    .replace(/\btxn\b.*$/i, "")
    .replace(/\bid\b.*$/i, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .toLowerCase();

  const words = merchant.split(/\s+/);


  /* ================= FOOD ================= */

  const foodKeywords = [
    "hotel","restaurant","cafe","coffee","bakery",
    "juice","tea","snacks","mess","canteen","kitchen",
    "burger","pizza","shawarma","shawayi","grill",
    "dosa","idly","idli","vada","parotta","biryani",
    "tiffin","bhavan","darshini","udupi",
    "ice cream","dessert","shake","smoothie",
    "food","meals","curry","Amul","milk","dairy","sweets","mithai","panipuri","golgappa","chaats"
  ];

  if (foodKeywords.some(k => m.includes(k)))
    return "Food";


  /* ================= FUEL ================= */

  const fuelKeywords = [
    "fuel","fuels","petrol","diesel",
    "hpcl","bpcl","iocl",
    "indian oil","bharat petroleum"
  ];

  if (fuelKeywords.some(k => m.includes(k)))
    return "Fuel";


  /* ================= SHOPPING ================= */

  const shoppingKeywords = [
    "amazon","flipkart","myntra","meesho",
    "store","mart","supermarket","mall",
    "provision","retail","shop"
  ];

  if (shoppingKeywords.some(k => m.includes(k)))
    return "Shopping";


  /* ================= TRAVEL ================= */

  const travelKeywords = [
    "uber","ola","rapido",
    "metro","bus","train","rail",
    "bmrcl","transport"
  ];

  if (travelKeywords.some(k => m.includes(k)))
    return "Travel";


  /* ================= BILLS ================= */

  const billsKeywords = [
    "electricity","water","bill",
    "recharge","mobile","broadband",
    "wifi","internet",
    "jio","airtel","vi","bsnl",
    "tataplay","dth"
  ];

  if (billsKeywords.some(k => m.includes(k)))
    return "Bills";


  /* ================= ENTERTAINMENT ================= */

  const entertainmentKeywords = [
    "netflix","spotify","prime",
    "hotstar","sonyliv","zee5",
    "bookmyshow","movie","cinema",
    "theatre","game"
  ];

  if (entertainmentKeywords.some(k => m.includes(k)))
    return "Entertainment";


  /* ================= HEALTHCARE ================= */

  const healthcareKeywords = [
    "hospital","clinic","medical",
    "pharmacy","apollo","doctor",
    "health","lab"
  ];

  if (healthcareKeywords.some(k => m.includes(k)))
    return "Healthcare";


  /* ================= EDUCATION ================= */

  const educationKeywords = [
    "school","college","university",
    "academy","course","udemy",
    "byju","tuition","institute"
  ];

  if (educationKeywords.some(k => m.includes(k)))
    return "Education";


  /* ================= BUSINESS WORDS ================= */

  const businessWords = [
    "enterprises","enterprise",
    "services","limited","ltd",
    "corporation","corp","company",
    "agency","traders","trading",
    "industries","industry",
    "center","centre","club","park"
  ];

  if (businessWords.some(k => merchant.includes(k)))
    return "Other";


  /* ================= PERSONAL ================= */

  const isHumanName =
    (words.length === 2 || words.length === 3) &&
    words.every(w =>
      w.length >= 3 &&
      w.length <= 15 &&
      /^[a-z]+$/.test(w)
    );

  if (isHumanName)
    return "Personal";


  /* ================= DEFAULT ================= */

  return "Other";

}

/* ================= NOTES ================= */

// Get all notes
app.get("/api/notes", auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, text, created_at, reminder_at, reminded
       FROM notes
       WHERE user_id=$1
       ORDER BY created_at DESC`,
      [req.session.userId]
    );
    res.json(r.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});


// Add note
app.post("/api/notes", auth, async (req, res) => {
  const { text, reminder_at } = req.body;
  if (!text) return res.status(400).json({ error: "Text required" });

  try {
    const r = await pool.query(
      `INSERT INTO notes (user_id, text, reminder_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.session.userId, text, reminder_at || null]
    );

const note = r.rows[0];

scheduleReminder({
  user_id: req.session.userId,
  text: note.text,
  reminder_at: note.reminder_at
});

res.status(201).json(note);

  } catch {
    res.status(500).json({ error: "Failed to add note" });
  }
});


// Delete note
app.delete("/api/notes/:id", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM notes WHERE id=$1 AND user_id=$2",
      [req.params.id, req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete note" });
  }
});
// Update reminder time
app.patch("/api/notes/:id/reminder", auth, async (req, res) => {

  const { id } = req.params;
  const { reminder_at } = req.body;

  if (!reminder_at) {
    return res.status(400).json({
      error: "reminder_at required"
    });
  }

  try{

    const r = await pool.query(

      `UPDATE notes
       SET reminder_at = $1, reminded = false
       WHERE id = $2 AND user_id = $3
       RETURNING *`,

      [reminder_at, id, req.session.userId]

    );

    const note = r.rows[0];

    if(!note){
      return res.status(404).json({
        error:"Note not found"
      });
    }

    /* CRITICAL: schedule reminder */
    scheduleReminder({
      user_id: req.session.userId,
      text: note.text,
      reminder_at: note.reminder_at
    });

    res.json({
      success:true
    });

  }
  catch(err){

    console.error("Reminder update failed",err);

    res.status(500).json({
      error:"Reminder update failed"
    });

  }

});


// Mark reminder as fired
app.patch("/api/notes/:id/reminded", auth, async (req, res) => {
  const { id } = req.params;

  await pool.query(
    `UPDATE notes
     SET reminded = true
     WHERE id = $1 AND user_id = $2`,
    [id, req.session.userId]
  );

  res.json({ success: true });
});


/* ================= CHANGE PASSWORD ================= */
app.post("/api/profile/password", auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const r = await pool.query(
      "SELECT password_hash FROM users WHERE id=$1",
      [req.session.userId]
    );

    if (!r.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const ok = await bcrypt.compare(oldPassword, r.rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password_hash=$1 WHERE id=$2",
      [hash, req.session.userId]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Password update failed" });
  }
  if(newPassword.length < 8){
  return res.status(400).json({
    error:"Password must be at least 8 characters"
  });
}
});
/* ================= CLEAR ALL NOTES ================= */
app.delete("/api/notes", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM notes WHERE user_id=$1",
      [req.session.userId]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear notes" });
  }
});
/* ================= LOGOUT ALL SESSIONS ================= */
app.post("/api/logout-all", auth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM user_sessions WHERE sess->>'userId' = $1",
      [String(req.session.userId)]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Logout all failed" });
  }
});
/* ================= EXPORT USER DATA ================= */
app.get("/api/export", auth, async (req, res) => {

try {

const expensesResult = await pool.query(
`SELECT amount, category, merchant, expense_date
 FROM expenses
 WHERE user_id=$1
 ORDER BY expense_date ASC`,
[req.session.userId]
);

const balanceResult = await pool.query(
`SELECT starting_balance FROM users WHERE id=$1`,
[req.session.userId]
);

const expenses = expensesResult.rows;
const startingBalance = Number(balanceResult.rows[0].starting_balance);

/* ================= SUMMARY ================= */

let total = 0;
let categoryTotals = {};
let monthlyTotals = {};

expenses.forEach(e => {

const amount = Number(e.amount);
total += amount;

categoryTotals[e.category] =
(categoryTotals[e.category] || 0) + amount;

const month =
new Date(e.expense_date)
.toLocaleString("default",{month:"short",year:"numeric"});

monthlyTotals[month] =
(monthlyTotals[month] || 0) + amount;

});

const savingsRate =
startingBalance > 0
? ((startingBalance - total) / startingBalance) * 100
: 0;

/* ================= AI INSIGHTS ================= */

let highestCategory = null;
let highestAmount = 0;

Object.entries(categoryTotals)
.forEach(([cat, amt]) => {

if(amt > highestAmount){
highestAmount = amt;
highestCategory = cat;
}

});

const avg =
expenses.length
? total / expenses.length
: 0;

let insights = [];

if(savingsRate < 20)
insights.push("Savings rate is LOW. Reduce spending.");

if(highestCategory)
insights.push(
"Highest spending category is " +
highestCategory
);

if(total > startingBalance * 0.7)
insights.push("Spending exceeds 70% of balance.");

if(insights.length === 0)
insights.push("Financial health is GOOD.");

/* ================= CREATE CHARTS ================= */

const width = 600;
const height = 300;

const chartCanvas =
new ChartJSNodeCanvas({
width,
height,
backgroundColour:"#ffffff"
});

/* CATEGORY PIE CHART */

const pieConfig = {
type:"pie",
data:{
labels:Object.keys(categoryTotals),
datasets:[{
data:Object.values(categoryTotals)
}]
}
};

const pieImage =
await chartCanvas.renderToBuffer(pieConfig);

/* MONTHLY BAR CHART */

const barConfig = {
type:"bar",
data:{
labels:Object.keys(monthlyTotals),
datasets:[{
label:"Monthly Spending",
data:Object.values(monthlyTotals)
}]
}
};

const barImage =
await chartCanvas.renderToBuffer(barConfig);

/* ================= CREATE PDF ================= */

const doc = new PDFDocument({
margin:40
});

res.setHeader(
"Content-Type",
"application/pdf"
);

res.setHeader(
"Content-Disposition",
"attachment; filename=financial-report.pdf"
);

doc.pipe(res);

/* TITLE */

doc
.fontSize(22)
.text("AI Financial Report", { align:"center" });

doc.moveDown();

/* SUMMARY */

doc
.fontSize(16)
.text("Summary", { underline:true });

doc.moveDown();

doc.fontSize(12);

doc.text("Starting balance: ₹" + startingBalance);
doc.text("Total spent: ₹" + total.toFixed(2));
doc.text("Savings rate: " + savingsRate.toFixed(1) + "%");
doc.text("Total transactions: " + expenses.length);
doc.text("Average transaction: ₹" + avg.toFixed(2));

doc.moveDown();

/* AI INSIGHTS */

doc
.fontSize(16)
.text("AI Insights", { underline:true });

doc.moveDown();

insights.forEach(i =>
doc.fontSize(12).text("• " + i)
);

doc.moveDown();

/* CATEGORY CHART */

doc
.fontSize(16)
.text("Category Breakdown", { underline:true });

doc.moveDown();

doc.image(pieImage, {
fit:[500,250],
align:"center"
});

doc.moveDown();

/* MONTHLY CHART */

doc
.fontSize(16)
.text("Monthly Comparison", { underline:true });

doc.moveDown();

doc.image(barImage,{
fit:[500,250],
align:"center"
});

doc.moveDown();

/* TRANSACTIONS */

doc
.fontSize(16)
.text("Transactions", { underline:true });

doc.moveDown();

expenses.reverse().forEach(e => {

doc.fontSize(10).text(
`${new Date(e.expense_date).toLocaleDateString()}
 | ₹${e.amount}
 | ${e.category}
 | ${e.merchant || ""}`
);

});

/* FINISH */

doc.end();

}
catch(err){

console.error(err);

res.status(500).json({
error:"Export failed"
});

}

});
/* ================= CHAT PARSER ================= */
function parseExpenseFromChat(message){

  const regex =
  /(spent|paid|pay|bought)?\s*₹?(\d+)\s*(on|for)?\s*([a-zA-Z\s]+)?/i;

  const match = message.match(regex);

  if(!match) return null;

  return {

    amount: Number(match[2]),

    merchant: match[4] || "Chat entry",

    category: autoCategory(match[4] || "")

  };
}

/* ================= AI EXPENSE ANALYSIS ================= */
app.post("/api/chat", auth, async (req, res) => {
  try {

    const { message } = req.body;
    const expenseData = parseExpenseFromChat(message);

if(expenseData){

  await pool.query(

    `INSERT INTO expenses
     (user_id, amount, merchant, category, expense_date)
     VALUES ($1,$2,$3,$4,NOW())`,

    [
      req.session.userId,
      expenseData.amount,
      expenseData.merchant,
      expenseData.category
    ]
  );

  return res.json({

    reply:
    `Expense added: ₹${expenseData.amount} (${expenseData.category})`

  });

}
// Save user message
await pool.query(
  `INSERT INTO chat_history (user_id, sender, message)
   VALUES ($1,$2,$3)`,
  [req.session.userId, "user", message]
);
    const msg = message.toLowerCase();
    if(msg.includes("advice")){

  const advice =
  await generateFinancialAdvice(req.session.userId);

  return res.json({

    reply:
    "<b>Financial Advice:</b><br>" +
    advice.join("<br>")

  });

}
// ================= MONTH COMPARISON FEATURE =================
if (
  msg.includes("compare") &&
  msg.includes("month")
) {

  const thisMonthResult = await pool.query(
    `
    SELECT COALESCE(SUM(amount),0) AS total
    FROM expenses
    WHERE user_id=$1
    AND date_trunc('month', expense_date) =
        date_trunc('month', CURRENT_DATE)
    `,
    [req.session.userId]
  );

  const prevMonthResult = await pool.query(
    `
    SELECT COALESCE(SUM(amount),0) AS total
    FROM expenses
    WHERE user_id=$1
    AND date_trunc('month', expense_date) =
        date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
    `,
    [req.session.userId]
  );

  const thisMonth =
    Number(thisMonthResult.rows[0].total);

  const prevMonth =
    Number(prevMonthResult.rows[0].total);

  const diff = thisMonth - prevMonth;

  const percent =
    prevMonth > 0
      ? ((diff / prevMonth) * 100).toFixed(1)
      : 0;

  let trend =
    diff > 0
      ? `increase`
      : diff < 0
      ? `decrease`
      : `no change`;

  return res.json({
    reply:
    `<b>Monthly Expense Comparison</b><br><br>
     This month: ₹${thisMonth.toFixed(0)}<br>
     Previous month: ₹${prevMonth.toFixed(0)}<br>
     Change: ₹${Math.abs(diff).toFixed(0)}
     (${percent}% ${trend})`
  });

}
// ================= THIS MONTH SPENDING FEATURE =================
if (
  msg.includes("this month") &&
  (
    msg.includes("spent") ||
    msg.includes("spend") ||
    msg.includes("expense") ||
    msg.includes("spending")
  )
) {

  const result = await pool.query(
    `
    SELECT COALESCE(SUM(amount),0) AS total
    FROM expenses
    WHERE user_id=$1
    AND date_trunc('month', expense_date) =
        date_trunc('month', CURRENT_DATE)
    `,
    [req.session.userId]
  );

  const total =
    Number(result.rows[0].total);

  return res.json({
    reply:
    `<b>This Month Spending:</b><br><br>
     You spent ₹${total.toFixed(0)} this month.`
  });

}
// ================= FULL BUDGET ANALYSIS FEATURE =================
if (
  msg.includes("budget") ||
  msg.includes("overspending") ||
  msg.includes("spending safe") ||
  msg.includes("check my budget") ||
  msg.includes("improve my savings") ||
  msg.includes("where do i spend") ||
  msg.includes("most money")
) {

  // Get balance
  const balRes = await pool.query(
    "SELECT starting_balance FROM users WHERE id=$1",
    [req.session.userId]
  );

  const balance =
    Number(balRes.rows[0].starting_balance);

  // Get this month expenses
  const expRes = await pool.query(
    `
    SELECT category, SUM(amount) total
    FROM expenses
    WHERE user_id=$1
    AND date_trunc('month', expense_date) =
        date_trunc('month', CURRENT_DATE)
    GROUP BY category
    ORDER BY total DESC
    `,
    [req.session.userId]
  );

  let totalSpent = 0;
  let highestCategory = "None";
  let highestAmount = 0;

  for (const row of expRes.rows) {

    const amt = Number(row.total);

    totalSpent += amt;

    if (amt > highestAmount) {
      highestAmount = amt;
      highestCategory = row.category;
    }

  }

  const remaining = balance - totalSpent;

  const usagePercent =
    balance > 0
      ? ((totalSpent / balance) * 100).toFixed(1)
      : 0;

  let status;

  if (usagePercent >= 90)
    status = "🚨 Critical overspending";
  else if (usagePercent >= 70)
    status = "⚠ Warning: High spending";
  else
    status = "✅ Spending is safe";

  let advice = [];

  if (highestCategory !== "None")
    advice.push(`Reduce spending on ${highestCategory}`);

  advice.push(`Keep spending below ₹${(balance*0.7).toFixed(0)}`);
  advice.push(`Save at least ₹${(balance*0.2).toFixed(0)} monthly`);
  advice.push(`Track daily expenses`);
  advice.push(`Avoid unnecessary purchases`);

  return res.json({

    reply:
    `<b>Budget Analysis Report</b><br><br>

     Balance: ₹${balance.toFixed(0)}<br>
     Spent this month: ₹${totalSpent.toFixed(0)}<br>
     Remaining: ₹${remaining.toFixed(0)}<br>
     Usage: ${usagePercent}%<br>
     Status: ${status}<br><br>

     <b>Highest spending category:</b><br>
     ${highestCategory} (₹${highestAmount.toFixed(0)})<br><br>

     <b>How to improve savings:</b><br>
     ${advice.map(a=>"• "+a).join("<br>")}

    `

  });

}

    // detect analysis intent
    const wantsAnalysis =
      msg.includes("analyze") ||
      msg.includes("analysis") ||
      msg.includes("my expenses") ||
      msg.includes("show expenses") ||
      msg.includes("expense report");

    // ================= NORMAL CHATBOT =================
// ================= SMART QUESTIONS =================
if (!wantsAnalysis) {

  // load last 30 days expenses
  const r = await pool.query(
    `SELECT amount, category, expense_date
     FROM expenses
     WHERE user_id=$1
     AND expense_date >= NOW() - INTERVAL '30 days'`,
    [req.session.userId]
  );

  const expenses = r.rows;

  if (!expenses.length) {
    return res.json({
      reply: "No expense data available."
    });
  }

  let total = 0;
  let categoryTotals = {};

  for (const e of expenses) {
    const amount = Number(e.amount);
    total += amount;

    categoryTotals[e.category] =
      (categoryTotals[e.category] || 0) + amount;
  }
// ================= BUILD ANALYTICS =================

let amounts = expenses.map(e => Number(e.amount));

let avgTransaction =
  amounts.reduce((a,b)=>a+b,0) / amounts.length;


// ================= BUDGET WARNING =================
if (msg.includes("budget")) {

  const bal = await pool.query(
    "SELECT starting_balance FROM users WHERE id=$1",
    [req.session.userId]
  );

  const startingBalance = Number(bal.rows[0].starting_balance);

  if (total > startingBalance * 0.7)
    return res.json({
      reply: `⚠ Budget warning: You spent ₹${total.toFixed(0)} which exceeds 70% of your balance.`
    });

  return res.json({
    reply: `Your spending ₹${total.toFixed(0)} is within safe limits.`
  });
}


// ================= UNUSUAL SPENDING =================
if (msg.includes("unusual") || msg.includes("spike")) {

  let spikes = amounts.filter(a => a > avgTransaction * 2);

  if (!spikes.length)
    return res.json({
      reply: "No unusual spending detected."
    });

  return res.json({
    reply:
      `Detected ${spikes.length} unusual transactions above ₹${(avgTransaction*2).toFixed(0)}`
  });
}


// ================= SMART SAVINGS ADVICE =================
if (
  msg.includes("save") ||
  msg.includes("saving") ||
  msg.includes("advice")
){

  const result =
    await generateSmartSavingsAdvice(
      req.session.userId
    );

  return res.json({

    reply:
    `<b>AI Smart Savings Advice</b><br><br>

    Balance: ₹${result.balance.toFixed(0)}<br>
    Total spent: ₹${result.totalSpent.toFixed(0)}<br>
    Current balance: ₹${result.currentBalance.toFixed(0)}<br>
    Savings rate: ${result.savingsRate.toFixed(1)}%<br><br>

    Highest category: ${result.highestCategory}<br>
    Target savings: ₹${result.savingsTarget.toFixed(0)}<br><br>

    <b>Action Plan:</b><br>
    ${result.advice.map(a=>"• "+a).join("<br>")}

    `

  });

}

// ================= BALANCE PREDICTION =================
if (msg.includes("balance")) {

  const result = await pool.query(
    `
    SELECT 
      u.starting_balance,
      COALESCE(SUM(e.amount),0) AS spent
    FROM users u
    LEFT JOIN expenses e
    ON e.user_id = u.id
    WHERE u.id = $1
    GROUP BY u.starting_balance
    `,
    [req.session.userId]
  );

  const starting = Number(result.rows[0].starting_balance);
  const spent = Number(result.rows[0].spent);

  const currentBalance = starting - spent;

  return res.json({
    reply:
      `<b>Current Balance:</b> ₹${currentBalance.toFixed(0)}<br>
       Starting: ₹${starting}<br>
       Spent: ₹${spent}`
  });

}
// ================= ANOMALY =================
if (msg.includes("anomaly")) {

  let anomalies =
    amounts.filter(a => a > avgTransaction * 3);

  if (!anomalies.length)
    return res.json({
      reply: "No anomalies detected."
    });

  return res.json({
    reply:
      `${anomalies.length} anomalies detected.`
  });
}


// ================= SMART ALERT =================
if (msg.includes("alert")) {

  if (total > avgTransaction * expenses.length)
    return res.json({
      reply:
        "Alert: Spending trend increasing rapidly."
    });

  return res.json({
    reply:
      "Spending trend stable."
  });
}

  // ================= FOOD SPENDING =================
  if (msg.includes("food")) {

    const foodTotal = categoryTotals["Food"] || 0;

    return res.json({
      reply: `You spent ₹${foodTotal.toFixed(2)} on Food in the last 30 days.`
    });
  }

  // ================= HIGHEST CATEGORY =================
  if (msg.includes("highest") || msg.includes("most")) {

    let highestCat = null;
    let highestAmt = 0;

    for (const cat in categoryTotals) {
      if (categoryTotals[cat] > highestAmt) {
        highestAmt = categoryTotals[cat];
        highestCat = cat;
      }
    }

    return res.json({
      reply: `Your highest spending category is <b>${highestCat}</b> (₹${highestAmt.toFixed(2)}).`
    });
  }

  // ================= PREDICT NEXT MONTH =================
  if (msg.includes("predict") || msg.includes("next month")) {

    const prediction = total;

    return res.json({
      reply: `Based on current spending, next month's predicted spending is ₹${prediction.toFixed(2)}.`
    });
  }

  // ================= NORMAL CHAT =================
  if (msg.includes("hi") || msg.includes("hello")) {
    return res.json({
      reply: "Hello! Welcome to AI Financial Assistant, How can I help you today?"
    });
  }

  return res.json({
    reply: "Ask me about your expenses, predictions, or analysis."
  });
}

    // ================= EXPENSE ANALYSIS =================

    const r = await pool.query(
      `SELECT amount, category, merchant, expense_date
       FROM expenses
       WHERE user_id=$1
       AND expense_date >= NOW() - INTERVAL '30 days'
       ORDER BY expense_date DESC`,
      [req.session.userId]
    );

    const expenses = r.rows;

    if (!expenses.length) {
      return res.json({
        reply: "No recent expenses found."
      });
    }

    let total = 0;
    let categoryTotals = {};
    // ================= DAILY TOTALS =================
let dailyTotals = {};
let amounts = [];

for (const e of expenses) {

  const amount = Number(e.amount);
  const day = new Date(e.expense_date).toISOString().split("T")[0];

  amounts.push(amount);

  dailyTotals[day] = (dailyTotals[day] || 0) + amount;
}

// ================= AVERAGES =================
const avgDaily = Object.values(dailyTotals)
.reduce((a,b)=>a+b,0) / Object.keys(dailyTotals).length;

const avgTransaction = amounts.reduce((a,b)=>a+b,0) / amounts.length;


// ================= SPIKE DETECTION =================
if (msg.includes("spike") || msg.includes("unusual")) {

  let spikes = amounts.filter(a => a > avgTransaction * 2);

  if (!spikes.length)
    return res.json({ reply: "No unusual spending spikes detected." });


  return res.json({
    reply: `Detected ${spikes.length} unusual high transactions. Average is ₹${avgTransaction.toFixed(0)}, but spikes exceed ₹${(avgTransaction*2).toFixed(0)}.`
  });
}

// ================= SAVINGS PLAN =================
if (msg.includes("save") || msg.includes("saving plan")) {

  const save20 = total * 0.20;
  const save30 = total * 0.30;

  return res.json({
    reply:
    `<b>Recommended Savings Plan:</b><br><br>
    • Save 20%: ₹${save20.toFixed(0)} monthly<br>
    • Save 30%: ₹${save30.toFixed(0)} monthly<br>
    • Reduce highest category spending<br>
    • Avoid impulse purchases`
  });
}


// ================= PREDICTIVE BALANCE =================
if (msg.includes("balance prediction") || msg.includes("future balance")) {

  const bal = await pool.query(
    "SELECT starting_balance FROM users WHERE id=$1",
    [req.session.userId]
  );

  const startingBalance = Number(bal.rows[0].starting_balance);

  const predictedBalance =
    startingBalance - total;

  return res.json({
    reply: `Predicted balance next month: ₹${predictedBalance.toFixed(0)}`
  });
}


// ================= BUDGET WARNING =================
if (msg.includes("budget warning") || msg.includes("overspending")) {

  const bal = await pool.query(
    "SELECT starting_balance FROM users WHERE id=$1",
    [req.session.userId]
  );

  const startingBalance = Number(bal.rows[0].starting_balance);

  if (total > startingBalance * 0.7)
    return res.json({
      reply: "⚠ WARNING: You have used over 70% of your balance."
    });

  return res.json({
    reply: "Your spending is within safe budget limits."
  });
}


// ================= ANOMALY DETECTION =================
if (msg.includes("anomaly")) {

  let anomalies = amounts.filter(a => a > avgTransaction * 3);

  if (!anomalies.length)
    return res.json({
      reply: "No spending anomalies detected."
    });

  return res.json({
    reply: `Detected ${anomalies.length} anomalies exceeding ₹${(avgTransaction*3).toFixed(0)}`
  });
}


// ================= SMART ALERT =================
if (msg.includes("alert")) {

  if (total > avgDaily * 30)
    return res.json({
      reply: "Smart Alert: Your spending trend is increasing rapidly."
    });

  return res.json({
    reply: "Your spending pattern is stable."
  });
}

    for (const e of expenses) {
      const amount = Number(e.amount);
      total += amount;
      categoryTotals[e.category] =
        (categoryTotals[e.category] || 0) + amount;
    }

let suggestions = [];

// ================= TOTAL =================
suggestions.push(`<b>Total spent:</b> ₹${total.toFixed(2)}`);


// ================= CATEGORY BREAKDOWN =================
suggestions.push(`<b>Category breakdown:</b>`);

Object.entries(categoryTotals)
.sort((a,b)=>b[1]-a[1])
.forEach(([cat,amt])=>{
  suggestions.push(`${cat}: ₹${amt.toFixed(2)}`);
});


// ================= HIGHEST CATEGORY =================
const highest = Object.entries(categoryTotals)
.sort((a,b)=>b[1]-a[1])[0];

suggestions.push(
  `<b>Highest category:</b> ${highest[0]} (₹${highest[1].toFixed(2)})`
);


// ================= SAVINGS PLAN =================
const save20 = total * 0.2;

suggestions.push(
  `<b>Recommended savings:</b> ₹${save20.toFixed(0)} per month`
);


// ================= SPIKE DETECTION =================
let spikes = amounts.filter(a => a > avgTransaction * 2);

if (spikes.length)
  suggestions.push(
    `⚠ <b>Unusual spending:</b> ${spikes.length} high transactions`
  );
else
  suggestions.push(`No unusual spending spikes detected`);


// ================= BALANCE PREDICTION =================
const bal = await pool.query(
  "SELECT starting_balance FROM users WHERE id=$1",
  [req.session.userId]
);

const startingBalance = Number(bal.rows[0].starting_balance);

const predictedBalance =
  startingBalance - total;

suggestions.push(
  `<b>Predicted balance next month:</b> ₹${predictedBalance.toFixed(0)}`
);


// ================= BUDGET WARNING =================
if (total > startingBalance * 0.7)
  suggestions.push(`⚠ <b>Budget warning:</b> High spending`);
else
  suggestions.push(`Spending within safe budget limits`);


// ================= ANOMALY DETECTION =================
let anomalies = amounts.filter(a => a > avgTransaction * 3);

if (anomalies.length)
  suggestions.push(`⚠ <b>Anomalies detected:</b> ${anomalies.length}`);
else
  suggestions.push(`No anomalies detected`);


// ================= SMART ALERT =================
if (total > avgDaily * 30)
  suggestions.push(`⚠ <b>Spending trend increasing rapidly`);
else
  suggestions.push(`Spending trend stable`);


// ================= FINAL RESPONSE =================
return res.json({
  reply:
    `<b>Full Expense Intelligence Report:</b><br><br>` +
    suggestions.map(s=>"• "+s).join("<br>")
});

  }
  catch (err) {
    console.error(err);
    return res.status(500).json({
      reply: "Server error"
    });
  }
});
/* ================= REMINDER SCHEDULER ================= */
async function scheduleReminder(note){

  if(!note.reminder_at) return;

  const targetTime = new Date(note.reminder_at).getTime();

  const check = ()=>{

    const now = Date.now();

    if(now >= targetTime){

      const ws = clients.get(note.user_id);

      if(ws){

        ws.send(JSON.stringify({
          type:"reminder",
          text:note.text
        }));

      }

    }else{

      const nextDelay = Math.min(
        targetTime - now,
        60000 // check every 60 seconds
      );

      setTimeout(check, nextDelay);

    }

  };

  check();

}
async function generateFinancialAdvice(userId){

  const bal = await pool.query(
    "SELECT starting_balance FROM users WHERE id=$1",
    [userId]
  );

  const exp = await pool.query(
    `SELECT amount, category
     FROM expenses
     WHERE user_id=$1
     AND expense_date >= NOW() - INTERVAL '30 days'`,
    [userId]
  );

  const starting = Number(bal.rows[0].starting_balance);

  let total = 0;
  let categories = {};

  exp.rows.forEach(e=>{

    total += Number(e.amount);

    categories[e.category] =
      (categories[e.category] || 0) + Number(e.amount);

  });

  const savingsRate =
  ((starting-total)/starting)*100;

  const highest =
  Object.entries(categories)
  .sort((a,b)=>b[1]-a[1])[0];

  let advice = [];

  if(savingsRate < 20)
    advice.push("Savings rate too low");

  if(highest)
    advice.push("Reduce " + highest[0]);

  if(total > starting*0.8)
    advice.push("Overspending risk HIGH");

  if(advice.length===0)
    advice.push("Financial health GOOD");

  return advice;
}
async function generateSmartSavingsAdvice(userId){

  const balRes = await pool.query(
    "SELECT starting_balance FROM users WHERE id=$1",
    [userId]
  );

  const balance = Number(balRes.rows[0].starting_balance);

  const expRes = await pool.query(
    `
    SELECT category, SUM(amount) total
    FROM expenses
    WHERE user_id=$1
    GROUP BY category
    ORDER BY total DESC
    `,
    [userId]
  );

  let totalSpent = 0;
  let highestCategory = "None";
  let highestAmount = 0;

  for(const row of expRes.rows){

    const amt = Number(row.total);

    totalSpent += amt;

    if(amt > highestAmount){
      highestAmount = amt;
      highestCategory = row.category;
    }

  }

  const currentBalance = balance - totalSpent;

  const savingsRate =
    balance > 0
    ? (currentBalance / balance) * 100
    : 0;

  const savingsTarget = balance * 0.20;

  const dailyLimit =
    currentBalance > 0
    ? currentBalance / 30
    : 0;

  return {

    balance,
    totalSpent,
    currentBalance,
    savingsRate,
    highestCategory,
    savingsTarget,

    advice: [

      `Reduce ${highestCategory} spending`,
      `Save ₹${savingsTarget.toFixed(0)} monthly`,
      `Keep daily spending below ₹${dailyLimit.toFixed(0)}`,
      savingsRate < 20
        ? "Your savings rate is LOW. Reduce expenses"
        : "Your savings rate is GOOD",
      "Avoid impulse purchases",
      "Track daily expenses"

    ]

  };

}
// ================= CLEAR CHAT HISTORY =================
app.delete("/api/chat/history", auth, async (req,res)=>{

  try{

    await pool.query(
      "DELETE FROM chat_history WHERE user_id=$1",
      [req.session.userId]
    );

    res.json({ success:true });

  }
  catch(err){

    console.error(err);

    res.status(500).json({
      error:"Failed to clear chat history"
    });

  }

});

// ================= GET CHAT HISTORY =================
app.get("/api/chat/history", auth, async (req,res)=>{

  try{

    const r = await pool.query(
      `
      SELECT sender, message
      FROM chat_history
      WHERE user_id=$1
      ORDER BY created_at ASC
      `,
      [req.session.userId]
    );

    res.json(r.rows);

  }
  catch(err){

    res.status(500).json({
      error:"Failed to load chat history"
    });

  }

});

/* ================= START ================= */
const server = app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
server.timeout = 12000000; // 200 minutes for AI processing
/* ================= WEBSOCKET FOR REAL-TIME UPDATES ================= */

const wss = new WebSocketServer({ server });

let clients = new Map();

wss.on("connection",(ws)=>{

  ws.on("message",(msg)=>{

    try{

      const data = JSON.parse(msg);

      if(data.userId){

        clients.set(data.userId,ws);

        console.log("WebSocket connected:",data.userId);

      }

    }
    catch(err){
      console.error("WS message error",err);
    }

  });

  ws.on("close",()=>{

    clients.forEach((client,key)=>{

      if(client===ws){
        clients.delete(key);
      }

    });

  });

});
/* ================= LOAD EXISTING REMINDERS ON SERVER START ================= */

async function loadExistingReminders(){

  try{

    const r = await pool.query(
      `
      SELECT user_id, text, reminder_at
      FROM notes
      WHERE reminder_at IS NOT NULL
      AND reminded = false
      `
    );

    r.rows.forEach(note => {

      scheduleReminder(note);

    });

    console.log("Loaded reminders:", r.rows.length);

  }
  catch(err){

    console.error("Failed to load reminders:",err);

  }

}

loadExistingReminders();
