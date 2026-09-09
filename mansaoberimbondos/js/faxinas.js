// ============================================================
// faxinas.js
// Toda a lógica de negócio de faxinas: configurações (meta
// semanal + regra dos dias), cálculo da semana atual, registro
// de novas faxinas e busca de histórico.
// ============================================================

import { supabaseClient } from "./supabase.js";

// Cache simples em memória para não buscar a configuração toda hora.
let _configCache = null;

/**
 * Cômodos/tarefas que aparecem como checklist na hora de registrar
 * uma faxina. É só editar esta lista para mudar as opções — não
 * precisa mexer no banco (a coluna `faxinas.tarefas` guarda texto
 * livre em array).
 */
export const TAREFAS = [
  "Cozinha",
  "Banheiro",
  "Sala",
  "Quartos",
  "Área de serviço",
  "Quintal",
  "Lixo",
  "Louça",
];

/**
 * Busca a linha única de configurações (meta_semanal, intervalo_dias).
 * Se a tabela ainda não tiver nenhuma linha, usa um padrão razoável
 * (2 faxinas por semana, intervalo de 3 dias) para o app não quebrar.
 */
export async function buscarConfiguracoes() {
  if (_configCache) return _configCache;

  const { data, error } = await supabaseClient
    .from("configuracoes")
    .select("meta_semanal, intervalo_dias")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar configurações:", error);
  }

  _configCache = data ?? { meta_semanal: 2, intervalo_dias: 3 };
  return _configCache;
}

/**
 * Calcula o início (segunda-feira, 00:00) e o fim (domingo, 23:59:59)
 * da semana em que a data informada (ou hoje) está.
 *
 * Assumindo semana de segunda a domingo. Se sua casa prefere
 * domingo a sábado, troque o cálculo de `diasDesdeSegunda` abaixo.
 */
export function getLimitesDaSemana(referencia = new Date()) {
  const data = new Date(referencia);
  const diaDaSemana = data.getDay(); // 0 = domingo, 1 = segunda, ...
  const diasDesdeSegunda = (diaDaSemana + 6) % 7; // segunda = 0

  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - diasDesdeSegunda);

  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 7);

  return { inicio, fim };
}

/**
 * Busca todas as faxinas registradas dentro da semana atual
 * (usadas para calcular quantas já aconteceram / faltam).
 */
export async function buscarFaxinasDaSemana() {
  const { inicio, fim } = getLimitesDaSemana();

  const { data, error } = await supabaseClient
    .from("faxinas")
    .select("id, data_hora")
    .gte("data_hora", inicio.toISOString())
    .lt("data_hora", fim.toISOString());

  if (error) {
    console.error("Erro ao buscar faxinas da semana:", error);
    return [];
  }

  return data;
}

/**
 * Busca a faxina mais recente (de qualquer morador), usada para
 * aplicar a regra dos N dias.
 */
export async function buscarUltimaFaxina() {
  const { data, error } = await supabaseClient
    .from("faxinas")
    .select("id, data_hora, usuario_id, usuarios(nome)")
    .order("data_hora", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar última faxina:", error);
    return null;
  }

  return data;
}

/**
 * Compara duas datas ignorando o horário (só ano/mês/dia), que é
 * como o usuário pensa a regra: "registrei dia 10, libera dia 13",
 * não "libera 72h depois".
 */
function diferencaEmDiasCorridos(dataAnterior, dataAtual) {
  const a = new Date(dataAnterior);
  a.setHours(0, 0, 0, 0);
  const b = new Date(dataAtual);
  b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se já é permitido registrar uma nova faxina, de acordo
 * com a última faxina registrada e o intervalo mínimo configurado.
 *
 * Retorna:
 *  { permitido: true }
 *  ou
 *  { permitido: false, diasPassados, diasFaltando, proximaDataPermitida }
 */
export async function podeRegistrarFaxina() {
  const [ultimaFaxina, config] = await Promise.all([
    buscarUltimaFaxina(),
    buscarConfiguracoes(),
  ]);

  if (!ultimaFaxina) {
    return { permitido: true };
  }

  const agora = new Date();
  const diasPassados = diferencaEmDiasCorridos(ultimaFaxina.data_hora, agora);
  const intervalo = config.intervalo_dias;

  if (diasPassados >= intervalo) {
    return { permitido: true };
  }

  const proximaDataPermitida = new Date(ultimaFaxina.data_hora);
  proximaDataPermitida.setHours(0, 0, 0, 0);
  proximaDataPermitida.setDate(proximaDataPermitida.getDate() + intervalo);

  return {
    permitido: false,
    diasPassados,
    diasFaltando: intervalo - diasPassados,
    proximaDataPermitida,
  };
}

/**
 * Registra uma nova faxina para o usuário informado.
 *
 * `dados` aceita:
 *   observacao    -> texto livre (opcional)
 *   tarefas       -> array de cômodos/tarefas marcados (opcional)
 *   participantes -> array de uuids de quem ajudou, incluindo o
 *                    próprio `usuarioId` (opcional)
 *
 * Aceita também uma string no lugar do objeto, tratada como a
 * observação (compatível com chamadas antigas).
 *
 * Retorna o id do registro criado.
 */
export async function registrarFaxina(usuarioId, dados = {}) {
  const { observacao, tarefas, participantes } =
    typeof dados === "string" ? { observacao: dados } : dados;

  const listaTarefas = (tarefas ?? []).filter(Boolean);
  const listaParticipantes = [...new Set([usuarioId, ...(participantes ?? [])])].filter(Boolean);

  const { data, error } = await supabaseClient
    .from("faxinas")
    .insert({
      usuario_id: usuarioId,
      observacao: observacao?.trim() || null,
      data_hora: new Date().toISOString(),
      tarefas: listaTarefas.length ? listaTarefas : null,
      participantes: listaParticipantes.length > 1 ? listaParticipantes : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao registrar faxina:", error);
    throw error;
  }

  return data.id;
}

/**
 * Busca as últimas N faxinas para o histórico, já com o nome do
 * morador (join com usuarios).
 */
export async function buscarHistorico(limite = 10) {
  const { data, error } = await supabaseClient
    .from("faxinas")
    .select("id, data_hora, observacao, tarefas, participantes, usuario_id, usuarios(nome)")
    .order("data_hora", { ascending: false })
    .limit(limite);

  if (error) {
    console.error("Erro ao buscar histórico:", error);
    return [];
  }

  return data;
}

/**
 * Busca as faxinas registradas a partir de uma data (ISO). Usada
 * pela página de histórico dedicada (pages/historico.html), que
 * filtra por morador e agrupa no próprio navegador — o volume é
 * pequeno (uma casa registra poucas faxinas por mês).
 */
export async function buscarHistoricoCompleto(desdeIso = null) {
  let query = supabaseClient
    .from("faxinas")
    .select("id, data_hora, observacao, tarefas, participantes, usuario_id, usuarios(nome)")
    .order("data_hora", { ascending: false })
    .limit(500);

  if (desdeIso) {
    query = query.gte("data_hora", desdeIso);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar histórico completo:", error);
    return [];
  }

  return data;
}
