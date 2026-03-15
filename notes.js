// ask permission when page loads
Notification.requestPermission();

/* ================= LOAD USER ================= */

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

    const avatar =
      user.avatar || "/assets/avatar.png";

    const topPic =
      document.getElementById("topProfilePic");

    if(topPic)
      topPic.src = avatar;

  }
  catch(err){
    console.error("Welcome user load failed", err);
  }

}


/* ================= NOTES SYSTEM ================= */

const notesList =
  document.getElementById("notesList");

const noteText =
  document.getElementById("noteText");


/* ================= NOTIFICATION ================= */

function showNotification(title, body){

  if(Notification.permission === "granted"){

    try{

      new Notification(title,{
        body: body
      });

    }catch(err){

      alert(title + ": " + body);

    }

  }
  else{

    alert(title + ": " + body);

  }

}


/* ================= LOAD NOTES ================= */

async function loadNotes(){

  try{

    const res =
      await fetch("/api/notes",{
        credentials:"include"
      });

    if(!res.ok) return;

    const notes =
      await res.json();

    notesList.innerHTML = "";

    notes.forEach(note=>{

      const div =
        document.createElement("div");

      div.className = "note";

      // FIX: use local format without timezone conversion
      let localReminderValue = "";

      if(note.reminder_at){

        const d = new Date(note.reminder_at);

        const year = d.getFullYear();
        const month = String(d.getMonth()+1).padStart(2,"0");
        const day = String(d.getDate()).padStart(2,"0");

        const hours = String(d.getHours()).padStart(2,"0");
        const minutes = String(d.getMinutes()).padStart(2,"0");

        localReminderValue =
          `${year}-${month}-${day}T${hours}:${minutes}`;
      }

div.innerHTML = `
  <div class="note-top">
    <div class="note-text">${note.text}</div>
    <span class="delete" data-id="${note.id}">✖</span>
  </div>

  <div class="note-meta">
    ${
      note.reminder_at
      ? `<span class="reminder-badge">⏰ ${new Date(note.reminder_at).toLocaleString()}</span>`
      : `<span class="no-reminder">No reminder</span>`
    }
  </div>

  <div class="note-footer">
    <small>${new Date(note.created_at).toLocaleString()}</small>
  </div>

  <div class="note-edit">
    <input
      type="datetime-local"
      class="editReminder"
      data-id="${note.id}"
      value="${localReminderValue}"
    >
    <button
      class="saveReminder"
      data-id="${note.id}">
      Save
    </button>
  </div>
`;
      notesList.appendChild(div);

    });

  }
  catch(err){
    console.error(err);
  }

}


/* ================= ADD NOTE ================= */

async function addNote(){

  const text =
    noteText.value.trim();

  if(!text) return;

  await fetch("/api/notes",{

    method:"POST",

    credentials:"include",

    headers:{
      "Content-Type":"application/json"
    },

    body:JSON.stringify({
      text,
      reminder_at:null
    })

  });

  noteText.value="";
  loadNotes();

}


/* ================= CLICK HANDLERS ================= */

notesList.addEventListener("click", async (e)=>{

  /* DELETE */

  if(e.target.classList.contains("delete")){

    const id =
      e.target.dataset.id;

    await fetch(`/api/notes/${id}`,{

      method:"DELETE",
      credentials:"include"

    });

    loadNotes();

  }


  /* SAVE REMINDER */

  if(e.target.classList.contains("saveReminder")){

    const id =
      e.target.dataset.id;

    const input =
      document.querySelector(
        `.editReminder[data-id="${id}"]`
      );

    if(!input.value){

      alert("Select reminder time");
      return;

    }

    // FIX: store local time WITHOUT converting to UTC
    await fetch(`/api/notes/${id}/reminder`,{

      method:"PATCH",

      credentials:"include",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({
        reminder_at: input.value
      })

    });

    loadNotes();

  }

});


/* ================= REMINDER CHECKER ================= */

setInterval(async ()=>{

  const res =
    await fetch("/api/notes",{
      credentials:"include"
    });

  if(!res.ok) return;

  const notes =
    await res.json();

  const now =
    Date.now();

  notes.forEach(note=>{

    if(
      note.reminder_at &&
      !note.reminded &&
      new Date(note.reminder_at).getTime() <= now
    ){

      showNotification(
        "Reminder",
        note.text
      );

      fetch(`/api/notes/${note.id}/reminded`,{

        method:"PATCH",
        credentials:"include"

      });

    }

  });

},30000);


/* ================= REALTIME SOCKET ================= */

const ws = new WebSocket("ws://localhost:3000");

let currentUserId = null;

ws.onopen = async ()=>{

  try{

    const res = await fetch("/api/profile",{
      credentials:"include"
    });

    if(!res.ok) return;

    const user = await res.json();

    currentUserId = user.id;

    ws.send(JSON.stringify({
      userId: currentUserId
    }));

  }
  catch(err){
    console.error("WebSocket auth failed",err);
  }

};

ws.onmessage = (event)=>{

  const data = JSON.parse(event.data);

  if(data.type==="reminder"){

    showNotification(
      "Reminder",
      data.text
    );

  }

};


/* ================= INITIAL LOAD ================= */

loadWelcomeUser();
loadNotes();
