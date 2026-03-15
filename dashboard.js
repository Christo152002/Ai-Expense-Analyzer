/* ================= LOGIN CHECK ================= */
let selectedMonth = null;
let selectedYear = null;
async function requireLogin() {

  const res = await fetch("/api/expenses", {
    credentials: "include"
  });

  if (res.status === 401)
    window.location.href = "/login.html";
}

requireLogin();


/* ================= QUOTES ================= */

const quotes = [
  "Save first. Spend what’s left — not the other way around.",
  "Small expenses repeated daily become big regrets yearly.",
  "Your future self is watching your spending today.",
  "Money saved is freedom earned.",
  "Track money like time — it never comes back.",
  "Wealth grows quietly. Debt grows loudly.",
  "Discipline beats motivation every time.",
  "If you don’t control money, it will control you.",
  "Budgeting is telling your money where to go instead of wondering where it went.",
  "High income means nothing without discipline."
];

function showLoginQuote() {

  const el = document.getElementById("quoteText");

  if (!el) return;

  el.textContent =
    quotes[Math.floor(Math.random() * quotes.length)];
}


/* ================= STATE ================= */

let expenses = [];
let goals = [];
let startingBalance = 0;

let barChart = null;
let pieChart = null;


/* ================= LOAD ALL DATA ================= */

async function loadDashboardData() {

  const [expenseRes, goalRes, balanceRes] =
    await Promise.all([

      fetch("/api/expenses",{credentials:"include"}),

      fetch("/api/goal",{credentials:"include"}),

      fetch("/api/balance",{credentials:"include"})
    ]);

  expenses =
    expenseRes.ok ? await expenseRes.json() : [];

  goals =
    goalRes.ok ? await goalRes.json() : [];

  const balance =
    balanceRes.ok ? await balanceRes.json() : {};

  startingBalance =
    Number(balance.startingBalance) || 0;
    
  populateMonthSelector();
  renderCharts();

  renderDashboardGoal();

  updateDashboardEstimatedBalance();
}

/* ================= CHARTS ================= */

function renderCharts() {

  if (!window.Chart) return;

  const barChartEl = document.getElementById("barChart");
  const pieChartEl = document.getElementById("pieChart");

  if (!barChartEl || !pieChartEl) return;


  /* ===== MONTHLY + WEEKLY GROUPING ===== */

  const monthly = {};
  const weekly = {};
const category = {};

const now = new Date();
const currentMonth = now.getMonth();
const currentYear = now.getFullYear();

expenses.forEach(e => {

  if (!e.date) return;

  const d = new Date(e.date);

  /* MONTH KEY */
  const monthKey =
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2,"0");

  /* MONTHLY TOTAL */
  monthly[monthKey] =
    (monthly[monthKey] || 0) + Number(e.amount);

  /* WEEKLY TREND */
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());

  const weekKey =
    start.toISOString().split("T")[0];

  weekly[weekKey] =
    (weekly[weekKey] || 0) + Number(e.amount);

  /* CATEGORY (CURRENT MONTH ONLY) */

  const now = new Date();

if (
  d.getMonth() === selectedMonth &&
  d.getFullYear() === selectedYear
)
  {
    const c = e.category || "Other";

    category[c] =
      (category[c] || 0) + Number(e.amount);
  }

});

  const sortedDates =
    Object.keys(monthly)
      .sort((a,b)=>new Date(a)-new Date(b));

  const sortedAmounts =
    sortedDates.map(d => monthly[d]);


  const weeklyValues =
    Object.values(weekly);

  const weeklyAvg =
    weeklyValues.length
      ? weeklyValues.reduce((a,b)=>a+b,0) / weeklyValues.length
      : 0;

  const weeklyAvgLine =
    Array(sortedDates.length).fill(
      Math.round(weeklyAvg * 4.33)
    );


  /* DESTROY OLD CHARTS */

  if (barChart) barChart.destroy();
  if (pieChart) pieChart.destroy();


  /* ================= LINE CHART ================= */

  barChart = new Chart(barChartEl, {

    type: "line",

    data: {

      labels: sortedDates,

      datasets: [

{
  label: "(Monthly Spending)",
  data: sortedAmounts,
  fill: false,          // remove area
  tension: 0,           // straight polygon lines
  borderColor: "#8b5cf6",
  borderWidth: 3,
  pointRadius: 5,
  pointBackgroundColor: "#8b5cf6"
},

        {
          label: "Weekly Average Trend",
          data: weeklyAvgLine,
          borderColor: "#22c55e",
          borderDash: [5,5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }

      ]
    },

    options: {

      responsive: true,

      animation: {
        duration: 1800,
        easing: "easeOutQuart"
      },

      transitions: {
        active: {
          animation: {
            duration: 400
          }
        }
      },

      plugins: {
        legend: {
          labels: {
            color: "#fff"
          }
        }
      },

      scales: {

        x: {
          title: {
            display: true,
            text: "Month",
            color: "#fff"
          },
          ticks: {
            color: "#fff"
          }
        },

        y: {
          title: {
            display: true,
            text: "Amount (₹)",
            color: "#fff"
          },
          ticks: {
            color: "#fff"
          },
          beginAtZero: true
        }

      }

    }

  });


  /* ================= PIE CHART ================= */

  pieChart = new Chart(pieChartEl, {

    type: "pie",

    data: {

      labels: Object.keys(category),

      datasets: [{

        data: Object.values(category),

backgroundColor: [
  "#8b5cf6", // purple
  "#6366f1", // indigo
  "#06b6d4", // cyan
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#14b8a6"  // teal
],

        hoverOffset: 14

      }]

    },

options: {

  animation: false,

  plugins: {
    legend: {
      labels: {
        color: "#fff"
      }
    }
  }

}

  });

}
/* ================= GOAL RENDER ================= */

