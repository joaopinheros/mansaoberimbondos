# Sistema de Organização da Casa

App simples e sem login para os moradores da casa acompanharem as faxinas e verem avisos importantes. HTML + CSS + JavaScript puro no front-end, Supabase como banco de dados (sem back-end próprio).

## Estrutura do projeto

```
casa-organizada/
├── assets/
│   └── logo.png           # logo da casa (mascote), usada no cabeçalho e favicon
├── css/
│   └── style.css          # design system (tema escuro/dourado, tipografia, componentes)
├── js/
│   ├── supabase.js        # inicializa o cliente do Supabase
│   ├── faxinas.js         # meta semanal, regra dos 3 dias, registrar/histórico
│   ├── avisos.js          # criar/editar/excluir/resolver avisos
│   ├── usuarios.js        # criar/editar/ativar/desativar moradores
│   ├── agenda.js          # agendar dias de faxina, calendário, confirmar feito/não feito
│   ├── ui.js              # toast, iniciais de avatar, tempo relativo, ícones (extra — ver nota abaixo)
│   └── app.js             # controlador da página principal (index.html)
├── pages/
│   ├── index.html         # tela principal ("Quem é você?", avisos, agenda, semana, registro, histórico)
│   ├── agenda.html        # calendário compartilhado para agendar as faxinas
│   ├── usuarios.html      # gerenciar moradores
│   └── avisos.html        # gerenciar avisos
└── database/
    └── schema.sql         # script para criar as tabelas no Supabase
```

> **Nota:** `js/ui.js` não estava na lista original de arquivos, mas foi criado para não repetir as mesmas funções pequenas (toast, iniciais, tempo relativo, ícones) em três páginas diferentes.

## Se você já tinha rodado uma versão anterior

O `database/schema.sql` é seguro rodar de novo do zero — ele só cria o que ainda não existe (`create table if not exists`) e recria as políticas de acesso sem duplicar nada. Basta colar o arquivo inteiro de novo no SQL Editor do Supabase para ganhar a tabela `agendamentos` (usada pela agenda/calendário).


## Passo a passo para colocar no ar

### 1. Criar o projeto no Supabase
Crie um projeto gratuito em [supabase.com](https://supabase.com).

### 2. Rodar o schema do banco
Abra **SQL Editor** no painel do Supabase, cole o conteúdo de `database/schema.sql` e clique em **Run**. Isso cria as 5 tabelas (`usuarios`, `faxinas`, `avisos`, `agendamentos`, `configuracoes`), os índices e as políticas de acesso.

Se quiser já cadastrar os 4 moradores por SQL, descomente a última linha do arquivo e ajuste os nomes.

### 3. Preencher as credenciais
Em **Project Settings > API**, copie a **Project URL** e a **anon public key**, e cole em `js/supabase.js`:

```js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA-CHAVE-ANON-AQUI";
```

### 4. Servir os arquivos com um servidor local
Como as páginas usam módulos JavaScript (`import`/`export`), abrir o `index.html` direto com duplo-clique (`file://`) **não funciona** — o navegador bloqueia por CORS. Use um servidor local simples, por exemplo:

```bash
npx serve casa-organizada
```

ou, com Python:

```bash
cd casa-organizada
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000/pages/index.html` (ou a porta que o `serve` indicar).

### 5. Cadastrar os moradores
Se não cadastrou por SQL, acesse `pages/usuarios.html` e adicione os 4 moradores por lá.

## Como funciona o agendamento

- Em **Agenda** (ou pelo mini-formulário "Agendar meu dia" na tela inicial) qualquer morador marca um dia para fazer a faxina. Isso cria um registro `pendente` — dá pra marcar vários dias diferentes, de pessoas diferentes, já deixando o resto da semana planejado.
- Quando esse dia chega (ou passa) e ninguém confirmou, a tela inicial mostra o card **"Confirme sua faxina agendada"** perguntando se foi feito.
  - **Sim, fiz** → gera um registro em `faxinas` normalmente e some do card.
  - **Não fiz** → pede o motivo e guarda como `nao_realizado`; aparece no histórico como "Fulano não fez a faxina — Motivo: ...".
- Se a pessoa simplesmente clicar em **"Registrar faxina"** no dia (sem passar pela confirmação), o agendamento de hoje é vinculado automaticamente — não fica um agendamento "esquecido" pendurado.
- O calendário (`agenda.html`) mostra o mês inteiro com bolinhas coloridas por morador: dourado = agendado, teal = concluído, vermelho = não realizado. Clicar em um dia abre os detalhes e permite agendar, confirmar ou cancelar.

## Decisões de projeto (bom saber)

- **Semana:** considerada de segunda a domingo (função `getLimitesDaSemana` em `faxinas.js` — fácil de trocar se preferir domingo a sábado).
- **Regra dos 3 dias:** é global (da casa), não por pessoa — depois que qualquer morador registra uma faxina, o botão fica bloqueado para todos até completar o intervalo configurado em `configuracoes.intervalo_dias`.
- **Meta semanal:** também é da casa como um todo (soma de faxinas de todos os moradores), não por pessoa.
- **Agendamento:** um morador só pode ter um agendamento por dia (`unique (usuario_id, data)` no banco) — mas dias diferentes podem ter moradores diferentes agendados, então sempre dá pra deixar um "plano B" já marcado.
- **Sem autenticação:** qualquer pessoa com a URL e a chave anon do seu Supabase consegue ler/escrever nas tabelas. As políticas de acesso (RLS) já vêm configuradas no `schema.sql`, mas não impedem isso — é a troca natural de não ter login. Para 4 pessoas de confiança é geralmente aceitável.
- **Paleta de cores:** tema escuro baseado na logo (mascote) da casa — fundo preto (`#141210`), letras e destaques em dourado vibrante (`#fcc800`, igual ao corpo do mascote), vermelho (`#ff4438`, avisos/urgência/não realizado) e um teal claro extraído do ferrão (`#5fd1c9`, usado para "resolvido/concluído"). Tudo centralizado em variáveis CSS no topo de `style.css`, então dá pra ajustar o tom em um lugar só.
