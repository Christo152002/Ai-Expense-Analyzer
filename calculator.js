async function requireLogin() {
  const res = await fetch("/api/expenses", { credentials: "include" });
  if (res.status === 401) window.location.href = "/login.html";
}
requireLogin();

/* ================= DOM ELEMENTS ================= */

const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const merchantInput = document.getElementById("merchant");

const expenseList = document.getElementById("expenseList");

const bankStatus = document.getElementById("bankStatus");
const bankFileInput = document.getElementById("bankPdf");

const clearBtn = document.getElementById("clearExpensesBtn");

const quoteText = document.getElementById("quoteText");
/* ================= STATE ================= */

let expenses = [];
let startingBalance = 0;


/* ================= LOAD USER ================= */

async function loadUser() {

  try {

    const res = await fetch("/api/user", {
      credentials: "include"
    });

    if (!res.ok) throw new Error();

    const user = await res.json();

    const nameEl = document.getElementById("username");

    if (nameEl)
      nameEl.textContent = user.name + " !";

  }
  catch (err) {

    console.error("Failed to load user:", err);

  }
}

loadUser();


/* ================= BALANCE ================= */

async function loadStartingBalance() {

  try {

    const res = await fetch("/api/balance", {
      credentials: "include"
    });

    const data = await res.json();

    startingBalance =
      Number(data.startingBalance) || 0;

    const input =
      document.getElementById("startingBalanceInput");

    // ✅ reset input to zero always
    if (input) {
      input.value = 0;
      input.disabled = true;
    }
const initialEl =
  document.getElementById("initialBalanceDisplayValue");

if (initialEl)
  initialEl.textContent =
    startingBalance.toFixed(2);
    // ✅ show real balance below
    const el =
      document.getElementById("estimatedBalance");

    if (el)
      el.textContent =
        "₹" + startingBalance.toFixed(2);

  }
  catch (err) {

    console.error("Balance load failed:", err);

  }
}
/*Starting balance*/
async function saveStartingBalance() {

  const input =
    document.getElementById("startingBalanceInput");

  const value =
    Number(input.value);

  if (isNaN(value)) {
    alert("Invalid balance");
    return;
  }

  await fetch("/api/balance", {

    method: "POST",

    credentials: "include",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      startingBalance: value
    })

  });

  // store internally
  startingBalance = value;
const initialEl =
  document.getElementById("initialBalanceDisplayValue");

if (initialEl)
  initialEl.textContent =
    value.toFixed(2);
  // ✅ show value as Current Balance
  const el =
    document.getElementById("estimatedBalance");

  if (el)
updateEstimatedBalance();

  // ✅ reset input to zero
  input.value = 0;

  input.disabled = true;

  document.getElementById("editBalanceBtn").style.display = "block";
  document.getElementById("saveBalanceBtn").style.display = "none";
}
async function clearEstimatedBalance() {

  if (!confirm("Reset balance to 0?")) return;

  await fetch("/api/balance", {

    method: "POST",

    credentials: "include",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      startingBalance: 0
    })

  });

  startingBalance = 0;

  const input =
    document.getElementById("startingBalanceInput");

  if (input)
    input.value = "";
    input.placeholder = "Enter the amount to add";

  updateEstimatedBalance();
}


function enableEditBalance() {

  const input =
    document.getElementById("startingBalanceInput");

  input.disabled = false;

  document.getElementById("editBalanceBtn").style.display = "none";
  document.getElementById("saveBalanceBtn").style.display = "block";

}


/* ================= ESTIMATED BALANCE ================= */
function updateEstimatedBalance() {

  const today =
    new Date().toISOString().slice(0,10);

  const totalSpent =
    expenses
      .filter(e => e.date <= today)
      .reduce(
        (sum, e) => sum + Number(e.amount),
        0
      );

  const el =
    document.getElementById("estimatedBalance");

  if (!el) return;

  const currentBalance =
    startingBalance - totalSpent;

  el.textContent =
    "₹" + currentBalance.toFixed(2);
}
/* ================= LOAD EXPENSES ================= */

async function loadExpenses() {

  try {

    const res =
      await fetch("/api/expenses", {
        credentials: "include"
      });

    if (!res.ok)
      throw new Error();

    expenses =
      await res.json();

    renderList();

  }
  catch (err) {

    console.error("Failed to load expenses:", err);

  }

}


