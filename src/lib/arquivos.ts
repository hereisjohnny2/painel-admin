/* URLs (blob:) dos PDFs das contas, por "<contaId>/<boleto|comprovante|pdf>".
   Ficam num módulo sem dependências para api.ts e contasCompute.ts poderem usar. */
export const arquivoUrls = new Map<string, string>();
