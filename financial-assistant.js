// ================================
// Financial Assistant Chat Logic
// ================================

const messagesBox = document.getElementById("messages");
const inputBox = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

let isSending = false;
function addMessage(sender, text){

  const row = document.createElement("div");
  const isUser = sender === "You";

  row.className = isUser ? "msg user" : "msg bot";
  const bubbleWrapper = document.createElement("div");
bubbleWrapper.className = "msg-content";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = text;

  const time = document.createElement("div");
  time.className = "msg-time";
  time.innerText = new Date().toLocaleTimeString([],{
    hour:"2-digit",
    minute:"2-digit"
  });

  bubbleWrapper.appendChild(bubble);
  bubbleWrapper.appendChild(time);
  row.appendChild(bubbleWrapper);

  messagesBox.appendChild(row);

  messagesBox.scrollTop =
    messagesBox.scrollHeight;
}function addMessage(sender, text){

  const row = document.createElement("div");
  const isUser = sender === "You";

  row.className = isUser ? "msg user" : "msg bot";

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.innerText = isUser ? "You" : "Financial Assistant";

  const bubbleWrapper = document.createElement("div");
bubbleWrapper.className = "msg-content";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = text;

  const time = document.createElement("div");
  time.className = "msg-time";
  time.innerText = new Date().toLocaleTimeString([],{
    hour:"2-digit",
    minute:"2-digit"
  });

  bubbleWrapper.appendChild(bubble);
  bubbleWrapper.appendChild(time);

  row.appendChild(avatar);
  row.appendChild(bubbleWrapper);

  messagesBox.appendChild(row);

  messagesBox.scrollTop =
    messagesBox.scrollHeight;
}
/* Send message to backend */
async function sendMessage() {
  const message = inputBox.value.trim();
  if (!message || isSending) return;

  isSending = true;
  inputBox.value = "";
  sendBtn.disabled = true;

  addMessage("You", message);
  addMessage("Financial Assistant", `
<span class="typing">
  <span>.</span><span>.</span><span>.</span>
</span>
`);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    if (!res.ok) {
      throw new Error("Server error");
    }

    const data = await res.json();

    // Remove "Thinking..."
    messagesBox.removeChild(messagesBox.lastChild);

    addMessage("Financial Assistant", data.reply);
  } catch (err) {
    // Remove "Thinking..."
    messagesBox.removeChild(messagesBox.lastChild);

    addMessage(
      "Financial Assistant",
      "⚠ Unable to connect to AI server. Make sure backend is running."
    );
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    inputBox.focus();
  }
}

/* Enter key support */
inputBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
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

loadWelcomeUser();
/* ================= LOAD FINANCIAL STATS ================= */

async function loadAssistantStats(){

  try{

    const res =
      await fetch("/api/balance/current",{
        credentials:"include"
      });

    if(!res.ok) return;

    const data =
      await res.json();

    const balance =
      document.getElementById("statBalance");

    const spent =
      document.getElementById("statSpent");

    const savings =
      document.getElementById("statSavings");

    if(balance)
      balance.textContent =
        "₹" + data.currentBalance;

    if(spent)
      spent.textContent =
        "₹" + data.spent;

    if(savings){

      const total =
        data.currentBalance + data.spent;

      const rate =
        total > 0
        ? ((data.currentBalance / total) * 100).toFixed(1)
        : 0;

      savings.textContent =
        rate + "%";

    }

  }
  catch(err){

    console.error("Stats load failed", err);

  }

}
// ================= MENU =================

const menuBtn =
  document.getElementById("menuBtn");

const menuDropdown =
  document.getElementById("menuDropdown");

const clearChatBtn =
  document.getElementById("clearChatBtn");

// toggle dropdown
menuBtn?.addEventListener("click",(e)=>{

  e.stopPropagation();

  menuDropdown.style.display =
    menuDropdown.style.display === "block"
      ? "none"
      : "block";

});

// clear chat
clearChatBtn?.addEventListener("click", async ()=>{

  if(!confirm("Clear all chat history?"))
    return;

  try{

    const res =
      await fetch("/api/chat/history",{
        method:"DELETE",
        credentials:"include"
      });

    if(!res.ok)
      throw new Error();

    messagesBox.innerHTML = "";

    menuDropdown.style.display = "none";

  }
  catch{

    alert("Failed to clear chat");

  }

});

// close when clicking outside
document.addEventListener("click",()=>{

  if(menuDropdown)
    menuDropdown.style.display="none";

});

// ================= LOAD CHAT HISTORY =================
async function loadChatHistory(){

  try{

    const res =
      await fetch("/api/chat/history",{
        credentials:"include"
      });

    if(!res.ok) return;

    const chats =
      await res.json();

    chats.forEach(chat=>{

      addMessage(
        chat.sender === "user"
          ? "You"
          : "Financial Assistant",
        chat.message
      );

    });

  }
  catch(err){

    console.error("Chat history load failed");

  }

}

// load when page opens
loadChatHistory();

/* load on page start */
loadAssistantStats();

/* ================= GOAL CARD CLICK REDIRECT ================= */

function enableGoalRedirect() {

  const goalCard = document.getElementById("goalCard");

  if (!goalCard) return;

  goalCard.style.cursor = "pointer";

  goalCard.addEventListener("click", () => {

    window.location.href = "goal.html";

  });

}

/* call after dashboard loads */
enableGoalRedirect();


/* Button click */
sendBtn.addEventListener("click", sendMessage);
