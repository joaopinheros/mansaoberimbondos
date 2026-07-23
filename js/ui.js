// ============================================================
// ui.js
// Funções pequenas de interface compartilhadas entre index.html,
// usuarios.html e avisos.html: toast de feedback, iniciais para
// avatar e formatação de tempo relativo ("há 2 dias").
//
// Este arquivo não estava na lista original de arquivos, mas foi
// adicionado para evitar repetir as mesmas ~20 linhas em três
// páginas diferentes — se um dia você quiser mudar o visual do
// toast, muda em um lugar só.
// ============================================================

/**
 * Mostra uma notificação temporária no rodapé da tela.
 * tipo: "sucesso" | "erro" | "info"
 */
export function mostrarToast(mensagem, tipo = "info") {
  const existente = document.querySelector(".toast");
  if (existente) existente.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

/**
 * Pega as iniciais de um nome para usar em avatares circulares.
 * "João Pedro" -> "JP", "Ana" -> "A"
 */
export function iniciais(nome) {
  if (!nome) return "?";
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
}

/**
 * Formata uma data em texto relativo simples: "agora mesmo",
 * "há 2 horas", "há 3 dias", ou a data (dd/mm) se for mais antiga.
 */
export function tempoRelativo(dataIso) {
  const data = new Date(dataIso);
  const agora = new Date();
  const diffMs = agora - data;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;

  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return "há 1 dia";
  if (diffDias < 7) return `há ${diffDias} dias`;

  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Formata uma data curta dd/mm para uso em mensagens de bloqueio
 * e no calendário. Datas "puras" (YYYY-MM-DD, sem horário — como
 * as de agendamentos) são lidas direto da string, sem passar por
 * conversão de fuso horário (senão o JavaScript entende a meia-noite
 * como UTC e a data pode "voltar" um dia em fusos negativos como o
 * do Brasil). Datas com horário completo (timestamptz) continuam
 * convertidas normalmente para o fuso local.
 */
export function dataCurta(data) {
  if (typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [, mes, dia] = data.split("-");
    return `${dia}/${mes}`;
  }
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Escapa texto simples antes de inserir via innerHTML, evitando
 * que uma observação ou título com "<" quebre o layout.
 */
export function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// ------------------------------------------------------------
// Ícones simples (traço único, estilo outline), inline em SVG
// para não depender de nenhuma biblioteca externa de ícones.
// ------------------------------------------------------------

const CAMINHOS_ICONE = {
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
  "check-circle":
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 9.01"></polyline>',
  "alert-circle":
    '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
  clock:
    '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
  "edit-2":
    '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>',
  "trash-2":
    '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>',
  "refresh-cw":
    '<polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>',
  target:
    '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
  "arrow-left":
    '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
  "x-circle":
    '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
  "chevron-left": '<polyline points="15 18 9 12 15 6"></polyline>',
  "chevron-right": '<polyline points="9 18 15 12 9 6"></polyline>',
};

/**
 * Retorna o markup SVG de um ícone da coleção acima.
 * Uso: icone("bell", "icon") -> <svg class="icon">...</svg>
 */
export function icone(nome, classe = "icon") {
  const caminho = CAMINHOS_ICONE[nome];
  if (!caminho) return "";
  return `<svg class="${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${caminho}</svg>`;
}
