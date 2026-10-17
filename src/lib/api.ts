import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Categoria, Conta, ContaArquivoTipo, ContaInput, ImportacaoContas, InventarioItem, InventarioItemInput } from "./types";
import { CONTA_ARQUIVO_LABEL, CONTA_ARQUIVO_PREFIXO, fmt, nomePdfConta, validateContaArquivo } from "./contasCompute";
import { clampQtd, nextCodigo } from "./inventario";
import { juntarPartes } from "./contasPdf";
import { nomeCategoria, separarDuplicadas } from "./contasPlanilha";
import { arquivoUrls } from "./arquivos";

/* =====================================================================
   Camada de dados do painel — versão de demonstração.
   Tudo fica em memória no navegador, com dados fictícios: não há backend,
   login nem variáveis de ambiente. Recarregar a página volta ao estado
   inicial. Para ligar um backend de verdade, troque o corpo destas funções
   por chamadas à sua API mantendo as mesmas assinaturas (os componentes
   só conhecem este módulo).
   ===================================================================== */

const pausa = () => new Promise((r) => setTimeout(r, 150));
const novoId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/* ---- Dados fictícios ---- */

const CATEGORIAS = ["Aluguel", "Energia", "Água", "Internet", "Telefone", "Contabilidade", "Material de Escritório", "Seguro", "Impostos", "Manutenção"];

/** [categoria, beneficiário, identificação, dia, valor] — repetidas em cada mês da demo. */
const CONTAS_MENSAIS: [string, string, string, number, number][] = [
  ["Aluguel", "Imobiliária Horizonte", "Sala 2", 5, 4800],
  ["Energia", "Companhia de Luz Exemplo", "Inst. 0012345", 10, 612.37],
  ["Água", "Saneamento Modelo", "Matrícula 98765", 12, 189.9],
  ["Internet", "NetFibra Demo", "Plano 500MB", 15, 149.9],
  ["Telefone", "Telefonia Fictícia", "Linha comercial", 15, 89.9],
  ["Contabilidade", "Escritório Contábil Alfa", "Honorários", 20, 950],
  ["Seguro", "Seguradora Exemplo", "Apólice 4521", 22, 320.45],
  ["Impostos", "Receita Federal (exemplo)", "DAS Simples", 20, 1734.12],
];

