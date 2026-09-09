// ============================================================
// app.js
// Controlador da página principal (index.html): identifica o
// usuário atual, e renderiza avisos, situação da semana,
// registro de faxina e histórico.
// ============================================================

import { buscarUsuariosAtivos, buscarUsuarioPorId } from "./usuarios.js";
import { buscarAvisosAtivos } from "./avisos.js";
import {
  TAREFAS,
  buscarConfiguracoes,
  buscarFaxinasDaSemana,
  podeRegistrarFaxina,
  registrarFaxina,
} from "./faxinas.js";
import { abrirModalEditarFaxina } from "./faxina-modal.js";
import {
  hojeSql,
  paraDataSql,
  buscarAgendamentosEntre,
  buscarPendentesVencidos,
  buscarProximosAgendamentos,
  criarAgendamento,
  confirmarAgendamentoFeito,
  confirmarAgendamentoNaoFeito,
  vincularAgendamentoDeHoje,
  buscarHistoricoUnificado,
} from "./agenda.js";
import {
  mostrarToast,
  iniciais,
  tempoRelativo,
  dataCurta,
  escapar,
  icone,
  chipsTarefas,
  textoParticipantes,
} from "./ui.js";

const CHAVE_LOCALSTORAGE = "casa_organizada_usuario_id";

let usuarioAtual = null; // { id, nome }

// Estado do mini-calendário do card "Próximas faxinas agendadas".
const mesMiniCal = new Date();
mesMiniCal.setDate(1);
let diaSelecionadoAgenda = hojeSql();

// ------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------

async function iniciar() {
  document.getElementById("btn-trocar-usuario").addEventListener("click", () => {
    abrirModalSelecaoUsuario(true);
  });

  const idSalvo = localStorage.getItem(CHAVE_LOCALSTORAGE);

  if (idSalvo) {
    const usuario = await buscarUsuarioPorId(idSalvo);
    if (usuario) {
      usuarioAtual = usuario;
      renderizarTudo();
      return;
    }
    // Usuário salvo não existe mais (ou foi desativado) — limpa e pergunta de novo.
    localStorage.removeItem(CHAVE_LOCALSTORAGE);
  }

  abrirModalSelecaoUsuario(false);
}

/**
 * Abre a tela "Quem é você?". Se `ehTroca` for true, é o botão
 * "Trocar usuário" que chamou (o app já está carregado por trás).
 */
