// ============================================================
// app.js
// Controlador da página principal (index.html): identifica o
// usuário atual, e renderiza avisos, situação da semana,
// registro de faxina e histórico.
// ============================================================

import { buscarUsuariosAtivos, buscarUsuarioPorId } from "./usuarios.js";
import { buscarAvisosAtivos } from "./avisos.js";
import {
  buscarConfiguracoes,
  buscarFaxinasDaSemana,
  podeRegistrarFaxina,
  registrarFaxina,
} from "./faxinas.js";
import {
  hojeSql,
  buscarPendentesVencidos,
  buscarProximosAgendamentos,
  criarAgendamento,
  confirmarAgendamentoFeito,
  confirmarAgendamentoNaoFeito,
  vincularAgendamentoDeHoje,
  buscarHistoricoUnificado,
} from "./agenda.js";
import { mostrarToast, iniciais, tempoRelativo, dataCurta, escapar, icone } from "./ui.js";

const CHAVE_LOCALSTORAGE = "casa_organizada_usuario_id";

let usuarioAtual = null; // { id, nome }

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
      <textarea class="input-observacao" id="input-observacao" placeholder="Observação (opcional). Ex: limpei banheiro e cozinha" rows="2"></textarea>
      <button class="btn btn-primary" id="btn-registrar-faxina">
        ${icone("check-circle")} Registrar faxina
      </button>
    `;

    document.getElementById("btn-registrar-faxina").addEventListener("click", async (ev) => {
      const botao = ev.currentTarget;
      const observacao = document.getElementById("input-observacao").value;

      botao.disabled = true;
      botao.textContent = "Registrando...";

      try {
        const faxinaId = await registrarFaxina(usuarioAtual.id, observacao);
        await vincularAgendamentoDeHoje(usuarioAtual.id, faxinaId);
        mostrarToast("Faxina registrada com sucesso.", "sucesso");
        renderizarSituacaoSemana();
        renderizarRegistroFaxina();
        renderizarProximosAgendamentos();
        renderizarHistorico();
      } catch (err) {
        mostrarToast("Não foi possível registrar a faxina. Tente novamente.", "erro");
        botao.disabled = false;
        botao.innerHTML = `${icone("check-circle")} Registrar faxina`;
      }
    });
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

async function renderizarProximosAgendamentos() {
  const container = document.getElementById("proximos-agendamentos");
  const proximos = await buscarProximosAgendamentos(5);

  if (proximos.length === 0) {
    container.innerHTML = `<div class="estado-vazio">Nenhuma faxina agendada ainda. Marque um dia abaixo.</div>`;
  } else {
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

  const inputData = document.getElementById("input-data-agendamento");
  inputData.min = hojeSql();
  if (!inputData.value) inputData.value = hojeSql();
}

document.addEventListener("click", async (ev) => {
  if (ev.target.closest("#btn-agendar-minha-faxina")) {
    const botao = ev.target.closest("#btn-agendar-minha-faxina");
    const inputData = document.getElementById("input-data-agendamento");
    const dataEscolhida = inputData.value;

    if (!dataEscolhida) {
      mostrarToast("Escolha uma data antes de agendar.", "erro");
      return;
    }

    botao.disabled = true;
    try {
      await criarAgendamento(usuarioAtual.id, dataEscolhida);
      mostrarToast("Faxina agendada.", "sucesso");
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

      return `
        <div class="historico-item">
          <div class="historico-avatar">${iniciais(item.nome)}</div>
          <div class="historico-info">
            <div class="historico-nome">${escapar(item.nome)} fez a faxina</div>
            ${item.observacao ? `<div class="historico-obs">${escapar(item.observacao)}</div>` : ""}
          </div>
          <div class="historico-tempo">${tempoRelativo(item.data)}</div>
        </div>`;
    })
    .join("");
}

iniciar();
