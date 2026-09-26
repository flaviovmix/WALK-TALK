# Nota de saúde do projeto (0 a 10)

Ferramenta de diagnóstico. Não é etapa, não tem "pronto quando", e roda quando alguém quiser saber como o projeto está: antes de retomar depois de meses, antes de abrir pro primeiro usuário, ou quando bateu a sensação de que a casa desarrumou.

**Funciona em qualquer projeto**, tenha ele nascido deste molde ou não. Projeto que nunca viu o molde só vai tirar nota baixa em algumas dimensões, e é exatamente essa a informação.

---

## As três regras de quem aplica

1. **Não corrigir durante a análise.** Vale a mesma regra da Etapa 13: cada achado ganha destino decidido junto com o dono (corrigir já, pegar carona numa etapa, ou entrar na fila de erros). Quem corrige calado no meio da varredura perde a medida e não termina nenhuma das duas coisas.
2. **Nota sem evidência não vale.** Toda nota abaixo de 8 aponta arquivo e linha, ou o comando que provou. "Parece frágil" não é achado.
3. **Medir o que está lá, não o que se lembra.** Ler o código, rodar o que der pra rodar. Impressão de sessão antiga é a principal fonte de nota errada.

---

## As 8 dimensões

Cada uma vale de 0 a 10. O que cada nota significa está na régua do fim.

### 1. Segurança
Segredo versionado (senha, token, chave em arquivo do repo ou em migration). Autorização conferida rota a rota, com o padrão sendo negar. Senha com hash forte. Freio de força bruta no login. Upload validado por assinatura do arquivo, não pelo tipo declarado. Dependência com vulnerabilidade aberta.
**Prova rápida:** buscar por senha e chave no histórico do git; bater três papéis (anônimo, comum, admin) contra uma rota administrativa; conferir o alerta de dependência do repo.

### 2. Teste
Existe arnês rodando por um comando. Ele cobre o caminho crítico: autenticação, salvar com validação recusando, excluir. Roda contra banco de verdade. Bug já corrigido deixou teste que o reproduz.
**Prova rápida:** rodar a suíte. Se não roda por um comando, a nota já começa baixa, porque teste que ninguém consegue rodar não protege ninguém.

### 3. Legibilidade
Função com uma responsabilidade e tamanho que cabe na tela. Nome que dispensa comentário. HTML semântico. CSS e JS em arquivo por componente, não dentro do template. Pasta que um humano entende sem buscar.
**Prova rápida:** contar as funções maiores que ~60 linhas e as linhas de estilo e script inline dentro de template.

### 4. Duplicação
Clone do mesmo padrão (controller, modal, store, formulário, mapeador). Decisão repetida em N lugares: mudar o texto de um aviso comum exige lembrar de quantos arquivos?
**Prova rápida:** escolher um aviso ou uma regra que aparece em vários lugares e contar em quantos arquivos ela mora.

### 5. Banco e dados
Migrations versionadas e nunca editadas depois de aplicadas. Banco novo sobe do zero sem passo manual. Índice nas chaves estrangeiras e nas colunas de busca. Regra de exclusão pensada. Enum do código batendo com a restrição do banco.
**Prova rápida:** recriar o banco do zero. Se precisar de passo manual, a dimensão não passa de 5.

### 6. Deploy e operação
Procedimento de subir escrito e testado. Caminho de volta (rollback) que alguém já usou. Backup rodando, guardado fora da máquina, restaurado ao menos uma vez, com alerta quando falha. Monitoramento que avisa antes do usuário avisar.
**Prova rápida:** perguntar quando foi a última restauração de backup testada. "Nunca" é nota 3 ou menos, porque backup nunca testado não é backup.

### 7. Interface
Sem estouro horizontal nos 4 tamanhos. Acessibilidade: rótulo ligado ao campo, foco visível, alcançável por teclado. Estado vazio tratado. Imagem com dimensão declarada. Política de conteúdo (CSP) ligada.
**Prova rápida:** medir uma página pública e uma de painel num medidor de acessibilidade, e abrir as duas no tamanho de celular.

### 8. Registro
O plano (ou o README) reflete o que existe hoje. Decisões escritas com o porquê. Fila de erros viva. README ensina alguém de fora a subir o projeto do zero.
**Prova rápida:** seguir o README numa máquina limpa, ou ao menos ler se ele menciona os passos que a versão atual precisa.

---

## Como fecha a nota final

