// ============================================================
// agenda.js
// Lógica de agendamento: marcar com antecedência quem vai fazer
// a faxina em qual dia, buscar dados para o calendário, confirmar
// se foi feito (gera uma faxina) ou não (guarda o motivo), e
// montar um histórico unificado (faxinas feitas + não realizadas).
// ============================================================

import { supabaseClient } from "./supabase.js";
import { buscarHistorico } from "./faxinas.js";
import { buscarMapaUsuarios } from "./usuarios.js";

/**
 * Formata um objeto Date como "YYYY-MM-DD" (o formato que a
 * coluna `data` do Postgres espera), sem depender de fuso horário.
 */
export function paraDataSql(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Retorna a data de hoje em "YYYY-MM-DD", ignorando o horário.
 */
export function hojeSql() {
  return paraDataSql(new Date());
}

/**
 * Busca todos os agendamentos dentro de um intervalo de datas
 * (inclusive), já com o nome do morador.
 */
export async function buscarAgendamentosEntre(dataInicioSql, dataFimSql) {
  const { data, error } = await supabaseClient
    .from("agendamentos")
    .select("id, usuario_id, data, status, motivo, faxina_id, usuarios(nome)")
    .gte("data", dataInicioSql)
    .lte("data", dataFimSql)
    .order("data", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agendamentos:", error);
    return [];
  }

  return data;
}

/**
 * Agendamentos "pendente" cuja data já passou (ontem ou antes) —
 * usados para perguntar na tela inicial "você fez a faxina?".
 * Se `usuarioId` for informado, filtra só os daquele morador.
 */
export async function buscarPendentesVencidos(usuarioId = null) {
  let query = supabaseClient
    .from("agendamentos")
    .select("id, usuario_id, data, status, usuarios(nome)")
    .eq("status", "pendente")
    .lt("data", hojeSql())
    .order("data", { ascending: true });

  if (usuarioId) {
    query = query.eq("usuario_id", usuarioId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar agendamentos vencidos:", error);
    return [];
  }

  return data;
}

/**
 * Próximos agendamentos "pendente" de hoje em diante (para o
 * card "Próximas faxinas agendadas" da tela inicial).
 */
export async function buscarProximosAgendamentos(limite = 5) {
  const { data, error } = await supabaseClient
    .from("agendamentos")
    .select("id, usuario_id, data, status, usuarios(nome)")
    .eq("status", "pendente")
    .gte("data", hojeSql())
    .order("data", { ascending: true })
    .limit(limite);

  if (error) {
    console.error("Erro ao buscar próximos agendamentos:", error);
    return [];
  }

  return data;
}

/**
 * Cria um novo agendamento (dia + morador responsável).
 */
export async function criarAgendamento(usuarioId, dataSql) {
  const { error } = await supabaseClient.from("agendamentos").insert({
    usuario_id: usuarioId,
    data: dataSql,
    status: "pendente",
  });

  if (error) {
    console.error("Erro ao criar agendamento:", error);
    throw error;
  }
}

/**
 * Cancela (exclui) um agendamento — usado tanto para desmarcar
 * um dia futuro quanto para corrigir um registro por engano.
 */
export async function excluirAgendamento(id) {
  const { error } = await supabaseClient.from("agendamentos").delete().eq("id", id);

  if (error) {
    console.error("Erro ao excluir agendamento:", error);
    throw error;
  }
}

/**
 * Confirma que a faxina agendada FOI feita: cria o registro em
 * "faxinas" (na data agendada) e vincula o agendamento a ele.
 */
export async function confirmarAgendamentoFeito(agendamento, observacao, tarefas = null) {
  const listaTarefas = (tarefas ?? []).filter(Boolean);

  const { data: faxinaCriada, error: erroFaxina } = await supabaseClient
    .from("faxinas")
    .insert({
      usuario_id: agendamento.usuario_id,
      data_hora: new Date(`${agendamento.data}T12:00:00`).toISOString(),
      observacao: observacao?.trim() || null,
      tarefas: listaTarefas.length ? listaTarefas : null,
    })
    .select("id")
    .single();

  if (erroFaxina) {
    console.error("Erro ao registrar faxina do agendamento:", erroFaxina);
    throw erroFaxina;
  }

  const { error: erroAgendamento } = await supabaseClient
    .from("agendamentos")
    .update({ status: "concluido", faxina_id: faxinaCriada.id })
    .eq("id", agendamento.id);

  if (erroAgendamento) {
    console.error("Erro ao atualizar agendamento:", erroAgendamento);
    throw erroAgendamento;
  }
}

/**
 * Confirma que a faxina agendada NÃO foi feita, com o motivo.
 */
export async function confirmarAgendamentoNaoFeito(agendamentoId, motivo) {
  const { error } = await supabaseClient
    .from("agendamentos")
    .update({ status: "nao_realizado", motivo: motivo?.trim() || "Sem motivo informado" })
    .eq("id", agendamentoId);

  if (error) {
    console.error("Erro ao registrar não realização:", error);
    throw error;
  }
}

/**
 * Se hoje já existir um agendamento "pendente" para este morador,
 * vincula ele à faxina que acabou de ser registrada (evita deixar
 * o agendamento do dia "esquecido" quando a pessoa só clica em
 * "Registrar faxina" direto, sem passar pela confirmação).
 */
export async function vincularAgendamentoDeHoje(usuarioId, faxinaId) {
  const { data, error } = await supabaseClient
    .from("agendamentos")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("data", hojeSql())
    .eq("status", "pendente")
    .maybeSingle();

  if (error || !data) return;

  await supabaseClient
    .from("agendamentos")
    .update({ status: "concluido", faxina_id: faxinaId })
    .eq("id", data.id);
}

/**
 * Agendamentos marcados como "não realizado" (mais recentes
 * primeiro). Se `desdeIso` for informado, filtra a partir dessa data.
 */
export async function buscarNaoRealizados(desdeIso = null, limite = 500) {
  let query = supabaseClient
    .from("agendamentos")
    .select("id, data, motivo, usuario_id, usuarios(nome)")
    .eq("status", "nao_realizado")
    .order("data", { ascending: false })
    .limit(limite);

  if (desdeIso) {
    query = query.gte("data", desdeIso.slice(0, 10));
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar não realizados:", error);
    return [];
  }

  return data;
}

/**
 * Dado o array de uuids `participantes` de uma faxina, devolve os
 * nomes correspondentes usando o mapa { id: nome }. Ignora quem
 * não estiver no mapa.
 */
export function nomesDosParticipantes(participantes, mapaUsuarios) {
  return (participantes ?? [])
    .map((id) => mapaUsuarios[id])
    .filter(Boolean);
}

/**
 * Histórico unificado: junta faxinas feitas com agendamentos
 * marcados como "não realizado", ordenado por data (mais recente
 * primeiro). Cada item tem um campo `tipo`: "feita" ou "nao_realizada".
 */
export async function buscarHistoricoUnificado(limite = 10) {
  const [feitas, naoFeitas, mapaUsuarios] = await Promise.all([
    buscarHistorico(limite),
    buscarNaoRealizados(null, limite),
    buscarMapaUsuarios(),
  ]);

  const itensFeitos = feitas.map((f) => ({
    tipo: "feita",
    id: f.id,
    data: f.data_hora,
    nome: f.usuarios?.nome ?? "Morador removido",
    observacao: f.observacao,
    tarefas: f.tarefas ?? [],
    participantesIds: f.participantes ?? [],
    participantes: nomesDosParticipantes(f.participantes, mapaUsuarios),
  }));

  const itensNaoFeitos = (naoFeitas ?? []).map((n) => ({
    tipo: "nao_realizada",
    data: n.data,
    nome: n.usuarios?.nome ?? "Morador removido",
    motivo: n.motivo,
  }));

  return [...itensFeitos, ...itensNaoFeitos]
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, limite);
}
