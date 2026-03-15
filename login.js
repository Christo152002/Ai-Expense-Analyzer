document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const mobile = document.getElementById("mobile").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!mobile || !password) {
    alert("Mobile and password required");
    return;
  }

  try {
    document.getElementById("btnText").style.display = "none";
    document.getElementById("spinner").style.display = "block";
    document.getElementById("loginBtn").disabled = true;
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mobile, password })
    });

    const data = await res.json();

    if (!res.ok) {
      const card = document.querySelector(".login-card");

card.classList.add("error-shake");

setTimeout(()=>{
  card.classList.remove("error-shake");
},400);

document.getElementById("btnText").style.display = "block";
document.getElementById("spinner").style.display = "none";
document.getElementById("loginBtn").disabled = false;
      return;
    }

document.body.classList.add("fade-out");

setTimeout(()=>{
  window.location.href = "/dashboard.html";
},400);

  } catch (err) {
    document.getElementById("btnText").style.display = "block";
    document.getElementById("spinner").style.display = "none";
    document.getElementById("loginBtn").disabled = false;
    console.error(err);
    alert("Server error");
  }
});


/* REGISTER BUTTON NAVIGATION */
document.getElementById("registerBtn").onclick = () => {
  window.location.href = "/register.html";
};
function togglePassword(){

  const input = document.getElementById("password");

  if(input.type === "password"){
    input.type = "text";
  }else{
    input.type = "password";
  }

}