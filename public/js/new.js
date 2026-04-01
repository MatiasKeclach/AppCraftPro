// ------------------ Estado global ------------------
const state = {
  theme: localStorage.getItem("theme") || "dark",
  section: "create",
  user: window.APP_USER || { username: "Invitado", role: "Usuario" }
};

// ------------------ Funciones de tema ------------------
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  localStorage.setItem("theme", state.theme);
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
}

// ------------------ Navegación de secciones ------------------
function navigate(section) {
  state.section = section;
  renderContent();
}

// ------------------ Layout principal ------------------
function renderLayout() {
  document.body.innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <div class="logo">⚡ AppCraft</div>
        <nav>
          <button onclick="navigate('create')">Crear usuario</button>
          <button onclick="navigate('roles')">Roles</button>
          <button onclick="navigate('permissions')">Permisos</button>
          <button onclick="navigate('edit')">Editar usuarios</button>
        </nav>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="menu-btn" onclick="toggleSidebar()">☰</button>
          <div class="welcome">
            Bienvenido <b>${state.user.username}</b> — ${state.user.role}
          </div>
          <button class="theme-btn" onclick="toggleTheme()">🌓</button>
        </header>

        <section id="content" class="content"></section>
      </div>
    </div>

    <style>
      /* ------------------ Variables ------------------ */
      :root {
        --bg: #0f172a;
        --panel: #111827;
        --text: #e5e7eb;
        --accent: #22c55e;
      }
      [data-theme="light"] {
        --bg: #f1f5f9;
        --panel: #ffffff;
        --text: #0f172a;
        --accent: #16a34a;
      }

      /* ------------------ Reset ------------------ */
      * { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); }

      /* ------------------ App ------------------ */
      .app { display: flex; min-height: 100vh; }

      /* ------------------ Sidebar ------------------ */
      .sidebar {
        width: 240px;
        background: var(--panel);
        padding: 20px;
        transition: transform .3s;
      }
      .sidebar .logo { font-weight: bold; font-size: 18px; margin-bottom: 20px; }
      .sidebar button {
        display: block; width: 100%; margin: 8px 0; padding: 10px; border: none;
        background: transparent; color: var(--text); text-align: left; cursor: pointer;
        border-radius: 8px; font-size: 14px;
      }
      .sidebar button:hover { background: rgba(255,255,255,.08); }

      /* ------------------ Main ------------------ */
      .main { flex: 1; display: flex; flex-direction: column; }

      /* ------------------ Topbar ------------------ */
      .topbar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 20px; background: var(--panel);
      }
      .menu-btn, .theme-btn {
        background: none; border: none; color: var(--text); font-size: 18px; cursor: pointer;
      }
      .menu-btn { display: none; }

      /* ------------------ Content ------------------ */
      .content { padding: 20px; }
      .card {
        background: var(--panel); padding: 20px; border-radius: 12px; max-width: 600px;
        box-shadow: 0 4px 10px rgba(0,0,0,.1);
      }
      .form-group { margin-bottom: 12px; }
      input, select { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #374151; background: transparent; color: var(--text); }
      .btn { margin-top: 10px; padding: 10px 14px; border: none; border-radius: 8px; background: var(--accent); color: white; cursor: pointer; }

      /* ------------------ Mobile ------------------ */
      @media (max-width: 768px) {
        .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); z-index: 1000; }
        .sidebar.open { transform: translateX(0); }
        .menu-btn { display: block; font-size: 20px; }
      }
    </style>
  `;

  renderContent();
}

// ------------------ Toggle sidebar ------------------
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ------------------ Render contenido según sección ------------------
function renderContent() {
  const c = document.getElementById("content");

  if (state.section === "create") {
    c.innerHTML = `
      <div class="card">
        <h2>Crear usuario</h2>
        <div class="form-group"><input id="username" placeholder="Username" /></div>
        <div class="form-group"><input id="password" type="password" placeholder="Password" /></div>
        <div class="form-group">
          <select id="role">
            <option>superadmin</option>
            <option>admin</option>
            <option>usuario</option>
          </select>
        </div>
        <button class="btn" onclick="createUser()">Crear</button>
        <div id="msg"></div>
      </div>
    `;
  }

  if (state.section === "roles") {
    c.innerHTML = <div class="card"><h2>Gestión de roles</h2>Configurar roles...</div>;
  }

  if (state.section === "permissions") {
    c.innerHTML = <div class="card"><h2>Permisos</h2>Configurar permisos...</div>;
  }

  if (state.section === "edit") {
    c.innerHTML = <div class="card"><h2>Editar usuarios</h2>Listado de usuarios...</div>;
  }
}

// ------------------ Crear usuario ------------------
async function createUser() {
  const data = {
    username: document.getElementById("username").value,
    password: document.getElementById("password").value,
    role: document.getElementById("role").value
  };

  try {
    const res = await fetch("/panel/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const json = await res.json();
    document.getElementById("msg").innerText = json.message || "Usuario creado";
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
  } catch (e) {
    document.getElementById("msg").innerText = "Error al crear usuario";
  }
}

// ------------------ Inicialización ------------------
applyTheme();
renderLayout();