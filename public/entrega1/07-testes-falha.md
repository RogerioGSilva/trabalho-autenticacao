# Testes de falha

## Caso 1: retorno sem cookie temporário

**Preparação:** Iniciar login Google em janela normal, parar na tela do Google, copiar a URL de autorização, colar em janela privativa (sem o cookie de transação).

**Pedido enviado:** GET para `/oauth/callback/google` sem o cookie `__Host-oauth-tx`.

**Resultado esperado:** A rota de retorno deve recusar a resposta e não criar uma sessão.

**Resultado observado:** HTTP 400 — "Transacao ausente". A sessão não foi criada.

---

## Caso 2: state alterado

**Preparação:** Iniciar login Google, parar na tela do Google (criando transação válida e cookie de transação), abrir nova aba na mesma janela do navegador (mantendo o cookie).

**Pedido enviado:** GET para `/oauth/callback/google?code=codigo-fake&state=valor-diferente-do-salvo`.

**Resultado esperado:** A rota de retorno deve recusar a resposta antes de trocar o código.

**Resultado observado:** HTTP 400 — "State invalido". O código não foi trocado.

---

## Caso 3: reutilização da transação

**Preparação:** Completar um login bem-sucedido até a criação da sessão. Localizar a requisição de retorno (callback) no painel Network e copiar sua URL completa.

**Pedido enviado:** Repetir a mesma requisição GET para `/oauth/callback/google?code=...&state=...` em uma nova aba.

**Resultado esperado:** A transação já foi removida após o primeiro uso; a repetição deve falhar.

**Resultado observado:** HTTP 400 — "Transacao ausente" (o cookie de transação já havia sido expirado pela Function após o uso bem-sucedido, impedindo a reutilização).

---

## Caso 4: sessão expirada

**Preparação:** Sessão válida ativa. Executar no console do D1: `UPDATE sessions SET expires_at = 0;`

**Pedido enviado:** Recarregar a página / consultar `/api/me`.

**Resultado esperado:** `/api/me` deve responder 401.

**Resultado observado:** HTTP 401 (Unauthorized). A sessão foi invalidada e a página voltou ao estado "Nenhuma sessão".

---

## Caso 5: origem inválida na saída

**Preparação:** Sessão válida aberta em URL_BASE. Abrir outra origem (`https://example.com`) em nova aba.

**Pedido enviado:**
```javascript
fetch("https://trabalho-autenticacao.pages.dev/oauth/logout", {
  method: "POST",
  credentials: "include"
});
```
executado no console da aba de `https://example.com`.

**Resultado esperado:** A rota deve recusar a operação; a sessão original deve permanecer válida.

**Resultado observado:** HTTP 403 (Forbidden), bloqueado pela checagem do header Origin na Function de logout (confirmado também pelo bloqueio de CORS reportado pelo navegador).

---

## Caso 6: reutilização do cookie revogado

**Preparação:** Sessão válida ativa. Valor do cookie `__Host-session` copiado manualmente pelas ferramentas de desenvolvedor antes do logout. Logout executado.

**Pedido enviado:** Cookie `__Host-session` restaurado manualmente com o valor copiado; GET para `/api/me`.

**Resultado esperado:** A linha correspondente foi removida do D1; a resposta deve ser 401.

**Resultado observado:** HTTP 401 (Unauthorized). A sessão não foi restaurada.