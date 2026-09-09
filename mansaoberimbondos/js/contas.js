// ============================================================
// contas.js
// Lê as contas do mês de uma planilha do Google Sheets e devolve
// { descricao, valor }. O app só EXIBE — quem edita é vocês.
//
// Como acha a aba do mês:
//   Toda aba se chama "Mês - MM/AAAA" (ex: "Mês - 09/2026"). O
//   código monta esse nome com a data de hoje e pede essa aba
//   específica ao Google. Em setembro lê "Mês - 09/2026", em
//   outubro "Mês - 10/2026", e assim por diante — automático.
//
// Como lê os dados:
//   Dentro da aba, pega a faixa INTERVALO (coluna C = nome da
//   conta, coluna D = "Valor da Conta"). Ignora o cabeçalho, o
//   título e a linha "TOTAL".
//
// A leitura é feita via JSONP (<script>), que é como a API
// "Google Visualization" funciona — não sofre bloqueio de CORS.
//
// -------------------- CONFIGURAÇÃO --------------------
// PLANILHA precisa estar: Compartilhar > "Qualquer pessoa com o
// link" > Leitor.
// ============================================================

const PLANILHA_ID = "18ZC2YpynBLxcTFX_67A4dJ7XuSWk-RfH5kRc4n1IZOE";

// Onde ficam as contas dentro de cada aba (C = conta, D = valor).
const INTERVALO = "C1:D40";

// Cabeçalhos / linhas de resumo que NÃO são contas.
const NAO_E_CONTA =
  /^(total|totais|soma|subtotal|valor( da conta| total)?|conta|contas|descri[çc][ãa]o|m[êe]s|controle)\b/i;

/** Nome da aba do mês. Formato: "Mês - 09/2026". */
export function nomeAbaDoMes(data = new Date()) {
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  return `Mês - ${mm}/${data.getFullYear()}`;
}

/** Formatos alternativos de nome de aba, tentados em ordem. */
function variantesDeAba(data = new Date()) {
  const ano = data.getFullYear();
  const ano2 = String(ano).slice(2);
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  const m = String(data.getMonth() + 1);
  return [
    `Mês - ${mm}/${ano}`,
    `Mês - ${m}/${ano}`,
    `Mês - ${mm}/${ano2}`,
    `Mês ${mm}/${ano}`,
    `Mes - ${mm}/${ano}`,
    `${mm}/${ano}`,
  ];
}

export function planilhaConfigurada() {
  return PLANILHA_ID && !PLANILHA_ID.startsWith("COLE_O_ID");
}

export function urlDaPlanilha() {
  return `https://docs.google.com/spreadsheets/d/${PLANILHA_ID}/edit`;
}

// ------------------------------------------------------------
// Leitura (JSONP contra o endpoint gviz do Google)
// ------------------------------------------------------------

function carregarGviz(nome) {
  return new Promise((resolve, reject) => {
    const cb = "__contas_cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");

    const timer = setTimeout(() => {
      limpar();
      reject(new Error("tempo esgotado ao ler a planilha"));
    }, 8000);

    function limpar() {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
    }

    window[cb] = (resp) => {
      limpar();
      resolve(resp);
    };
    script.onerror = () => {
      limpar();
      reject(new Error("não foi possível carregar a planilha"));
    };

    script.src =
      `https://docs.google.com/spreadsheets/d/${PLANILHA_ID}/gviz/tq` +
      `?tqx=${encodeURIComponent("out:json;responseHandler:" + cb)}` +
      `&range=${encodeURIComponent(INTERVALO)}` +
      `&sheet=${encodeURIComponent(nome)}`;
    document.head.appendChild(script);
  });
}

/**
 * Lê uma aba pelo nome.
 * Retorna { encontrada: true, itens } se a aba existe (itens pode ser
 * []), ou { encontrada: false } se o nome não bate.
 * Lança erro se a planilha não responder (offline, ou não está
 * compartilhada publicamente).
 */
async function lerAba(nome) {
  const resp = await carregarGviz(nome); // pode lançar (timeout / bloqueio)
  if (!resp || resp.status === "error") return { encontrada: false };
  return { encontrada: true, itens: extrairContas(resp.table?.rows ?? []) };
}

/**
 * Busca as contas do mês.
 * Retorna { aba, itens: [{ descricao, valor }], total }.
 * Lança erro se a planilha não estiver configurada, não for acessível,
 * ou a aba do mês não for encontrada.
 */
export async function buscarContasDoMes(data = new Date()) {
  if (!planilhaConfigurada()) {
    throw new Error("Planilha de contas ainda não configurada (ver js/contas.js).");
  }

  for (const nome of variantesDeAba(data)) {
    let r;
    try {
      r = await lerAba(nome);
    } catch {
      // A planilha não respondeu — não adianta tentar outros nomes.
      throw new Error(
        'Não consegui abrir a planilha. Ela está compartilhada como "Qualquer pessoa com o link"?'
      );
    }
    if (r.encontrada) {
      const total = r.itens.reduce((s, i) => s + (i.valor || 0), 0);
      return { aba: nome, itens: r.itens, total };
    }
  }

  throw new Error(`Não encontrei a aba "${nomeAbaDoMes(data)}" na planilha.`);
}

// ------------------------------------------------------------
// Parsing das linhas do gviz
// ------------------------------------------------------------

/**
 * Cada linha do gviz é { c: [ {v: valor} | null, ... ] }.
 *   descricao = primeira célula com texto
 *   valor     = primeiro número que aparecer depois dela
 * (assim pegamos "Valor da Conta", não o rateio por morador).
 */
export function extrairContas(rows) {
  const itens = [];

  for (const row of rows) {
    const valores = (row.c ?? []).map((celula) => (celula ? celula.v : null));

    const iDesc = valores.findIndex(
      (v) => typeof v === "string" && v.trim() !== ""
    );
    if (iDesc === -1) continue;

    const descricao = valores[iDesc].trim();
    if (NAO_E_CONTA.test(descricao)) continue;

    let valor = null;
    for (let i = iDesc + 1; i < valores.length; i++) {
      const v = valores[i];
      if (typeof v === "number" && Number.isFinite(v)) {
        valor = v;
        break;
      }
      const p = parseValor(v);
      if (p != null) {
        valor = p;
        break;
      }
    }
    if (valor == null) continue;

    itens.push({ descricao, valor });
  }

  return itens;
}

/** "R$ 1.234,56" / "1234.56" -> número. null se não achar número. */
export function parseValor(texto) {
  if (texto == null) return null;
  let s = String(texto).replace(/[^\d.,-]/g, "").trim();
  if (!s) return null;

  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  } else if (temPonto && s.split(".").length > 2) {
    s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Formata um número como moeda brasileira (R$ 1.234,56). */
export function formatarReais(n) {
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
