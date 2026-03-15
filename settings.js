/* ===============================
   SAFE DOM READY
================================ */
document.addEventListener("DOMContentLoaded", () => {

initMenu();
initProfileSave();
initAvatarUpload();
initDeleteAccount();
initExportData();   // ADD THIS LINE
initPasswordStrength();
initChangePassword();
initShowPassword();
loadProfile();

});
/* ===============================
   MENU SWITCHER FIX
================================ */
function initMenu(){

const menuItems = document.querySelectorAll(".menu-item");

menuItems.forEach(item => {

item.addEventListener("click", () => {

const sectionMap = {
"View Profile": "viewProfileSection",
"Edit Profile": "profileSection",
"Security": "securitySection",
"Preferences": "preferencesSection",
"Data": "dataSection"
};

const text = item.textContent.trim();

const sectionId = sectionMap[text];

if(sectionId){
showSection(sectionId);
}

});

});

}


function showSection(sectionId){

/* hide all */
document.querySelectorAll(".section")
.forEach(sec => sec.classList.add("hidden"));

/* show selected */
const active = document.getElementById(sectionId);

if(active)
active.classList.remove("hidden");


/* fix active menu */
document.querySelectorAll(".menu-item")
.forEach(m => m.classList.remove("active"));

const activeMenu = Array.from(document.querySelectorAll(".menu-item"))
.find(m => {

const map = {
"View Profile":"viewProfileSection",
"Edit Profile":"profileSection",
"Security":"securitySection",
"Preferences":"preferencesSection",
"Data":"dataSection"
};

return map[m.textContent.trim()] === sectionId;

});

if(activeMenu)
activeMenu.classList.add("active");

}


/* ===============================
   LOAD PROFILE
================================ */
async function loadProfile(){

try{

const res = await fetch("/api/profile",{
credentials:"include"
});

if(!res.ok){
location.href="/login.html";
return;
}

const user = await res.json();

const avatar =
user.avatar || "/assets/avatar.png";


/* view profile */
setText("profileName", user.username || "User");
setText("profileEmail", user.email || "");
setText("profileCurrency", "Currency: " + (user.currency || "INR"));

/* convert timezone to readable region */
const regionMap = {
"Asia/Kolkata":"India",
"America/New_York":"USA",
"Europe/Berlin":"Eurozone",
"Europe/London":"United Kingdom",
"America/Toronto":"Canada",
"Australia/Sydney":"Australia",
"Asia/Kuwait":"Kuwait",
"Asia/Riyadh":"Saudi Arabia"
};

setText(
"profileRegion",
"Region: " + (regionMap[user.timezone] || user.timezone || "India")
);
/* new profile info */
setText(
"profileMemberSince",
"Member since: " + formatDate(user.createdAt)
);

setText(
"profileLastLogin",
"Last login: " + formatDateTime(user.lastLogin)
);

setText(
"profileAccountId",
"Account ID: " + (user.accountId || user._id || "—")
);

/* edit profile read-only fields */
setValue("accountIdInput", user.accountId || user._id || "");
setValue("memberSinceInput", formatDate(user.createdAt));
setValue("lastLoginInput", formatDateTime(user.lastLogin));
setSrc("profilePicPreview", avatar);
setSrc("editProfilePicPreview", avatar);
setSrc("topProfilePic", avatar);


/* sidebar */
setText("sidebarUserName", user.username || "User");


/* edit profile */
setValue("usernameInput", user.username || "");
setValue("emailInput", user.email || "");
setValue("currencyInput", user.currency || "INR");
setValue("timezoneInput", user.timezone || "Asia/Kolkata");


}catch(err){

console.error("Profile load error:", err);

}

}