function renderDashboardGoal(){

  const titleEl = document.getElementById("goalTitleDash");
  const metaEl = document.getElementById("goalMeta");
  const barEl = document.getElementById("goalProgressBar");
  const cardEl = document.getElementById("goalCard");

  if(!titleEl || !metaEl || !barEl || !cardEl) return;

  if(!goals.length){

    titleEl.textContent = "No goals yet";
    metaEl.textContent = "Set a goal to start tracking";
    barEl.style.width = "0%";

    return;
  }

  const goal = goals[0];

  const totalSpent =
    expenses.reduce((s,e)=>s+Number(e.amount),0);

  const currentBalance =
    startingBalance - totalSpent;

const percent = Math.min(
  100,
  Math.round((currentBalance / goal.targetAmount) * 100)
);

  barEl.style.width = percent + "%";

/* ===== COLOR LOGIC ===== */

/* remove old classes */
barEl.classList.remove("safe", "warning", "danger");

/* apply correct color */
if (percent >= 75) {

  barEl.classList.add("safe");     // GREEN

}
else if (percent >= 40) {

  barEl.classList.add("warning");  // YELLOW

}
else {

  barEl.classList.add("danger");   // RED

}
  titleEl.textContent = goal.title;

  metaEl.innerHTML = `
    Target: ₹${goal.targetAmount}<br>
    Current: ₹${currentBalance.toFixed(0)}<br>
    Progress: ${percent.toFixed(1)}%
  `;
/* remove old card state */
cardEl.classList.remove("safe", "warning", "danger");

/* apply same state to card */
if (percent >= 75) {
  cardEl.classList.add("safe");
}
else if (percent >= 40) {
  cardEl.classList.add("warning");
}
else {
  cardEl.classList.add("danger");
}
}
/* ================= BALANCE ================= */

function updateDashboardEstimatedBalance(){

  const spent=
    expenses.reduce(
      (s,e)=>s+Number(e.amount),0);

  const balance=
    startingBalance-spent;

  const el=
    document.getElementById(
      "dashEstimatedBalance"
    );

  if(el)
    el.textContent=
      `₹${balance.toFixed(2)}`;
}


/* ================= USER ================= */

/* ================= USER ================= */

async function loadWelcomeUser(){

  try{

    const res = await fetch("/api/profile",{
      credentials:"include"
    });

    if(!res.ok) return;

    const user = await res.json();

    const welcomeEl =
      document.querySelector(".welcome-name");

    if(welcomeEl)
      welcomeEl.textContent =
        `${user.username || "User"} !`

  }catch(err){

    console.error("Welcome user load failed", err);

  }

}

/* ================= GOAL CLICK REDIRECT ================= */

function enableGoalRedirect(){

  const goalCard =
    document.getElementById("goalCard");

  if(!goalCard)return;

  goalCard.onclick = () => {

    window.location.href =
      "goal.html";

  };
}
/* ================= LOGOUT ================= */

const logoutBtn =
  document.getElementById("logoutBtn");

if (logoutBtn) {

  logoutBtn.addEventListener("click", async () => {

    try {

      await fetch("/api/logout", {
        method: "POST",
        credentials: "include"
      });

      // redirect to login page
      window.location.href = "login.html";

    } catch (err) {

      console.error("Logout failed", err);
      alert("Logout failed");

    }

  });

}
function populateMonthSelector(){

  const select = document.getElementById("categoryMonthSelect");
  if(!select) return;

  const months = {};

  expenses.forEach(e=>{
    if(!e.date) return;

    const d = new Date(e.date);

    const key =
      d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");

    months[key] = true;
  });

  const sorted =
    Object.keys(months)
      .sort((a,b)=>new Date(b)-new Date(a));

  select.innerHTML = "";

  sorted.forEach(m=>{

    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;

    select.appendChild(opt);
  });

  if(sorted.length){

    const first = sorted[0].split("-");
    selectedYear = Number(first[0]);
    selectedMonth = Number(first[1]) - 1;

    select.value = sorted[0];
  }

  select.onchange = e=>{

    const parts = e.target.value.split("-");
    selectedYear = Number(parts[0]);
    selectedMonth = Number(parts[1]) - 1;

    renderCharts();
  };
}

/* ================= INIT ================= */

async function initDashboard(){

  showLoginQuote();

  await loadDashboardData();

  enableGoalRedirect();
}

initDashboard();

loadWelcomeUser();
