// ============================================================
// usuarios.js
// Lógica de usuários: buscar ativos (para a tela "Quem é você?"),
// criar, editar nome e ativar/desativar (para usuarios.html).
// ============================================================

import { supabaseClient } from "./supabase.js";

/**
 * Usuários ativos, em ordem alfabética. Usado no seletor
 * "Quem é você?" e no "Trocar usuário".
 */
export async function buscarUsuariosAtivos() {
  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar usuários ativos:", error);
    return [];
  }

  return data;
}

/**
 * Todos os usuários (ativos e inativos), usado na página
 * de gerenciamento usuarios.html.
 */
export async function buscarTodosUsuarios() {
  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("id, nome, ativo, created_at")
    .order("ativo", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar usuários:", error);
    return [];
  }

  return data;
}

export async function buscarUsuarioPorId(id) {
  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("id, nome")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar usuário:", error);
    return null;
  }

  return data;
}

export async function criarUsuario(nome) {
  const { error } = await supabaseClient.from("usuarios").insert({
    nome: nome.trim(),
    ativo: true,
  });

  if (error) {
    console.error("Erro ao criar usuário:", error);
    throw error;
  }
}

export async function atualizarUsuario(id, campos) {
  const { error } = await supabaseClient
    .from("usuarios")
    .update(campos)
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar usuário:", error);
    throw error;
  }
}