/* ===============================
   SAVE PROFILE FIX
================================ */
function initProfileSave(){

const btn = document.getElementById("saveProfileBtn");
const status = document.getElementById("profileSaveStatus");

if(!btn) return;

btn.addEventListener("click", async () => {

try{

btn.disabled = true;
btn.textContent = "Saving...";

const username = getValue("usernameInput");
const email = getValue("emailInput");
const currency = getValue("currencyInput");
const timezone = getValue("timezoneInput");

/* VALIDATION */
if(username.length < 3){
status.textContent = "Username must be at least 3 characters";
status.style.color = "#ef4444";
return;
}

if(!email.includes("@")){
status.textContent = "Enter valid email address";
status.style.color = "#ef4444";
return;
}

/* SEND UPDATE */
const res = await fetch("/api/profile/update",{

method:"POST",

credentials:"include",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
username,
email,
currency,
timezone
})

});

const data = await res.json();

if(data.success){

status.textContent = "✔ Profile saved successfully";
status.style.color = "#22c55e";
status.style.fontWeight = "500";

await loadProfile();

/* switch to view profile */
setTimeout(()=>{
showSection("viewProfileSection");
},800);

}else{

status.textContent = data.error || "Update failed";
status.style.color = "#ef4444";

}

}catch(err){

console.error(err);

status.textContent = "Server error";
status.style.color = "#ef4444";

}

finally{

btn.disabled = false;
btn.textContent = "Save Profile";

}

});

}
/* ===============================
   AVATAR UPLOAD FIX
================================ */
function initAvatarUpload(){

const input = document.getElementById("profilePic");
const status = document.getElementById("profileSaveStatus");

if(!input) return;

input.addEventListener("change", async e => {

const file = e.target.files[0];
if(!file) return;

/* preview instantly */
const preview = URL.createObjectURL(file);
setSrc("profilePicPreview", preview);
setSrc("editProfilePicPreview", preview);
setSrc("topProfilePic", preview);

status.textContent = "Uploading avatar...";
status.style.color = "#9ca3af";

const form = new FormData();
form.append("avatar", file);

try{

const res = await fetch("/api/profile",{
method:"POST",
credentials:"include",
body:form
});

const data = await res.json();

if(data.avatar){

setSrc("profilePicPreview", data.avatar);
setSrc("editProfilePicPreview", data.avatar);
setSrc("topProfilePic", data.avatar);

status.textContent = "Avatar updated";
status.style.color = "#22c55e";

}else{

status.textContent = "Upload failed";
status.style.color = "#ef4444";

}

}catch(err){

status.textContent = "Upload error";
status.style.color = "#ef4444";

}

});

}

/* ===============================
   DELETE ACCOUNT
================================ */
function initDeleteAccount(){

const btn = document.getElementById("deleteAccountBtn");

if(!btn) return;

btn.addEventListener("click", async () => {

if(!confirm("Delete account permanently?")) return;

await fetch("/api/profile",{
method:"DELETE",
credentials:"include"
});

location.href="/login.html";

});

}
/* ===============================
   EXPORT PROFILE DATA FIX
================================ */
function initExportData(){

const btn = document.getElementById("exportDataBtn");

if(!btn) return;

btn.addEventListener("click", async ()=>{

try{

btn.disabled = true;
btn.textContent = "Exporting...";

/* trigger download */
const res = await fetch("/api/export",{
method:"GET",
credentials:"include"
});

if(!res.ok){
throw new Error("Export failed");
}

/* convert to blob */
const blob = await res.blob();

/* create download */
const url = window.URL.createObjectURL(blob);

const a = document.createElement("a");

a.href = url;
a.download = "financial-report.pdf";

document.body.appendChild(a);
a.click();

a.remove();

window.URL.revokeObjectURL(url);

btn.textContent = "Export Complete";

setTimeout(()=>{
btn.textContent = "Export Profile Data";
btn.disabled = false;
},1500);

}
catch(err){

console.error(err);

btn.textContent = "Export Failed";

setTimeout(()=>{
btn.textContent = "Export Profile Data";
btn.disabled = false;
},1500);

}

});

}

/* ===============================
   SAFE HELPERS
================================ */