/** "yyyy-mm" de `delta` meses a partir do mês atual (0 = este mês). */
function mesRelativo(delta: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** A demo mostra os dois meses anteriores e o atual. */
const MESES_DEMO = [mesRelativo(-2), mesRelativo(-1), mesRelativo(0)];

/** Contas avulsas de cada mês da demo (pela posição em MESES_DEMO). */
const EXTRAS: [string, string, string, number, number, string][][] = [
  [["Manutenção", "Refrigeração Polar", "Ar-condicionado", 18, 450, "Revisão semestral"]],
  [["Material de Escritório", "Papelaria Central", "NF 3321", 8, 276.8, ""]],
  [
    ["Material de Escritório", "Papelaria Central", "NF 3410", 9, 198.5, ""],
    ["Manutenção", "Hidráulica Express", "Vazamento banheiro", 25, 380, "Orçamento aprovado"],
  ],
];

/** Status coerente com "hoje" (meses passados pagos; no mês atual, vencidas antes de hoje ficam atrasadas ou pagas). */
function statusSeed(vencimento: string, i: number): { status: string; dataDebito: string } {
  const hoje = new Date().toISOString().slice(0, 10);
  if (vencimento.slice(0, 7) < hoje.slice(0, 7)) return { status: "Pago", dataDebito: vencimento };
  if (vencimento < hoje) return i % 3 === 0 ? { status: "Atrasado", dataDebito: "" } : { status: "Pago", dataDebito: vencimento };
  return { status: "Em Aberto", dataDebito: "" };
}

function seedContas(): Conta[] {
  const contas: Conta[] = [];
  MESES_DEMO.forEach((mes, m) => {
    const linhas = [...CONTAS_MENSAIS.map(([c, b, id, d, v]) => [c, b, id, d, v, ""] as const), ...EXTRAS[m]];
    linhas.forEach(([categoria, beneficiario, identificacao, dia, valor, observacoes], i) => {
      const vencimento = `${mes}-${String(dia).padStart(2, "0")}`;
      contas.push({
        id: novoId(),
        categoria,
        beneficiario,
        identificacao,
        vencimento,
        ...statusSeed(vencimento, i),
        saida: fmt(valor),
        observacoes,
        boleto: null,
        comprovante: null,
        pdf: null,
      });
    });
  });
  return contas;
}

/** [produto, categoria, quantidade, unidade, mínimo, localização] */
const ITENS: [string, string, number, string, number, string][] = [
  ["Papel A4 (resma 500 fls)", "Escritório", 24, "pct", 10, "Almoxarifado - Prateleira 1"],
  ["Caneta esferográfica azul", "Escritório", 3, "cx", 4, "Almoxarifado - Gaveta 2"],
  ["Grampeador de mesa", "Escritório", 6, "un", 2, "Almoxarifado - Prateleira 1"],
  ["Toner impressora laser", "Informática", 0, "un", 2, "Sala de TI"],
  ["Mouse sem fio", "Informática", 7, "un", 3, "Sala de TI"],
  ["Cabo HDMI 2m", "Informática", 2, "un", 4, "Sala de TI"],
  ["Notebook reserva", "Eletrônicos", 1, "un", 1, "Sala de TI - Armário"],
  ["Pilha AA (pacote com 4)", "Eletrônicos", 12, "pct", 5, "Almoxarifado - Gaveta 3"],
  ["Detergente 500ml", "Limpeza", 18, "un", 10, "Depósito de limpeza"],
  ["Papel toalha (fardo)", "Limpeza", 4, "pct", 6, "Depósito de limpeza"],
  ["Álcool 70% 1L", "Limpeza", 0, "un", 4, "Depósito de limpeza"],
  ["Caixa de papelão média", "Embalagens", 40, "un", 20, "Expedição"],
  ["Fita adesiva transparente", "Embalagens", 8, "rol", 10, "Expedição"],
  ["Plástico bolha", "Embalagens", 2.5, "rol", 2, "Expedição"],
  ["Café em grãos 1kg", "Copa", 5, "kg", 3, "Copa - Armário"],
  ["Copo descartável 200ml", "Copa", 1, "pct", 5, "Copa - Armário"],
  ["Chave de fenda (jogo)", "Ferramentas", 3, "un", 1, "Manutenção"],
  ["Extintor de incêndio", "Segurança", 4, "un", 4, "Corredor principal"],
  ["Cadeira de escritório", "Mobiliário", 2, "un", 1, "Depósito"],
  ["Camiseta da equipe M", "Uniformes", 9, "un", 5, "Almoxarifado - Prateleira 4"],
];

function seedInventario(): InventarioItem[] {
  const itens: InventarioItem[] = [];
  for (const [produto, categoria, quantidade, unidade, estoqueMinimo, localizacao] of ITENS) {
    const codigo = nextCodigo(categoria, itens.map((i) => i.codigo));
    itens.push({ id: novoId(), codigo, produto, categoria, quantidade, unidade, estoqueMinimo, localizacao, observacoes: "" });
  }
  return itens;
}

/* ---- PDFs de exemplo ---- */

async function pdfExemplo(titulo: string, conta: Conta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const pagina = doc.addPage([595.28, 841.89]);
  pagina.drawText(titulo.toUpperCase(), { x: 50, y: 770, size: 22, font: negrito, color: rgb(0.1, 0.1, 0.1) });
  pagina.drawText("Documento fictício — apenas para demonstração", { x: 50, y: 745, size: 11, font: fonte, color: rgb(0.6, 0.1, 0.1) });
  const linhas = [`Beneficiário: ${conta.beneficiario}`, `Identificação: ${conta.identificacao}`, `Vencimento: ${conta.vencimento.split("-").reverse().join("/")}`, `Valor: ${conta.saida.replace(/ /g, " ")}`];
  linhas.forEach((l, i) => pagina.drawText(l, { x: 50, y: 700 - i * 22, size: 13, font: fonte }));
  return doc.save();
}

/* ---- Estado ---- */

interface Estado {
  contas: Conta[];
  categorias: Categoria[];
  inventario: InventarioItem[];
  /** PDF de cada parte enviada, por "<contaId>/<tipo>" (para juntar e separar de novo). */
  bytes: Map<string, Uint8Array>;
}

let estado: Promise<Estado> | null = null;

function carregar(): Promise<Estado> {
  if (!estado) {
    estado = (async () => {
      const e: Estado = {
        contas: seedContas(),
        categorias: CATEGORIAS.map((nome) => ({ id: novoId(), nome })),
        inventario: seedInventario(),
        bytes: new Map(),
      };
      // Contas pagas do mês passado já vêm com boleto e comprovante juntos; algumas do mês atual, só com o boleto.
      for (const conta of e.contas.filter((c) => c.vencimento.startsWith(MESES_DEMO[1])).slice(0, 3)) {
        await guardarParte(e, conta, "boleto", await pdfExemplo("Boleto", conta), "boleto.pdf");
        await guardarParte(e, conta, "comprovante", await pdfExemplo("Comprovante de pagamento", conta), "comprovante.pdf");
        await juntar(e, conta);
      }
      for (const conta of e.contas.filter((c) => c.vencimento.startsWith(MESES_DEMO[2]) && c.status === "Em Aberto").slice(0, 2)) {
        await guardarParte(e, conta, "boleto", await pdfExemplo("Boleto", conta), "boleto.pdf");
      }
      return e;
    })();
  }
  return estado;
}

function trocarUrl(chave: string, bytes: Uint8Array | null) {
  const antiga = arquivoUrls.get(chave);
  if (antiga) URL.revokeObjectURL(antiga);
  if (bytes) arquivoUrls.set(chave, URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" })));
  else arquivoUrls.delete(chave);
}

function nomeArquivo(conta: Conta, prefixo: "BOL" | "COMP"): string {
  return nomePdfConta(conta, prefixo) ?? `${prefixo}_${conta.id}.pdf`;
}

async function guardarParte(e: Estado, conta: Conta, tipo: ContaArquivoTipo, bytes: Uint8Array, nomeOriginal: string) {
  e.bytes.set(`${conta.id}/${tipo}`, bytes);
  const { paginas } = await juntarPartes([{ bytes, type: "application/pdf" }], "x");
  if (conta.pdf) {
    // Já juntas: monta de novo o PDF único com a parte nova.
    conta[tipo] = { nome: nomeOriginal, paginas: paginas[0], arquivo: null };
    await juntar(e, conta);
    return;
  }
  const nome = nomeArquivo(conta, CONTA_ARQUIVO_PREFIXO[tipo]);
  trocarUrl(`${conta.id}/${tipo}`, bytes);
  conta[tipo] = { nome: nomeOriginal, paginas: paginas[0], arquivo: { path: `demo/${nome}`, nome } };
}

async function juntar(e: Estado, conta: Conta) {
  const boleto = e.bytes.get(`${conta.id}/boleto`)!;
  const comprovante = e.bytes.get(`${conta.id}/comprovante`)!;
  const nome = nomeArquivo(conta, "BOL");
  const montado = await juntarPartes(
    [
      { bytes: boleto, type: "application/pdf" },
      { bytes: comprovante, type: "application/pdf" },
    ],
    nome.replace(/\.pdf$/, "")
  );
  trocarUrl(`${conta.id}/pdf`, montado.bytes);
  trocarUrl(`${conta.id}/boleto`, null);
  trocarUrl(`${conta.id}/comprovante`, null);
  conta.pdf = { path: `demo/${nome}`, nome };
  conta.boleto = { ...conta.boleto!, arquivo: null };
  conta.comprovante = { ...conta.comprovante!, arquivo: null };
}

function acharConta(e: Estado, id: string): Conta {
  const conta = e.contas.find((c) => c.id === id);
  if (!conta) throw new Error("Conta não encontrada.");
  return conta;
}

/* ---- Contas / Categorias ---- */

export async function getContas(): Promise<Conta[]> {
  const e = await carregar();
  await pausa();
  return copia(e.contas);
}

export async function createConta(input: ContaInput): Promise<Conta> {
  const e = await carregar();
  await pausa();
  const conta: Conta = { ...input, id: novoId(), boleto: null, comprovante: null, pdf: null };
  e.contas.push(conta);
  return copia(conta);
}

export async function updateConta(id: string, patch: Partial<ContaInput>): Promise<Conta> {
  const e = await carregar();
  await pausa();
  const conta = acharConta(e, id);
  Object.assign(conta, patch);
  return copia(conta);
}

export async function uploadContaArquivo(id: string, tipo: ContaArquivoTipo, file: File): Promise<Conta> {
  const e = await carregar();
  const conta = acharConta(e, id);
  const invalido = validateContaArquivo(file);
  if (invalido) throw new Error(invalido);
  // Imagens viram uma página de PDF.
  const { bytes } = await juntarPartes([{ bytes: await file.arrayBuffer(), type: file.type }], CONTA_ARQUIVO_LABEL[tipo]);
  await guardarParte(e, conta, tipo, bytes, file.name);
  return copia(conta);
}

export async function deleteContaArquivo(id: string, tipo: ContaArquivoTipo): Promise<Conta> {
  const e = await carregar();
  await pausa();
  const conta = acharConta(e, id);
  e.bytes.delete(`${conta.id}/${tipo}`);
  conta[tipo] = null;
  trocarUrl(`${conta.id}/${tipo}`, null);
  if (conta.pdf) {
    // Separa: a parte que sobrou volta a ter o próprio arquivo.
    conta.pdf = null;
    trocarUrl(`${conta.id}/pdf`, null);
    const outra: ContaArquivoTipo = tipo === "boleto" ? "comprovante" : "boleto";
    const restante = e.bytes.get(`${conta.id}/${outra}`);
    if (restante && conta[outra]) await guardarParte(e, conta, outra, restante, conta[outra]!.nome);
  }
  return copia(conta);
}

export async function juntarContaArquivos(id: string): Promise<Conta> {
  const e = await carregar();
  const conta = acharConta(e, id);
  if (conta.pdf) throw new Error("Boleto e comprovante já estão juntos.");
  if (!conta.boleto?.arquivo || !conta.comprovante?.arquivo) throw new Error("Anexe o boleto e o comprovante para juntar.");
  await juntar(e, conta);
  return copia(conta);
}

export async function deleteConta(id: string): Promise<{ ok: true }> {
  const e = await carregar();
  await pausa();
  e.contas = e.contas.filter((c) => c.id !== id);
  for (const tipo of ["boleto", "comprovante", "pdf"]) trocarUrl(`${id}/${tipo}`, null);
  return { ok: true };
}

export async function duplicateContasMes(mesOrigem: string, mesDestino: string): Promise<Conta[]> {
  const e = await carregar();
  await pausa();
  const ultimoDia = new Date(Number(mesDestino.slice(0, 4)), Number(mesDestino.slice(5, 7)), 0).getDate();
  const novas = e.contas
    .filter((c) => c.vencimento.startsWith(`${mesOrigem}-`))
    .map<Conta>((c) => ({
      ...c,
      id: novoId(),
      vencimento: `${mesDestino}-${String(Math.min(Number(c.vencimento.slice(8, 10)), ultimoDia)).padStart(2, "0")}`,
      dataDebito: "",
      status: "Em Aberto",
      boleto: null,
      comprovante: null,
      pdf: null,
    }));
  e.contas.push(...novas);
  return copia(novas);
}

export async function importContas(contas: ContaInput[]): Promise<ImportacaoContas> {
  const e = await carregar();
  await pausa();
  const { novas, duplicadas } = separarDuplicadas(contas, e.contas);
  const nomes = e.categorias.map((c) => c.nome);
  const categorias: Categoria[] = [];
  for (const c of novas) {
    c.categoria = nomeCategoria(c.categoria, [...nomes, ...categorias.map((x) => x.nome)]);
    if (!nomes.includes(c.categoria) && !categorias.some((x) => x.nome === c.categoria)) categorias.push({ id: novoId(), nome: c.categoria });
  }
  e.categorias.push(...categorias);
  const importadas = novas.map<Conta>((c) => ({ ...c, id: novoId(), boleto: null, comprovante: null, pdf: null }));
  e.contas.push(...importadas);
  return copia({ importadas, ignoradas: duplicadas.length, categorias });
}

export async function getCategorias(): Promise<Categoria[]> {
  const e = await carregar();
  return copia([...e.categorias].sort((a, b) => a.nome.localeCompare(b.nome, "pt")));
}

export async function createCategoria(nome: string): Promise<Categoria> {
  const e = await carregar();
  await pausa();
  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe o nome da categoria.");
  if (e.categorias.some((c) => c.nome.toLowerCase() === limpo.toLowerCase())) throw new Error("Essa categoria já existe.");
  const categoria = { id: novoId(), nome: limpo };
  e.categorias.push(categoria);
  return copia(categoria);
}

/* ---- Inventário ---- */

export async function getInventario(): Promise<InventarioItem[]> {
  const e = await carregar();
  await pausa();
  return copia([...e.inventario].sort((a, b) => a.codigo.localeCompare(b.codigo)));
}

export async function createInventarioItem(input: InventarioItemInput): Promise<InventarioItem> {
  const e = await carregar();
  await pausa();
  const codigo = nextCodigo(input.categoria, e.inventario.map((i) => i.codigo));
  const item: InventarioItem = { ...input, id: novoId(), codigo, quantidade: clampQtd(input.quantidade), estoqueMinimo: clampQtd(input.estoqueMinimo) };
  e.inventario.push(item);
  return copia(item);
}

export async function updateInventarioItem(id: string, patch: Partial<InventarioItemInput>): Promise<InventarioItem> {
  const e = await carregar();
  await pausa();
  const item = e.inventario.find((i) => i.id === id);
  if (!item) throw new Error("Item não encontrado.");
  Object.assign(item, patch);
  if (patch.quantidade !== undefined) item.quantidade = clampQtd(patch.quantidade);
  if (patch.estoqueMinimo !== undefined) item.estoqueMinimo = clampQtd(patch.estoqueMinimo);
  return copia(item);
}

export async function deleteInventarioItem(id: string): Promise<{ ok: true }> {
  const e = await carregar();
  await pausa();
  e.inventario = e.inventario.filter((i) => i.id !== id);
  return { ok: true };
}