async function abrirModalSelecaoUsuario(ehTroca) {
  const usuarios = await buscarUsuariosAtivos();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modal-selecao-usuario";

  const opcoesHtml = usuarios
    .map(
      (u) => `
        <div class="usuario-opcao" data-id="${u.id}" data-nome="${escapar(u.nome)}">
          <div class="avatar">${iniciais(u.nome)}</div>
          <div class="nome">${escapar(u.nome)}</div>
        </div>`
    )
    .join("");

  const semUsuarios = usuarios.length === 0
    ? `<div class="estado-vazio">Nenhum morador cadastrado ainda. Cadastre em <a href="usuarios.html">Usuários</a>.</div>`
    : "";

  overlay.innerHTML = `
    <div class="modal-box">
      <h2>Quem é você?</h2>
      <p class="subtitle">Selecione seu nome para continuar</p>
      <div class="usuario-grid">${opcoesHtml}</div>
      ${semUsuarios}
      ${ehTroca ? '<button class="btn btn-secondary btn-block" id="btn-cancelar-troca" style="margin-top:14px;">Cancelar</button>' : ""}
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelectorAll(".usuario-opcao").forEach((opcao) => {
    opcao.addEventListener("click", () => {
      usuarioAtual = { id: opcao.dataset.id, nome: opcao.dataset.nome };
      localStorage.setItem(CHAVE_LOCALSTORAGE, usuarioAtual.id);
      overlay.remove();
      renderizarTudo();
    });
  });

  const btnCancelar = document.getElementById("btn-cancelar-troca");
  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => overlay.remove());
  }
}

// ------------------------------------------------------------
// Renderização
// ------------------------------------------------------------

function renderizarTudo() {
  renderizarSaudacao();
  renderizarAvisos();
  renderizarConfirmacaoPendente();
  renderizarSituacaoSemana();
  renderizarRegistroFaxina();
  renderizarMiniCalendario();
  renderizarProximosAgendamentos();
  renderizarHistorico();
}

function renderizarSaudacao() {
  const container = document.getElementById("saudacao");
  container.innerHTML = `
    <h1>Olá, ${escapar(usuarioAtual.nome)} 👋</h1>
    <span class="subtitle">Aqui está o resumo da casa hoje</span>
  `;
}

async function renderizarAvisos() {
  const container = document.getElementById("lista-avisos");
  const avisos = await buscarAvisosAtivos();

  if (avisos.length === 0) {
    container.innerHTML = `<div class="estado-vazio">${icone("check-circle")}<br />Nenhum aviso no momento. Tudo em ordem por aqui.</div>`;
    return;
  }

  container.innerHTML = avisos
    .map(
      (aviso) => `
        <div class="aviso-item">
          <div class="aviso-bullet"></div>
          <div class="aviso-texto">
            <div class="aviso-titulo">${escapar(aviso.titulo)}</div>
            ${aviso.descricao ? `<div class="aviso-descricao">${escapar(aviso.descricao)}</div>` : ""}
          </div>
        </div>`
    )
    .join("");
}

async function renderizarConfirmacaoPendente() {
  const card = document.getElementById("card-confirmacao");
  const container = document.getElementById("lista-confirmacao");
  const vencidos = await buscarPendentesVencidos(usuarioAtual.id);

  if (vencidos.length === 0) {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";
  container.innerHTML = vencidos
    .map(
      (item) => `
        <div class="confirmacao-item" data-id="${item.id}">
          <p class="confirmacao-pergunta">Você tinha faxina agendada para <strong>${dataCurta(item.data)}</strong>. Fez?</p>
          <div class="confirmacao-acoes">
            <button class="btn btn-secondary btn-confirmar-sim">${icone("check-circle")} Sim, fiz</button>
            <button class="btn btn-danger-ghost btn-confirmar-nao">${icone("x-circle")} Não fiz</button>
          </div>
          <div class="confirmacao-motivo" style="display: none;">
            <textarea class="input-observacao" placeholder="Qual foi o motivo?" rows="2"></textarea>
            <button class="btn btn-primary btn-enviar-motivo">Enviar</button>
          </div>
        </div>`
    )
    .join("");

  container.querySelectorAll(".confirmacao-item").forEach((el) => {
    const id = el.dataset.id;
    const agendamento = vencidos.find((v) => v.id === id);

    el.querySelector(".btn-confirmar-sim").addEventListener("click", async (ev) => {
      const botao = ev.currentTarget;
      botao.disabled = true;
      try {
        await confirmarAgendamentoFeito(agendamento, "");
        mostrarToast("Faxina confirmada. Bom trabalho!", "sucesso");
        renderizarConfirmacaoPendente();
        renderizarSituacaoSemana();
        renderizarHistorico();
      } catch {
        mostrarToast("Não foi possível confirmar. Tente novamente.", "erro");
        botao.disabled = false;
      }
    });

    el.querySelector(".btn-confirmar-nao").addEventListener("click", () => {
      el.querySelector(".confirmacao-acoes").style.display = "none";
      el.querySelector(".confirmacao-motivo").style.display = "block";
    });

    el.querySelector(".btn-enviar-motivo").addEventListener("click", async (ev) => {
      const botao = ev.currentTarget;
      const motivo = el.querySelector(".confirmacao-motivo textarea").value;
      botao.disabled = true;
      try {
        await confirmarAgendamentoNaoFeito(id, motivo);
        mostrarToast("Registrado. Sem problemas, acontece.", "sucesso");
        renderizarConfirmacaoPendente();
        renderizarHistorico();
      } catch {
        mostrarToast("Não foi possível registrar. Tente novamente.", "erro");
        botao.disabled = false;
      }
    });
  });
}

async function renderizarSituacaoSemana() {
  const container = document.getElementById("situacao-semana");
  const [faxinasDaSemana, config] = await Promise.all([
    buscarFaxinasDaSemana(),
    buscarConfiguracoes(),
  ]);

  const realizadas = faxinasDaSemana.length;
  const meta = config.meta_semanal;
  const restantes = Math.max(meta - realizadas, 0);
  const completa = restantes === 0;

  container.innerHTML = `
    <div class="semana-status">
      ${criarAnelProgresso(realizadas, meta, completa)}
      <div class="semana-detalhes">
        <div class="semana-numeros">
          <div class="semana-numero">
            <span class="valor">${meta}</span>
            <span class="label">Meta</span>
          </div>
          <div class="semana-numero">
            <span class="valor">${realizadas}</span>
            <span class="label">Realizadas</span>
          </div>
          <div class="semana-numero">
            <span class="valor">${restantes}</span>
            <span class="label">Restantes</span>
          </div>
        </div>
        <div class="status-mensagem ${completa ? "completa" : "pendente"}">
          ${completa
            ? icone("check-circle", "icon") + " Meta da semana concluída"
            : icone("alert-circle", "icon") + ` Ainda ${restantes === 1 ? "falta 1 faxina" : `faltam ${restantes} faxinas`} nesta semana`
          }
        </div>
      </div>
    </div>
  `;
}

/**
 * Monta o SVG do anel de progresso circular da semana.
 */
function criarAnelProgresso(realizadas, meta, completa) {
  const raio = 46;
  const circunferencia = 2 * Math.PI * raio;
  const fracao = meta > 0 ? Math.min(realizadas / meta, 1) : 0;
  const offset = circunferencia * (1 - fracao);

  return `
    <svg class="progress-ring ${completa ? "completa" : ""}" width="104" height="104" viewBox="0 0 104 104">
      <circle class="ring-bg" cx="52" cy="52" r="${raio}"></circle>
      <circle class="ring-fill" cx="52" cy="52" r="${raio}"
        stroke-dasharray="${circunferencia}"
        stroke-dashoffset="${offset}"></circle>
      <text x="52" y="58" text-anchor="middle" class="progress-ring-label">${realizadas}/${meta}</text>
    </svg>
  `;
}

async function renderizarRegistroFaxina() {
  const container = document.getElementById("registro-faxina");
  const status = await podeRegistrarFaxina();

  if (status.permitido) {
    container.innerHTML = `
      <div class="registro-cta">
        <button class="btn btn-primary" id="btn-abrir-registro">
          ${icone("check-circle")} Registrar faxina
        </button>
        <span class="registro-dica">Marque os cômodos e quem ajudou</span>
      </div>
    `;
    document
      .getElementById("btn-abrir-registro")
      .addEventListener("click", abrirModalRegistro);
    return;
  }

  const diaPermitido = dataCurta(status.proximaDataPermitida);
  const textoDias = status.diasFaltando === 1 ? "1 dia" : `${status.diasFaltando} dias`;

  container.innerHTML = `
    <button class="btn btn-primary" disabled>${icone("clock")} Registrar faxina</button>
    <p class="registro-bloqueado">
      A última faxina foi há ${status.diasPassados === 1 ? "1 dia" : `${status.diasPassados} dias`}.
      Aguarde mais ${textoDias} (libera em ${diaPermitido}).
    </p>
  `;
}

/**
 * Abre o modal de registro de faxina: checklist de cômodos, quem
 * ajudou e observação. Só aparece depois que a pessoa clica em
 * "Registrar faxina" — mantém o card do dashboard enxuto.
 */
async function abrirModalRegistro() {
  const ajudantes = (await buscarUsuariosAtivos()).filter((u) => u.id !== usuarioAtual.id);

  const chipsTarefasHtml = TAREFAS.map(
    (t) => `<button type="button" class="chip-toggle" data-valor="${escapar(t)}">${escapar(t)}</button>`
  ).join("");

  const blocoAjudantes = ajudantes.length
    ? `
      <div class="registro-campo">
        <span class="registro-label">Alguém ajudou?</span>
        <div class="chips-selecao" id="chips-ajudantes">
          ${ajudantes
            .map((u) => `<button type="button" class="chip-toggle" data-id="${u.id}">${escapar(u.nome)}</button>`)
            .join("")}
        </div>
      </div>`
    : "";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box modal-registro">
      <h2>Registrar faxina</h2>
      <p class="subtitle">Feito por ${escapar(usuarioAtual.nome)} — agora</p>
      <div class="registro-form">
        <div class="registro-campo">
          <span class="registro-label">O que você limpou?</span>
          <div class="chips-selecao" id="chips-tarefas">${chipsTarefasHtml}</div>
        </div>
        ${blocoAjudantes}
        <textarea class="input-observacao" id="input-observacao" placeholder="Observação (opcional). Ex: passei pano na área" rows="2"></textarea>
        <div class="modal-acoes">
          <button class="btn btn-secondary" id="btn-cancelar-registro">Cancelar</button>
          <button class="btn btn-primary" id="btn-confirmar-registro">${icone("check-circle")} Registrar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const fechar = () => overlay.remove();
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) fechar();
  });
  overlay.querySelector("#btn-cancelar-registro").addEventListener("click", fechar);
  overlay.querySelectorAll(".chip-toggle").forEach((chip) => {
    chip.addEventListener("click", () => chip.classList.toggle("ativo"));
  });

  overlay.querySelector("#btn-confirmar-registro").addEventListener("click", async (ev) => {
    const botao = ev.currentTarget;
    const observacao = overlay.querySelector("#input-observacao").value;
    const tarefas = [...overlay.querySelectorAll("#chips-tarefas .chip-toggle.ativo")].map(
      (c) => c.dataset.valor
    );
    const ajudantesSelecionados = [
      ...overlay.querySelectorAll("#chips-ajudantes .chip-toggle.ativo"),
    ].map((c) => c.dataset.id);

    botao.disabled = true;
    botao.textContent = "Registrando...";

    try {
      const faxinaId = await registrarFaxina(usuarioAtual.id, {
        observacao,
        tarefas,
        participantes: [usuarioAtual.id, ...ajudantesSelecionados],
      });
      await vincularAgendamentoDeHoje(usuarioAtual.id, faxinaId);
      fechar();
      mostrarToast("Faxina registrada com sucesso.", "sucesso");
      renderizarSituacaoSemana();
      renderizarRegistroFaxina();
      renderizarProximosAgendamentos();
      renderizarHistorico();
    } catch (err) {
      mostrarToast("Não foi possível registrar a faxina. Tente novamente.", "erro");
      botao.disabled = false;
      botao.innerHTML = `${icone("check-circle")} Registrar`;
    }
  });
}

async function renderizarProximosAgendamentos() {
  const container = document.getElementById("proximos-agendamentos");
  const proximos = await buscarProximosAgendamentos(5);

  if (proximos.length === 0) {
    container.innerHTML = `<div class="estado-vazio">Nenhuma faxina agendada. Toque num dia acima para marcar.</div>`;
    return;
  }

  container.innerHTML = proximos
    .map((item) => {
      const nome = item.usuarios?.nome ?? "Morador removido";
      return `
        <div class="agendamento-item">
          <div class="historico-avatar">${iniciais(nome)}</div>
          <div class="historico-info">
            <div class="historico-nome">${escapar(nome)}</div>
          </div>
          <div class="historico-tempo">${dataCurta(item.data)}</div>
        </div>`;
    })
    .join("");
}

// ------------------------------------------------------------
// Mini-calendário do card "Próximas faxinas agendadas"
// ------------------------------------------------------------

const NOMES_MES_CURTO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function atualizarRotuloAgendar() {
  const rotulo = document.getElementById("rotulo-agendar");
  if (!rotulo) return;
  rotulo.textContent =
    diaSelecionadoAgenda === hojeSql()
      ? "Agendar meu dia (hoje)"
      : `Agendar para ${dataCurta(diaSelecionadoAgenda)}`;
}

async function renderizarMiniCalendario() {
  const container = document.getElementById("mini-calendario");
  if (!container) return;

  const hoje = hojeSql();
  const primeiroDia = new Date(mesMiniCal.getFullYear(), mesMiniCal.getMonth(), 1);
  const ultimoDia = new Date(mesMiniCal.getFullYear(), mesMiniCal.getMonth() + 1, 0);

  const inicioGrade = new Date(primeiroDia);
  inicioGrade.setDate(inicioGrade.getDate() - inicioGrade.getDay());
  const fimGrade = new Date(ultimoDia);
  fimGrade.setDate(fimGrade.getDate() + (6 - fimGrade.getDay()));

  const agendamentos = await buscarAgendamentosEntre(
    paraDataSql(inicioGrade),
    paraDataSql(fimGrade)
  );
  const porDia = {};
  agendamentos.forEach((a) => {
    (porDia[a.data] ??= []).push(a);
  });

  const celulas = [];
  for (let d = new Date(inicioGrade); d <= fimGrade; d.setDate(d.getDate() + 1)) {
    const dataSql = paraDataSql(d);
    const foraDoMes = d.getMonth() !== mesMiniCal.getMonth();
    const passado = dataSql < hoje;
    const temAgendamento = (porDia[dataSql] || []).length > 0;

    const classes = ["calendario-celula"];
    if (foraDoMes) classes.push("fora-do-mes");
    if (passado) classes.push("passado");
    if (dataSql === hoje) classes.push("hoje");
    if (dataSql === diaSelecionadoAgenda) classes.push("selecionado");

    celulas.push(`
      <div class="${classes.join(" ")}" data-data="${dataSql}" ${passado ? "" : 'role="button" tabindex="0"'}>
        <span class="celula-numero">${d.getDate()}</span>
        ${temAgendamento ? '<span class="mini-cal-dot"></span>' : ""}
      </div>
    `);
  }

  container.innerHTML = `
    <div class="mini-cal-header">
      <button class="btn btn-icon" id="mini-cal-anterior" aria-label="Mês anterior">${icone("chevron-left")}</button>
      <span class="mes-label">${NOMES_MES_CURTO[mesMiniCal.getMonth()]} ${mesMiniCal.getFullYear()}</span>
      <button class="btn btn-icon" id="mini-cal-proximo" aria-label="Próximo mês">${icone("chevron-right")}</button>
    </div>
    <div class="calendario-dias-semana">
      <span class="dia-semana-label">Dom</span><span class="dia-semana-label">Seg</span>
      <span class="dia-semana-label">Ter</span><span class="dia-semana-label">Qua</span>
      <span class="dia-semana-label">Qui</span><span class="dia-semana-label">Sex</span>
      <span class="dia-semana-label">Sáb</span>
    </div>
    <div class="calendario-grid">${celulas.join("")}</div>
  `;

  container.querySelector("#mini-cal-anterior").addEventListener("click", () => {
    mesMiniCal.setMonth(mesMiniCal.getMonth() - 1);
    renderizarMiniCalendario();
  });
  container.querySelector("#mini-cal-proximo").addEventListener("click", () => {
    mesMiniCal.setMonth(mesMiniCal.getMonth() + 1);
    renderizarMiniCalendario();
  });

  container.querySelectorAll(".calendario-celula:not(.passado)").forEach((celula) => {
    const selecionar = () => {
      diaSelecionadoAgenda = celula.dataset.data;
      renderizarMiniCalendario();
      atualizarRotuloAgendar();
    };
    celula.addEventListener("click", selecionar);
    celula.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        selecionar();
      }
    });
  });

  atualizarRotuloAgendar();
}

document.addEventListener("click", async (ev) => {
  if (ev.target.closest("#btn-agendar-minha-faxina")) {
    const botao = ev.target.closest("#btn-agendar-minha-faxina");

    if (!diaSelecionadoAgenda) {
      mostrarToast("Escolha um dia no calendário antes de agendar.", "erro");
      return;
    }

    botao.disabled = true;
    try {
      await criarAgendamento(usuarioAtual.id, diaSelecionadoAgenda);
      mostrarToast("Faxina agendada.", "sucesso");
      renderizarMiniCalendario();
      renderizarProximosAgendamentos();
    } catch (err) {
      if (String(err?.message).includes("duplicate")) {
        mostrarToast("Você já tem uma faxina agendada para esse dia.", "erro");
      } else {
        mostrarToast("Não foi possível agendar. Tente novamente.", "erro");
      }
    } finally {
      botao.disabled = false;
    }
  }
});

async function renderizarHistorico() {
  const container = document.getElementById("lista-historico");
  const historico = await buscarHistoricoUnificado(10);

  if (historico.length === 0) {
    container.innerHTML = `<div class="estado-vazio">Nenhuma faxina registrada ainda.</div>`;
    return;
  }

  container.innerHTML = historico
    .map((item) => {
      if (item.tipo === "nao_realizada") {
        return `
          <div class="historico-item historico-nao-feita">
            <div class="historico-avatar historico-avatar-nao-feita">${iniciais(item.nome)}</div>
            <div class="historico-info">
              <div class="historico-nome">${escapar(item.nome)} não fez a faxina</div>
              <div class="historico-obs">Motivo: ${escapar(item.motivo || "não informado")}</div>
            </div>
            <div class="historico-tempo">${dataCurta(item.data)}</div>
          </div>`;
      }

      const comQuem = textoParticipantes(item.participantes, item.nome);

      return `
        <div class="historico-item" data-faxina-id="${item.id}">
          <div class="historico-avatar">${iniciais(item.nome)}</div>
          <div class="historico-info">
            <div class="historico-nome">${escapar(item.nome)} fez a faxina${comQuem ? ` <span class="historico-com">${escapar(comQuem)}</span>` : ""}</div>
            ${chipsTarefas(item.tarefas)}
            ${item.observacao ? `<div class="historico-obs">${escapar(item.observacao)}</div>` : ""}
          </div>
          <div class="historico-tempo">${tempoRelativo(item.data)}</div>
          <button class="btn btn-icon btn-editar-faxina" title="Editar faxina" aria-label="Editar faxina">${icone("edit-2", "icon-sm")}</button>
        </div>`;
    })
    .join("");

  container.querySelectorAll(".btn-editar-faxina").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.closest(".historico-item").dataset.faxinaId;
      const item = historico.find((h) => h.tipo === "feita" && h.id === id);
      if (!item) return;
      abrirModalEditarFaxina(
        {
          id: item.id,
          observacao: item.observacao,
          tarefas: item.tarefas,
          participantesIds: item.participantesIds,
        },
        renderizarTudo
      );
    });
  });
}

iniciar();
