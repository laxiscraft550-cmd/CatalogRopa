'use strict';

// Si ya hay sesión, ir directo al panel
api('/api/me').then((r) => { if (r.admin) location.href = '/admin/panel.html'; }).catch(() => {});

document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const errBox = document.querySelector('.js-error');
  errBox.style.display = 'none';
  try {
    await api('/api/login', { method: 'POST', body: { username: form.get('username'), password: form.get('password') } });
    location.href = '/admin/panel.html';
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
});
