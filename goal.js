/* ================= STATE ================= */
let goals = [];
let expenses = [];
let startingBalance = 0;

/* ================= HELPERS ================= */
function handleAuthFailure() {
  alert("Session expired. Please login again.");
  window.location.href = "login.html";
}

/* ================= LOAD ALL DATA ================= */
async function loadAll() {
  try {
    const [goalRes, expenseRes, balanceRes] = await Promise.all([
      fetch("/api/goal", { credentials: "include" }),
      fetch("/api/expenses", { credentials: "include" }),
      fetch("/api/balance", { credentials: "include" })
    ]);

    if ([goalRes, expenseRes, balanceRes].some(r => r.status === 401)) {
      handleAuthFailure();
      return;
    }

    goals = goalRes.ok ? await goalRes.json() : [];
    expenses = expenseRes.ok ? await expenseRes.json() : [];
    const bal = balanceRes.ok ? await balanceRes.json() : { startingBalance: 0 };

    startingBalance = Number(bal.startingBalance) || 0;

    renderGoals();
  } catch (err) {
    console.error("Load error:", err);
  }
}

/* ================= ADD GOAL ================= */
setGoalBtn.addEventListener("click", async () => {
  const title = goalTitle.value.trim();
  const targetAmount = Number(goalAmount.value);
  const dueDate = goalDue.value;

  if (!title || !targetAmount || !dueDate) {
    alert("Please fill all fields");
    return;
  }

  const res = await fetch("/api/goal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title, targetAmount, dueDate })
  });

  if (res.status === 401) {
    handleAuthFailure();
    return;
  }

  goalTitle.value = "";
  goalAmount.value = "";
  goalDue.value = "";

  loadAll();
});

/* ================= DELETE GOAL ================= */
async function deleteGoal(id) {
  if (!confirm("Delete this goal permanently?")) return;

  const res = await fetch(`/api/goal/${id}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (res.status === 401) {
    handleAuthFailure();
    return;
  }

  loadAll();
}

/* ================= RENDER ================= */
function renderGoals() {
  goalsList.innerHTML = "";

  if (!goals.length) {
    goalsList.innerHTML = "<p>No goals added yet.</p>";
    return;
  }

  const totalSpent = expenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );

  const currentBalance = startingBalance - totalSpent;

 goals.forEach(goal => {
  const target = Number(goal.targetAmount);
  const remaining = Math.max(0, target - currentBalance);

  const percent = Math.min(
    100,
    Math.round((currentBalance / target) * 100)
  );

  // 🔥 MOVE THIS OUTSIDE TEMPLATE
  let progressClass = "progress-red";

  if (percent >= 70) {
    progressClass = "progress-green";
  } else if (percent >= 40) {
    progressClass = "progress-yellow";
  }
  let cardState = "card-red";

if (percent >= 70) {
  cardState = "card-green";
} else if (percent >= 40) {
  cardState = "card-yellow";
}
  const { status, color } = goalHealth(goal, currentBalance);

  const card = document.createElement("div");
  card.className = `goal-card ${cardState}`;

  card.innerHTML = `
    <div class="goal-header">
      <h3>${goal.title}</h3>
      <button class="delete-btn" onclick="deleteGoal('${goal.id}')">✖</button>
    </div>

    <div style="font-size:22px;font-weight:600;margin-top:8px;">
      ₹${currentBalance.toFixed(0)} 
      <span style="font-size:14px;color:#9ca3af;">
        / ₹${target.toLocaleString()}
      </span>
    </div>

    <div class="progress-bar">
<div class="progress-fill ${progressClass}" 
     data-percent="${percent}"></div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
      <div style="font-size:13px;color:#9ca3af;">
        ₹${remaining.toFixed(0)} remaining
      </div>

      <div style="font-weight:600;">
        ${percent}%
      </div>
    </div>

    <div style="margin-top:12px;">
      <span class="goal-status ${color}">
        ${status}
      </span>
    </div>

    <div style="margin-top:12px;font-size:12px;color:#9ca3af;">
      Due ${new Date(goal.dueDate).toLocaleDateString("en-IN")}
    </div>
  `;

  goalsList.appendChild(card);
  const fill = card.querySelector(".progress-fill");

setTimeout(() => {
  fill.style.width = percent + "%";
}, 100);
});
}

/* ================= GOAL HEALTH ================= */
function goalHealth(goal, balance) {
  const now = new Date();
  const due = new Date(goal.dueDate);

  const totalTime = due - now;
  const remainingMoney = goal.targetAmount - balance;

  if (remainingMoney <= 0)
    return { status: "🎉 Achieved", color: "green" };

  if (totalTime <= 0)
    return { status: "⛔ Missed", color: "red" };

  if (remainingMoney < goal.targetAmount * 0.3)
    return { status: "🟢 On Track", color: "green" };

  if (remainingMoney < goal.targetAmount * 0.6)
    return { status: "🟡 At Risk", color: "yellow" };

  return { status: "🔴 Off Track", color: "red" };
}
/* ================= LOGOUT ================= */

document.addEventListener("DOMContentLoaded", () => {

  const logoutBtn =
    document.getElementById("logoutBtn");

  if (!logoutBtn) {
    console.error("Logout button not found");
    return;
  }

  logoutBtn.addEventListener("click", async () => {

    try {

      console.log("Logging out...");

      await fetch("/api/logout", {
        method: "POST",
        credentials: "include"
      });

    } catch (err) {

      console.error("Logout error:", err);

    }

    // Always redirect
    window.location.href = "login.html";

  });

});

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
        `${user.username || "User"} !`;


    /* OPTIONAL: also update top avatar */
    const avatar =
      user.avatar || "/assets/avatar.png";

    const topPic =
      document.getElementById("topProfilePic");

    if(topPic)
      topPic.src = avatar;


  }catch(err){

    console.error("Welcome user load failed", err);

  }

}


/* ================= INIT ================= */
loadWelcomeUser();
loadAll();