Média simples das oito, **com um freio**: se qualquer dimensão ficar em 3 ou menos, a nota final não passa de 5, por mais alto que esteja o resto. Projeto com segredo exposto em produção não é um "8 com uma ressalva", e média sozinha esconde exatamente esse tipo de buraco.

| Nota | O que significa |
|---|---|
| 9-10 | saudável. Dá pra crescer sem medo |
| 7-8 | bom, com dívida conhecida e escrita |
| 5-6 | funciona, mas cada mudança custa mais que devia |
| 3-4 | a casa desarrumou. Precisa de etapa dedicada antes de feature nova |
| 0-2 | risco real de perder dado, vazar dado ou não conseguir mudar |

---

## O que entregar

Uma tabela e três linhas de texto. Nada mais:

```markdown
| # | Dimensão | Nota | O que puxou pra baixo (arquivo:linha) |
|---|---|---|---|
| 1 | Segurança | 4 | senha no repo em V3__seed.sql:12 |
...

**Nota final: X/10** (freio aplicado: sim/não, por qual dimensão)

**As três coisas que mais sobem a nota:** ...
**O que NÃO vale mexer agora:** ...
```

A linha do que não vale mexer agora é tão importante quanto as outras. Varredura sem prioridade vira lista de 40 itens que ninguém ataca, e a casa segue desarrumada com um relatório em cima.

---

## Resultado

**Auditado em:** 26/09/2026

| # | Dimensão | Nota | O que puxou pra baixo (arquivo:linha) |
|---|---|---|---|
| 1 | Segurança | 4 | tudo trafega aberto: `usesCleartextTraffic` ligado (`app.json:30`), o token é pedido por `http://` (`App.js:259`) e entregue ao LiveKit por `ws://` (`App.js:342`), então quem está na mesma Wi-Fi lê o token e entra na sala no lugar da pessoa. Entrar não pede credencial nenhuma, só nome e sala (`App.js:262`), e o nome digitado vira a identidade. A busca automática aceita como servidor qualquer máquina que responda 200 em `:3001/ping` (`App.js:107` e `:149`), então um aparelho intruso na rede do evento pode se passar pelo servidor. `npm audit --package-lock-only` acha 28 vulnerabilidades (2 críticas, `shell-quote` e `tar`; 10 altas, entre elas `ws` e `undici`), quase todas da cadeia de build, 15 delas com correção sem trocar de versão maior. A favor: nenhum segredo no repo nem no histórico (busca por secret, api key, devkey e LIVEKIT_API em `git log -p`: zero); o `config.js:4` guarda só um IP de rede local, mas o repo é público (API do GitHub responde 200). O servidor, que é quem guarda a chave do LiveKit, não está no repo e não pôde ser medido |
| 2 | Teste | 0 | não existe teste: nenhum arquivo de teste, nenhum arnês, e o `package.json:5` não tem script `test` (só `start`, `android`, `ios` e `web`). O único jeito de saber se funciona é gerar o APK e abrir no celular |
| 3 | Legibilidade | 4 | o app inteiro mora num arquivo só, `App.js` com 841 linhas: sete componentes e 288 linhas de estilo (`App.js:554`). Quatro dos sete passam de 60 linhas: `ServerSetupScreen` (`App.js:88`, 149 linhas, mistura a varredura da rede com duas telas), `EntryScreen` (`:245`, 95), `ChatPanel` (`:463`, 90) e `RoomUI` (`:379`, 70); a varredura chega a 9 níveis de recuo (`App.js:132`). Código morto: o `config.js` inteiro não é importado por ninguém (o app monta os endereços sozinho) e o `Zeroconf` é importado e nunca usado (`App.js:28`, `:94`), junto com as duas permissões que só ele pedia (`app.json:39`, `:40`). Nomes de uma letra (`t` em `App.js:106`, `v` em `:45` e `:176`) e 3 estilos inline (`:200`, `:203`, `:282`). A favor: componentes com nome que diz o que são, `StyleSheet` com nome por elemento, e comentário com o porquê em `polyfills.js:1` e `config.js:1` |
| 4 | Duplicação | 5 | a regra "onde fica o servidor" mora em 6 lugares de 2 arquivos: a porta 3001 em `App.js:107`, `:149` e `:248`, a 7880 em `App.js:342`, e de novo em `config.js:6` e `:7`, a cópia morta que ninguém lê; trocar a porta exige lembrar de todos. O teste de `/ping` está escrito duas vezes com comportamentos diferentes (com prazo de 1,5 s em `App.js:106`, sem prazo em `:149`), o cabeçalho título + `StatusBar` se repete nas três telas de entrada (`App.js:161`, `:193`, `:290`) e `entryContainer` e `entryScroll` são quase o mesmo estilo (`App.js:555`, `:562`). Nenhum clone grande chegou ao terceiro |
| 5 | Banco e dados | - | não se aplica: o app não tem banco; guarda só o IP do servidor numa chave do AsyncStorage (`App.js:36`, `:59`) e o chat vive na memória da sala, sem persistir |
| 6 | Deploy e operação | 1 | o sistema não sobe a partir do repo: o app só funciona com um servidor que emite o token em `/join-room` (`App.js:259`) e um LiveKit na 7880 (`App.js:342`), e nenhum dos dois está versionado (`git ls-files` só lista o app; busca por `join-room` em `C:\src` e por `livekit.yaml` em `D:\SRC` não achou nada). A memória do projeto ainda descreve `server/`, `livekit.yaml` e `docker-compose.yml` (`C:\src\.claude\memory\reference_walktalk_projeto.md:7`), que não existem mais. Do lado do app sobram só os perfis de build do `eas.json:7` a `:20`, sem procedimento escrito de gerar e distribuir o APK, sem rollback e sem monitoramento |
| 7 | Interface | 4 | nenhuma propriedade de acessibilidade no app (busca por `accessibilityLabel` e `accessibilityRole` em `App.js`: zero), campos só com placeholder (`App.js:164`, `:294`, `:530`) e quem está falando aparece só como um emoji (`App.js:456`). Contraste reprovado no botão principal: branco sobre o verde do FALANDO dá 2,28:1 (`App.js:811`), o texto de chat vazio 2,50:1 (`:775`) e as dicas cinza sobre branco 3,54:1 em letra 12 (`:625`, `:637`). A lista de participantes e a de servidores são `View` sem rolagem (`App.js:452`, `:203`): com mais gente do que cabe, os nomes somem. Com `edgeToEdgeEnabled` (`app.json:28`) e sem área segura, o topo da sala é um `paddingTop: 60` fixo (`App.js:711`). A favor: estado vazio tratado na busca e no chat (`App.js:217`, `:524`), carregando e botão desabilitado em toda espera, erro explicado em português. Medido por leitura, não no aparelho |
| 8 | Registro | 1 | não há README, plano, decisão escrita nem fila de erros; o `CLAUDE.md` que o índice de repositórios promete (`C:\src\.claude\repositorios-ativos.md:19`) não existe, o que a sessão de 24/09 já tinha notado (`C:\src\.claude\sessoes\2026-09-24\candidatos-a-apagar.md:66`). O `package.json:2` chama o projeto de `mobile`, e o histórico tem 2 commits: o segundo joga 3.044 linhas de uma vez com a mensagem "backup pre-format ... sem remote", que já não é verdade (`master` igual ao `origin/master`). A favor: os comentários de `config.js:1` e `polyfills.js:1` dizem o porquê |

