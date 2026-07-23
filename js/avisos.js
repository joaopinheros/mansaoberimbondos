// ============================================================
// avisos.js
// Toda a lógica de avisos: buscar ativos (para a tela inicial),
// criar, editar, excluir e marcar como resolvido (para avisos.html).
// ============================================================

import { supabaseClient } from "./supabase.js";

/**
 * Avisos não resolvidos, mais recentes primeiro. Usado na
 * página inicial (index.html) para o card "Avisos".
 */
export async function buscarAvisosAtivos() {
  const { data, error } = await supabaseClient
    .from("avisos")
    .select("id, titulo, descricao, created_at")
    .eq("resolvido", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar avisos ativos:", error);
    return [];
  }

  return data;
}

/**
 * Todos os avisos (ativos e resolvidos), usado na página de
 * gerenciamento avisos.html.
 */
export async function buscarTodosAvisos() {
  const { data, error } = await supabaseClient
    .from("avisos")
    .select("id, titulo, descricao, resolvido, created_at")
    .order("resolvido", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar avisos:", error);
    return [];
  }

  return data;
}

export async function criarAviso(titulo, descricao) {
  const { error } = await supabaseClient.from("avisos").insert({
    titulo: titulo.trim(),
    descricao: descricao?.trim() || null,
    resolvido: false,
  });

  if (error) {
    console.error("Erro ao criar aviso:", error);
    throw error;
  }
}

export async function atualizarAviso(id, campos) {
  const { error } = await supabaseClient
    .from("avisos")
    .update(campos)
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar aviso:", error);
    throw error;
  }
}

export async function excluirAviso(id) {
  const { error } = await supabaseClient.from("avisos").delete().eq("id", id);

  if (error) {
    console.error("Erro ao excluir aviso:", error);
    throw error;
  }
}
