fetch("/api/me", { credentials: "same-origin" })
  .then((response) => (response.ok ? response.json() : null))
  .then((user) => {
    const status = document.getElementById("status");
    const loginLinks = document.getElementById("login-links");
    const logoutForm = document.getElementById("logout-form");

    if (user) {
      status.textContent = `Sessão de ${user.email ?? user.displayName ?? "usuário"}.`;
      loginLinks.style.display = "none";
      logoutForm.style.display = "block";
    } else {
      status.textContent = "Nenhuma sessão neste navegador.";
      loginLinks.style.display = "block";
      logoutForm.style.display = "none";
    }
  })
  .catch(() => {
    document.getElementById("status").textContent = "Erro ao consultar a sessão.";
  });