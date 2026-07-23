-- ============================================================
-- Sistema de Organização da Casa — Schema do banco (Supabase)
--
-- Como usar:
-- 1. Abra seu projeto em https://supabase.com/dashboard
-- 2. Vá em "SQL Editor" > "New query"
-- 3. Cole todo este arquivo e clique em "Run"
-- ============================================================

-- ---------- usuarios ----------
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- faxinas ----------
-- Observação: data e hora foram unificadas em um único campo
-- "data_hora" (timestamptz), o que simplifica bastante as
-- consultas de "semana atual" e "últimos N dias".
create table if not exists faxinas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete set null,
  data_hora timestamptz not null default now(),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists idx_faxinas_data_hora on faxinas (data_hora desc);
create index if not exists idx_faxinas_usuario_id on faxinas (usuario_id);

-- ---------- avisos ----------
create table if not exists avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  resolvido boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_avisos_resolvido on avisos (resolvido);

-- ---------- agendamentos ----------
-- Permite marcar com antecedência qual morador vai fazer a
-- faxina em determinado dia. Quando o dia chega, o app pergunta
-- se foi feito; se não foi, guarda o motivo. "status" controla
-- esse ciclo de vida:
--   pendente      -> agendado, aguardando o dia / confirmação
--   concluido     -> confirmado como feito (gera um registro em "faxinas")
--   nao_realizado -> confirmado como não feito, com "motivo"
create table if not exists agendamentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete set null,
  data date not null,
  status text not null default 'pendente' check (status in ('pendente', 'concluido', 'nao_realizado')),
  motivo text,
  faxina_id uuid references faxinas(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (usuario_id, data)
);

create index if not exists idx_agendamentos_data on agendamentos (data);
create index if not exists idx_agendamentos_usuario_id on agendamentos (usuario_id);

-- ---------- configuracoes ----------
-- Linha única com a meta semanal de faxinas e o intervalo mínimo
-- (regra dos 3 dias). Editar aqui não exige mexer no código.
create table if not exists configuracoes (
  id int primary key default 1,
  meta_semanal int not null default 2,
  intervalo_dias int not null default 3,
  updated_at timestamptz not null default now(),
  constraint configuracoes_linha_unica check (id = 1)
);

insert into configuracoes (id, meta_semanal, intervalo_dias)
values (1, 2, 3)
on conflict (id) do nothing;

-- ============================================================
-- Row Level Security
--
-- Como o app não tem login, ele usa a chave "anon" para ler e
-- escrever diretamente do navegador. As políticas abaixo liberam
-- acesso total a essas 4 tabelas para quem tiver essa chave —
-- ou seja, qualquer um dos 4 moradores, mas também qualquer
-- pessoa que descobrir a URL e a chave do seu projeto. Para uma
-- casa de 4 pessoas de confiança isso costuma ser um risco
-- aceitável; se um dia quiser mais segurança, o próximo passo
-- natural é adicionar autenticação (Supabase Auth) por morador.
-- ============================================================

alter table usuarios enable row level security;
alter table faxinas enable row level security;
alter table avisos enable row level security;
alter table agendamentos enable row level security;
alter table configuracoes enable row level security;

drop policy if exists "acesso total anon" on usuarios;
create policy "acesso total anon" on usuarios
  for all to anon using (true) with check (true);

drop policy if exists "acesso total anon" on faxinas;
create policy "acesso total anon" on faxinas
  for all to anon using (true) with check (true);

drop policy if exists "acesso total anon" on avisos;
create policy "acesso total anon" on avisos
  for all to anon using (true) with check (true);

drop policy if exists "acesso total anon" on agendamentos;
create policy "acesso total anon" on agendamentos
  for all to anon using (true) with check (true);

drop policy if exists "leitura anon" on configuracoes;
create policy "leitura anon" on configuracoes
  for select to anon using (true);

-- ============================================================
-- Dados iniciais (opcional) — descomente e ajuste os nomes para
-- já popular os 4 moradores.
-- ============================================================

-- insert into usuarios (nome) values ('João'), ('Diego'), ('Maria'), ('Ana');
