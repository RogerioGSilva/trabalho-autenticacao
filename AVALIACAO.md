Avaliação: GitHub Actions

Repositório: https://github.com/RogerioGSilva/trabalho-autenticacao Trabalho individual. Banco D1: oauth-sessions-rogerio. Workflows em .github/workflows/: ci.yml, revisao-ia.yml e migrar.yml.

Nenhum segredo foi colocado em arquivo versionado, log ou comentário. Os tokens (COPILOT_PAT, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID) existem apenas como repository secrets.

Tarefa 1: CI a cada commit

Workflow: .github/workflows/ci.yml, disparado em todo push e em todo pull_request para a main, com três verificações (segredo versionado, migrações D1 em SQLite local, HTML com htmlhint).

Execução verde: https://github.com/RogerioGSilva/trabalho-autenticacao/actions/runs/38627532222
Execução vermelha (migração com erro de sintaxe): https://github.com/RogerioGSilva/trabalho-autenticacao/actions/runs/38621681497/job/116050511156#step:4:6

Linha do log que mostra o erro:

Run for f in migrations/*.sql; do sqlite3 -bail teste.db < "$f"; done
Parse error near line 1: incomplete input
Error: Process completed with exit code 1.

Depois do commit proposital, o arquivo com erro foi removido e a execução seguinte voltou a ficar verde.

Por que a migração é testada em SQLite antes de chegar ao D1: o D1 é baseado em SQLite, então o CI acusa erros de sintaxe sem tocar no banco de produção, onde um erro só seria descoberto depois de afetar dados reais.

Tarefa 2: proteger a main com o CI

Regra criada em Settings > Rules > Rulesets (proteger-main): exige pull request e o status check verificar, com a lista de bypass vazia.

PR bloqueado (check verificar vermelho, merge desativado) e depois liberado (check verde, merge habilitado): https://github.com/RogerioGSilva/trabalho-autenticacao/pull/1

Saída do git push direto na main, recusado:

remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: Review all repository rules at https://github.com/RogerioGSilva/trabalho-autenticacao/rules?ref=refs%2Fheads%2Fmain
remote:
remote: - Changes must be made through a pull request.
remote:
remote: - Required status check "verificar" is expected.
remote:
To https://github.com/RogerioGSilva/trabalho-autenticacao
 ! [remote rejected] main -> main (push declined due to repository rule violations)
error: failed to push some refs to 'https://github.com/RogerioGSilva/trabalho-autenticacao'
Tarefa 3: revisão de PR por IA

Workflow: .github/workflows/revisao-ia.yml (permissions: contents: read e pull-requests: write), que monta o prompt com o diff, chama actions/ai-inference e publica a resposta como comentário.

PR com o SQL vulnerável e os dois comentários da IA: https://github.com/RogerioGSilva/trabalho-autenticacao/pull/3
1º comentário: apontou a injeção de SQL (risco alto) e sugeriu prepare("... WHERE aluno = ?").bind(nome).
2º comentário (depois da correção com prepare e bind): reconheceu que não há mais concatenação de SQL.
Erro de permissão (sem pull-requests: write)

PR do teste: https://github.com/RogerioGSilva/trabalho-autenticacao/pull/4 Execução: https://github.com/RogerioGSilva/trabalho-autenticacao/actions/runs/38629084807/job/116075739990?pr=4

Run gh pr comment "$PR_NUMBER" --body-file "/tmp/modelResponse--2366-kcLoM945fS3n-.txt"
GraphQL: Resource not accessible by integration (addComment)
Error: Process completed with exit code 1.

Sem a permissão, o GITHUB_TOKEN só lê, e o gh pr comment é recusado. A permissão foi restaurada e o workflow voltou a funcionar.

Item 4: afirmação da IA errada ou irrelevante

No PR #2 (https://github.com/RogerioGSilva/trabalho-autenticacao/pull/2), a revisão da IA disse que o campo model vazio poderia fazer a inferência falhar e recomendou configurar um modelo suportado. Isso não se confirmou: com model: '' o workflow passou e o comentário foi publicado. O que de fato falhou foi o modelo padrão da ação, gpt-4.1 (Model "gpt-4.1" from --model flag is not available), então seguir o conselho poderia reintroduzir o erro. No PR #3, a IA também classificou como "alto" a falta de autenticação em notas.js, mas ela só viu o diff, e não o resto do projeto (que já tem login e sessões), e isso estava fora do que o prompt pediu. A IA raciocina sobre o diff e sobre suposições genéricas, enquanto quem confere o comportamento real é o CI e quem executa o workflow.

Tarefa 4: migrações D1 depois do merge

Workflow: .github/workflows/migrar.yml, disparado em push na main apenas quando migrations/** muda.

PR que adicionou o workflow (merge sem tocar em migrations/, sem execução do migrar): https://github.com/RogerioGSilva/trabalho-autenticacao/pull/5
PR da migração 0002_adiciona_coluna.sql (passou pelo CI e pela revisão da IA): https://github.com/RogerioGSilva/trabalho-autenticacao/pull/6
Execução do migrar disparada pelo merge: https://github.com/RogerioGSilva/trabalho-autenticacao/actions/runs/38728499700/job/116400149914

Trecho do log:

Migrations to be applied:
│ 0001_esquema_inicial.sql │
│ 0002_adiciona_coluna.sql │
...
│ 0001_esquema_inicial.sql │ ✅ │
│ 0002_adiciona_coluna.sql │ ✅ │

Saída de npx wrangler d1 execute oauth-sessions-rogerio --remote --command "PRAGMA table_info(notas)":

┌─────┬───────┬─────────┬─────────┬────────────┬────┐
│ cid │ name  │ type    │ notnull │ dflt_value │ pk │
├─────┼───────┼─────────┼─────────┼────────────┼────┤
│ 0   │ id    │ INTEGER │ 0       │ null       │ 1  │
├─────┼───────┼─────────┼─────────┼────────────┼────┤
│ 1   │ aluno │ TEXT    │ 1       │ null       │ 0  │
├─────┼───────┼─────────┼─────────┼────────────┼────┤
│ 2   │ nota  │ REAL    │ 1       │ null       │ 0  │
├─────┼───────┼─────────┼─────────┼────────────┼────┤
│ 3   │ turma │ TEXT    │ 0       │ null       │ 0  │
└─────┴───────┴─────────┴─────────┴────────────┴────┘
Segundo merge, sem tocar em migrations/
PR (adiciona CHANGELOG.md): https://github.com/RogerioGSilva/trabalho-autenticacao/pull/7
Página do workflow migrar, com uma única execução (a do PR #6), sem nenhuma depois do merge do PR #7: https://github.com/RogerioGSilva/trabalho-autenticacao/actions/workflows/migrar.yml
Perguntas

1. O ci.yml roda duas vezes quando faço push numa ramificação com PR aberto. Por quê, e qual das duas o status check da main considera?

O workflow tem dois gatilhos: push (qualquer ramificação) e pull_request (para a main). Um push numa ramificação com PR aberto dispara os dois eventos, então aparecem duas execuções. As duas publicam um check com o mesmo nome, verificar, no commit do PR, e a regra da main exige que esse check esteja verde, de modo que uma execução vermelha com esse nome bloqueia o merge. A do pull_request é a mais relevante, porque testa o resultado da combinação do PR com a main.

2. Por que um PR vindo de um fork não consegue usar secrets.COPILOT_PAT? Qual ataque essa regra impede?

Num PR de fork, o código do workflow vem de quem fez o fork, que pode ser qualquer pessoa. Se os segredos do repositório de destino fossem entregues a esse workflow, um atacante poderia abrir um PR que altera o workflow para imprimir ou enviar o segredo para fora. A regra impede esse roubo de segredos, e por isso o GitHub não entrega segredos (e deixa o token somente leitura) em pull_request vindo de fork.

3. Por que o workflow da Tarefa 3 declara permissions em vez de usar as permissões padrão do GITHUB_TOKEN?

Para seguir o princípio do menor privilégio: declarando contents: read e pull-requests: write, o token só pode ler o código e comentar em PRs, e nada além disso. As permissões padrão podem ser mais amplas, dependendo da configuração do repositório, e se um passo fosse comprometido ou tivesse um erro, o estrago possível seria maior. Na prática, vi o efeito ao remover pull-requests: write: o comentário falhou com Resource not accessible by integration.

4. A revisão da IA pode substituir o status check da Tarefa 2? Justifique com o que você observou no item 4 da Tarefa 3.

Não. O status check é determinístico e obrigatório: no PR #1, o verificar vermelho bloqueou o merge. A revisão da IA é só um comentário, não bloqueia nada, e pode errar: no PR #2 ela sugeriu que o model vazio poderia falhar, o que não aconteceu, e no PR #3 ela julgou a autenticação sem ver o resto do projeto. A IA ajuda como segunda opinião, mas quem decide se o código pode entrar na main precisa ser uma verificação automática e reproduzível.