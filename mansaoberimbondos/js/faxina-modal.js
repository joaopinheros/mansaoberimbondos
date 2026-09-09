// ============================================================
// faxina-modal.js
// Modal compartilhado para editar / excluir uma faxina já
// registrada. Usado tanto pela home (app.js) quanto pela página
// de histórico (historico.html).
// ============================================================

import { TAREFAS, atualizarFaxina, excluirFaxina } from "./faxinas.js";
import { buscarUsuariosAtivos } from "./usuarios.js";
import { mostrarToast, escapar, icone } from "./ui.js";

/**
 * Abre o modal de edição de uma faxina.
 *
 * @param {object} faxina
 *   { id, observacao, tarefas: string[], participantesIds: string[] }
 * @param {function} aoConcluir  chamado após salvar ou excluir
 */
export async function abrirModalEditarFaxina(faxina, aoConcluir) {
  const ativos = await buscarUsuariosAtivos();
  const tarefasSel = new Set(faxina.tarefas ?? []);
  const partsSel = new Set(faxina.participantesIds ?? []);

  const chipsTarefas = TAREFAS.map(
    (t) =>
      `<button type="button" class="chip-toggle${tarefasSel.has(t) ? " ativo" : ""}" data-valor="${escapar(t)}">${escapar(t)}</button>`
  ).join("");

  const chipsAjudantes = ativos
    .map(
      (u) =>
        `<button type="button" class="chip-toggle${partsSel.has(u.id) ? " ativo" : ""}" data-id="${u.id}">${escapar(u.nome)}</button>`
    )
    .join("");

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box modal-registro">
      <h2>Editar faxina</h2>
      <div class="registro-form">
        <div class="registro-campo">
          <span class="registro-label">Cômodos / tarefas</span>
          <div class="chips-selecao" id="ed-tarefas">${chipsTarefas}</div>
        </div>
        <div class="registro-campo">
          <span class="registro-label">Quem fez</span>
          <div class="chips-selecao" id="ed-ajudantes">${chipsAjudantes}</div>
        </div>
        <textarea class="input-observacao" id="ed-obs" rows="2" placeholder="Observação (opcional)">${escapar(faxina.observacao ?? "")}</textarea>
        <div class="modal-acoes">
          <button class="btn btn-danger" id="ed-excluir">${icone("trash-2", "icon-sm")} Excluir</button>
          <button class="btn btn-secondary" id="ed-cancelar">Cancelar</button>
          <button class="btn btn-primary" id="ed-salvar">Salvar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fechar = () => overlay.remove();
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) fechar();
  });
  overlay.querySelector("#ed-cancelar").addEventListener("click", fechar);
  overlay.querySelectorAll(".chip-toggle").forEach((c) => {
    c.addEventListener("click", () => c.classList.toggle("ativo"));
  });

  overlay.querySelector("#ed-salvar").addEventListener("click", async (ev) => {
    const botao = ev.currentTarget;
    botao.disabled = true;
    const tarefas = [...overlay.querySelectorAll("#ed-tarefas .chip-toggle.ativo")].map(
      (c) => c.dataset.valor
    );
    const participantes = [
      ...overlay.querySelectorAll("#ed-ajudantes .chip-toggle.ativo"),
    ].map((c) => c.dataset.id);

    try {
      await atualizarFaxina(faxina.id, {
        observacao: overlay.querySelector("#ed-obs").value,
        tarefas,
        participantes,
      });
      fechar();
      mostrarToast("Faxina atualizada.", "sucesso");
      aoConcluir?.();
    } catch {
      mostrarToast("Não foi possível salvar. Tente novamente.", "erro");
      botao.disabled = false;
    }
  });

  overlay.querySelector("#ed-excluir").addEventListener("click", async (ev) => {
    if (!confirm("Excluir esta faxina? Essa ação não pode ser desfeita.")) return;
    ev.currentTarget.disabled = true;
    try {
      await excluirFaxina(faxina.id);
      fechar();
      mostrarToast("Faxina excluída.", "sucesso");
      aoConcluir?.();
    } catch {
      mostrarToast("Não foi possível excluir. Tente novamente.", "erro");
      ev.currentTarget.disabled = false;
    }
  });
}