function setText(id,value){

const el = document.getElementById(id);
if(el) el.textContent = value;

}

function setSrc(id,value){

const el = document.getElementById(id);
if(el) el.src = value;

}

function setValue(id,value){

const el = document.getElementById(id);
if(el) el.value = value;

}

function getValue(id){

const el = document.getElementById(id);
return el ? el.value.trim() : "";

}
function formatDate(date){
if(!date) return "—";
return new Date(date).toLocaleDateString(undefined,{
year:"numeric",
month:"short",
day:"numeric"
});
}

function formatDateTime(date){
if(!date) return "—";
return new Date(date).toLocaleString();
}
// ===============================
// PASSWORD STRENGTH METER
// ===============================
function initPasswordStrength(){

  const input = document.getElementById("newPassword");
  const fill = document.getElementById("settingsStrengthFill");
  const text = document.getElementById("settingsStrengthText");

  if(!input) return;

  input.addEventListener("input", ()=>{

    const password = input.value;
    const score = calculateStrength(password);

    const colors = ["#ef4444","#f97316","#eab308","#22c55e","#16a34a"];
    const labels = ["Very Weak","Weak","Medium","Strong","Very Strong"];

    if(score === 0){
      fill.style.width = "0%";
      text.textContent = "";
      return;
    }

    fill.style.width = (score * 20) + "%";
    fill.style.background = colors[score-1];
    text.textContent = labels[score-1];
  });

}

function calculateStrength(password){

  let score = 0;

  if(password.length >= 8) score++;
  if(/[A-Z]/.test(password)) score++;
  if(/[a-z]/.test(password)) score++;
  if(/[0-9]/.test(password)) score++;
  if(/[^A-Za-z0-9]/.test(password)) score++;

  return score;
}
// ===============================
// CHANGE PASSWORD
// ===============================
function initChangePassword(){

  const btn = document.getElementById("changePasswordBtn");
  const status = document.getElementById("securityStatus");

  if(!btn) return;

  btn.addEventListener("click", async ()=>{

    const oldPassword = getValue("oldPassword");
    const newPassword = getValue("newPassword");
    const confirmPassword = getValue("confirmPassword");

    if(!oldPassword || !newPassword || !confirmPassword){
      status.textContent = "All fields required";
      status.style.color = "#ef4444";
      return;
    }

    if(newPassword !== confirmPassword){
      status.textContent = "Passwords do not match";
      status.style.color = "#ef4444";
      return;
    }

    if(calculateStrength(newPassword) < 3){
      status.textContent = "Password too weak";
      status.style.color = "#ef4444";
      return;
    }

    try{

      btn.disabled = true;
      btn.textContent = "Changing...";

      const res = await fetch("/api/profile/password",{
        method:"POST",
        credentials:"include",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          oldPassword,
          newPassword
        })
      });

      const data = await res.json();

      if(res.ok){
        status.textContent = "✔ Password changed successfully";
        status.style.color = "#22c55e";

        document.getElementById("oldPassword").value="";
        document.getElementById("newPassword").value="";
        document.getElementById("confirmPassword").value="";
      }else{
        status.textContent = data.error || "Change failed";
        status.style.color = "#ef4444";
      }

    }catch(err){
      status.textContent = "Server error";
      status.style.color = "#ef4444";
    }

    btn.disabled = false;
    btn.textContent = "Change Password";

  });

}
// ===============================
// SHOW/HIDE PASSWORD
// ===============================
function initShowPassword(){

  const toggles = document.querySelectorAll(".toggle-password");

  toggles.forEach(toggle => {

    toggle.addEventListener("click", () => {

      const targetId = toggle.getAttribute("data-target");
      const input = document.getElementById(targetId);

      if(!input) return;

      if(input.type === "password"){
        input.type = "text";
        toggle.textContent = "🙈";
      }else{
        input.type = "password";
        toggle.textContent = "👁";
      }

    });

  });

}