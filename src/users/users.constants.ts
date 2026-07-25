/**
 * Opções do cadastro de perfil (nicho + contato) exigido no primeiro acesso.
 *
 * Os valores são salvos como texto no banco (não como enum do Postgres) para
 * que novas opções possam ser adicionadas sem migration. O front tem a mesma
 * lista em `lib/onboarding-profile.ts` — as duas precisam andar juntas.
 */

/** Quem o usuário é. Espelha os públicos da estratégia de posicionamento. */
export const PROFILE_TYPES = [
  'SELLER', // vende produtos online (TikTok Shop, marketplaces, loja própria)
  'AFFILIATE', // afiliado / infoprodutos
  'PHOTOGRAPHER', // fotógrafo de produtos
  'SOCIAL_MEDIA', // social media / criador de conteúdo
  'BRAND_AGENCY', // marca, e-commerce ou agência
  'AI_SERVICES', // vende serviços criativos de IA
  'OTHER',
] as const;

/** Nicho em que atua (produto próprio ou dos clientes). */
export const NICHES = [
  'FASHION',
  'BEAUTY',
  'HEALTH',
  'FITNESS',
  'HOME',
  'ELECTRONICS',
  'PET',
  'FOOD',
  'INFOPRODUCT',
  'SERVICES',
  'OTHER',
] as const;

/** Onde vende / publica hoje. */
export const SALES_CHANNELS = [
  'TIKTOK_SHOP',
  'SHOPEE',
  'MERCADO_LIVRE',
  'AMAZON',
  'INSTAGRAM',
  'META_ADS',
  'OWN_STORE',
  'WHATSAPP',
  'NOT_SELLING_YET',
] as const;

/**
 * Opção que abre uma caixa de texto no formulário. Vale para `profileType`
 * (→ `profileTypeOther`) e para `niche` (→ `nicheOther`).
 */
export const OTHER_OPTION = 'OTHER';

/** Limite do texto livre de "Outro". */
export const OTHER_MAX_LENGTH = 60;

export type ProfileType = (typeof PROFILE_TYPES)[number];
export type Niche = (typeof NICHES)[number];
export type SalesChannel = (typeof SALES_CHANNELS)[number];

/** Telefone em E.164: "+" seguido de 8 a 15 dígitos, sem começar em zero. */
export const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/** Handle do Instagram sem "@": letras, números, ponto e underscore. */
export const INSTAGRAM_HANDLE_REGEX = /^[A-Za-z0-9._]{1,30}$/;