**Nota final: 2,7/10** (freio aplicado: sim, por Teste (0), Deploy (1) e Registro (1), mas a média já fica abaixo do teto de 5; é a média das 7 dimensões que se aplicam, com Banco de fora)

**As três coisas que mais sobem a nota:** trazer o servidor para dentro do repo (o código do `/join-room`, o `livekit.yaml` e o compose, reescritos se o original se perdeu na formatação), com a chave do LiveKit num `.env` ignorado desde o primeiro commit e um README que ensine a subir o servidor e gerar o APK, o que tira Deploy e Registro do fundo de uma vez; um arnês mínimo por `npm test`, começando pelo servidor emitindo e recusando token e pela lógica de entrar na sala tirada de dentro dos componentes; e fechar a porta da sala: uma senha do evento no `/join-room`, a identidade decidida pelo servidor e não pelo nome digitado, o servidor reconhecido por algo além de um 200 no `/ping`, e o `npm audit fix` das 15 que não pedem versão maior.

**O que NÃO vale mexer agora:** subir o Expo para a 57 só para zerar o audit, porque os alertas que sobram são da cadeia de build, não rodam no celular, e troca de versão maior em app com WebRTC nativo quebra fácil; pôr TLS na rede local antes de o servidor existir no repo; e caçar contraste, acessibilidade, o `config.js` morto e o `Zeroconf` um a um: tudo isso vai de carona quando o `App.js` for partido em telas, que é quando esses estilos e imports vão ser reescritos de qualquer jeito.
