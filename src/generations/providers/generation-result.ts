/** Resultado comum de qualquer provider de geração: URLs no S3 + modelo usado. */
export interface GenerationResult {
  outputUrls: string[];
  modelUsed: string;
}