/* ================= ADD EXPENSE ================= */

async function addCalculatedExpense() {

  if (!amountInput.value)
    return alert("Enter amount");

  // ✅ get selected date first
  const selectedDate =
    dateInput.value ||
    new Date().toISOString().slice(0,10);

  const today =
    new Date().toISOString().slice(0,10);

  // ✅ block future date
  if (selectedDate > today) {
    alert("Future dates are not allowed");
    return;
  }

  try {

    const res =
      await fetch("/api/expenses", {

        method: "POST",

        credentials: "include",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          amount: amountInput.value,

          category: categoryInput.value,

          date: selectedDate,

          merchant: merchantInput.value

        })

      });

    if (!res.ok)
      throw new Error();

    amountInput.value = "";
    merchantInput.value = "";
    dateInput.value = "";

    loadExpenses();

  }
  catch {

    alert("Add expense failed");

  }

}
/* ================= CLEAR EXPENSES ================= */

async function clearAllExpenses() {

  if (!confirm("Delete all transactions?"))
    return;

  try {

    await fetch("/api/expenses", {

      method: "DELETE",

      credentials: "include"

    });

    expenses = [];

    renderList();

  }
  catch {

    alert("Delete failed");

  }

}

if (clearBtn)
  clearBtn.onclick =
    clearAllExpenses;


/* ================= UPLOAD BANK ================= */

async function uploadStatement() {

  const file =
    bankFileInput.files[0];

  if (!file)
    return alert("Select PDF");

  const fd =
    new FormData();

  fd.append("statement", file);

  bankStatus.textContent =
    "Analyzing...";

  try {

    const res =
      await fetch("/api/bank/upload", {

        method: "POST",

        credentials: "include",

        body: fd

      });

    const data =
      await res.json();

    if (!res.ok)
      throw new Error();

    bankStatus.textContent =
      "Imported " +
      data.imported +
      " transactions";

    loadExpenses();

  }
  catch {

    bankStatus.textContent =
      "Import failed";

  }

}


/* ================= RENDER ================= */

let showAllTransactions = false; // default = only 5

function renderList() {

  expenseList.innerHTML = "";

  if (!expenses.length) {

    expenseList.innerHTML = `
      <div style="text-align:center;color:#9ca3af;padding:20px;">
        No transactions yet
      </div>
    `;

    updateEstimatedBalance();
    return;
  }

const sortedExpenses = [...expenses]
  .sort((a, b) => new Date(b.date) - new Date(a.date));

const visibleExpenses =
  showAllTransactions
    ? sortedExpenses
    : sortedExpenses.slice(0, 5);
  visibleExpenses.forEach(e => {

    const date =
      new Date(e.date)
        .toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        });

    const item = document.createElement("div");
    item.className = "transaction-item";

    item.innerHTML = `
<div class="transaction-info">
          <div class="transaction-title">
            ${e.merchant || e.category}
          </div>
          <div class="transaction-date">
            ${date}
          </div>
        </div>
      </div>

      <div class="transaction-amount transaction-expense">
        - ₹${Number(e.amount).toFixed(2)}
      </div>
    `;

    expenseList.appendChild(item);
  });

  updateEstimatedBalance();
  generateInsights();

  const seeMoreBtn = document.getElementById("seeMoreBtn");

  if (seeMoreBtn) {

    if (expenses.length > 5 && !showAllTransactions) {
      seeMoreBtn.style.display = "inline-block";
      seeMoreBtn.innerText = "See More";
    }
    else if (showAllTransactions) {
      seeMoreBtn.style.display = "inline-block";
      seeMoreBtn.innerText = "Show Less";
    }
    else {
      seeMoreBtn.style.display = "none";
    }
  }
}
const seeMoreBtn = document.getElementById("seeMoreBtn");

if (seeMoreBtn) {
  seeMoreBtn.addEventListener("click", () => {
    showAllTransactions = !showAllTransactions;
    renderList();
  });
}
function getCategoryEmoji(category) {
  const icons = {
    Food: "🍔",
    Fuel: "⛽",
    Entertainment: "🎬",
    Education: "📚",
    Shopping: "🛍️",
    Bills: "💡",
    Travel: "✈️",
    Healthcare: "🏥",
    Other: "💸"
  };

  return icons[category] || "💰";
}
// AI Insights//
/* ================= ROTATING AI INSIGHTS (TOP CENTER QUOTE) ================= */
let insightMessages = [];
let insightIndex = 0;
let insightInterval = null;

