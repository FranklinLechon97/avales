(function () {
  const loginView = document.getElementById('loginView');
  const registerView = document.getElementById('registerView');

  document.getElementById('showRegister').addEventListener('click', () => {
    loginView.style.display = 'none';
    registerView.style.display = 'block';
  });
  document.getElementById('showLogin').addEventListener('click', () => {
    registerView.style.display = 'none';
    loginView.style.display = 'block';
  });

  function showMsg(el, text, tipo) {
    el.textContent = text;
    el.className = 'msg show ' + tipo;
  }

  function redirigirPorRol(rol) {
    window.location.href = rol === 'administrador' ? '/admin.html' : '/asesor.html';
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');

    if (!email || !password) {
      showMsg(msg, 'Ingresa tu email y contraseña.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(msg, data.error || 'No se pudo iniciar sesión.', 'error');
        return;
      }
      redirigirPorRol(data.usuario.rol);
    } catch (err) {
      showMsg(msg, 'Error de conexión con el servidor.', 'error');
    }
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('regNombre').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const msg = document.getElementById('registerMsg');

    if (!nombre || !email || !password) {
      showMsg(msg, 'Completa todos los campos.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(msg, data.error || 'No se pudo crear la cuenta.', 'error');
        return;
      }
      redirigirPorRol(data.usuario.rol);
    } catch (err) {
      showMsg(msg, 'Error de conexión con el servidor.', 'error');
    }
  });
})();
