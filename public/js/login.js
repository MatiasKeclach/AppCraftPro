// Toggle de tema
const toggleBtn = document.getElementById("toggleTheme");
toggleBtn.addEventListener("click", () => {
  const body = document.body;
  body.dataset.theme = body.dataset.theme === "light" ? "dark" : "light";
});

// Validación básica del login (puede mejorar con fetch y API)
const loginForm = document.getElementById("loginForm");
loginForm.addEventListener("submit", async (e) => {
  const errorMsg = document.getElementById("loginError");
  errorMsg.textContent = ""; // limpiar errores
});