function generateInsights(){

  if(!quoteText) return;

  if(!expenses.length){

    quoteText.innerHTML =
      "💡 Add transactions to see AI insights.";

    return;
  }

  const now = new Date();

  let total = 0;
  let highest = 0;
  let categoryTotals = {};

  let last7Days = 0;
  let prev7Days = 0;

  expenses.forEach(e => {

    const amount = Number(e.amount);
    const date = new Date(e.date);

    total += amount;

    if(amount > highest)
      highest = amount;

    categoryTotals[e.category] =
      (categoryTotals[e.category] || 0) + amount;

    const diffDays =
      (now - date) / (1000 * 60 * 60 * 24);

    if(diffDays <= 7)
      last7Days += amount;
    else if(diffDays <= 14)
      prev7Days += amount;
  });

  const avg = total / expenses.length;

  /* ---------- Top Category ---------- */

  let topCategory = "";
  let topAmount = 0;

  for(const cat in categoryTotals){

    if(categoryTotals[cat] > topAmount){

      topAmount = categoryTotals[cat];
      topCategory = cat;

    }
  }

  /* ---------- Weekly Increase ---------- */

  let weeklyMsg = "";

if(prev7Days > 0){

  const increase =
    ((last7Days - prev7Days) / prev7Days) * 100;

  if(increase > 15){

    weeklyMsg =
      `⚠ Your ${topCategory} spending increased ${increase.toFixed(0)}% this week`;

  }
}

  /* ---------- Overspending Detection ---------- */

  let overspendMsg = "";

  const dailyAvg =
    last7Days / 7;

  if(dailyAvg > avg){

    overspendMsg =
      "⚠ You are overspending compared to your average";

  }

  /* ---------- Balance Prediction ---------- */

  let balanceMsg = "";

  if(startingBalance > 0 && dailyAvg > 0){

    const remaining =
      startingBalance - total;

    const daysLeft =
      remaining / dailyAvg;

    if(daysLeft > 0 && daysLeft < 60){

      balanceMsg =
        `⏳ You may run out of balance in ${daysLeft.toFixed(0)} days`;

    }
  }

  /* ---------- Final Insight Messages ---------- */

  insightMessages = [

    weeklyMsg,

    overspendMsg,

    balanceMsg,

    `📊 Top category: ${topCategory} (₹${topAmount.toFixed(2)})`,

    `💰 Total spent: ₹${total.toFixed(2)}`,

    `📉 Average expense: ₹${avg.toFixed(2)}`,

    `⚠ Highest expense: ₹${highest.toFixed(2)}`,

    `📦 Transactions recorded: ${expenses.length}`

  ].filter(Boolean); // removes empty messages

  insightIndex = 0;

  showNextInsight();

  if(insightInterval)
    clearInterval(insightInterval);

  insightInterval =
    setInterval(showNextInsight, 10000);
}
function showNextInsight(){

  if(!quoteText || !insightMessages.length)
    return;

  // fade out
  quoteText.style.opacity = 0;
  quoteText.style.transform = "translateY(-8px)";

  setTimeout(()=>{

    // change text
    quoteText.innerHTML =
      insightMessages[insightIndex];

    // fade in
    quoteText.style.opacity = 1;
    quoteText.style.transform = "translateY(0px)";

    // next index
    insightIndex =
      (insightIndex + 1) %
      insightMessages.length;

  }, 400);
}
/* ===== SCROLL BUTTON ===== */

const scrollBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {

  if(window.scrollY > 200){

    scrollBtn.style.display = "flex";

  } else {

    scrollBtn.style.display = "none";

  }

});

scrollBtn.addEventListener("click", () => {

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

});

/* ================= INIT ================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    await loadStartingBalance();
    await loadExpenses();

  }
);
/* ================= SHOW FILE NAME ================= */

function showFileName(input){

  const fileName =
    input.files.length
      ? input.files[0].name
      : "No file selected";

  const el =
    document.getElementById("fileName");

  if(el)
    el.textContent = fileName;
}