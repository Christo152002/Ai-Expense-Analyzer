async function loadProfile() {
  const res = await fetch("/api/profile", {
    credentials: "include"
  });

  if (!res.ok) {
    window.location.href = "/login.html";
    return;
  }

  const user = await res.json();

  document.getElementById("profileName").textContent =
    user.name || "Unnamed User";

  document.getElementById("profileEmail").textContent =
    user.email || "";

  if (user.avatar) {
    document.getElementById("profilePicPreview").src = user.avatar;
  }
}

document
  .getElementById("profilePic")
  .addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById("profilePicPreview").src =
      URL.createObjectURL(file);

    const form = new FormData();
    form.append("avatar", file);

    await fetch("/api/profile", {
      method: "POST",
      credentials: "include",
      body: form
    });
  });

loadProfile();
