/**
 * Mapping des codes de langues ISO-639-1 vers les codes NLLB
 * NLLB utilise des codes spéciaux avec suffixes de script (ex: fra_Latn pour français)
 */

export interface LanguageMapping {
  iso639: string; // Code standard ISO (ex: 'fr')
  nllb: string;   // Code NLLB (ex: 'fra_Latn')
  name: string;   // Nom de la langue
}

/**
 * Mapping complet des langues supportées par NLLB
 * Basé sur la liste officielle de Meta/Facebook NLLB
 */
export const NLLB_LANGUAGE_MAPPING: LanguageMapping[] = [
  // Langues principales supportées par Meeshy
  { iso639: 'fr', nllb: 'fra_Latn', name: 'French' },
  { iso639: 'en', nllb: 'eng_Latn', name: 'English' },
  { iso639: 'es', nllb: 'spa_Latn', name: 'Spanish' },
  { iso639: 'de', nllb: 'deu_Latn', name: 'German' },
  { iso639: 'it', nllb: 'ita_Latn', name: 'Italian' },
  { iso639: 'pt', nllb: 'por_Latn', name: 'Portuguese' },
  { iso639: 'ru', nllb: 'rus_Cyrl', name: 'Russian' },
  { iso639: 'ja', nllb: 'jpn_Jpan', name: 'Japanese' },
  { iso639: 'ko', nllb: 'kor_Hang', name: 'Korean' },
  { iso639: 'zh', nllb: 'zho_Hans', name: 'Chinese (Simplified)' },
  { iso639: 'ar', nllb: 'arb_Arab', name: 'Arabic' },
  { iso639: 'hi', nllb: 'hin_Deva', name: 'Hindi' },
  { iso639: 'tr', nllb: 'tur_Latn', name: 'Turkish' },
  
  // Langues additionnelles courantes
  { iso639: 'nl', nllb: 'nld_Latn', name: 'Dutch' },
  { iso639: 'pl', nllb: 'pol_Latn', name: 'Polish' },
  { iso639: 'sv', nllb: 'swe_Latn', name: 'Swedish' },
  { iso639: 'da', nllb: 'dan_Latn', name: 'Danish' },
  { iso639: 'no', nllb: 'nob_Latn', name: 'Norwegian' },
  { iso639: 'fi', nllb: 'fin_Latn', name: 'Finnish' },
  { iso639: 'el', nllb: 'ell_Grek', name: 'Greek' },
  { iso639: 'he', nllb: 'heb_Hebr', name: 'Hebrew' },
  { iso639: 'th', nllb: 'tha_Thai', name: 'Thai' },
  { iso639: 'vi', nllb: 'vie_Latn', name: 'Vietnamese' },
  { iso639: 'cs', nllb: 'ces_Latn', name: 'Czech' },
  { iso639: 'hu', nllb: 'hun_Latn', name: 'Hungarian' },
  { iso639: 'ro', nllb: 'ron_Latn', name: 'Romanian' },
  { iso639: 'bg', nllb: 'bul_Cyrl', name: 'Bulgarian' },
  { iso639: 'hr', nllb: 'hrv_Latn', name: 'Croatian' },
  { iso639: 'sk', nllb: 'slk_Latn', name: 'Slovak' },
  { iso639: 'sl', nllb: 'slv_Latn', name: 'Slovenian' },
  { iso639: 'et', nllb: 'est_Latn', name: 'Estonian' },
  { iso639: 'lv', nllb: 'lvs_Latn', name: 'Latvian' },
  { iso639: 'lt', nllb: 'lit_Latn', name: 'Lithuanian' },
  { iso639: 'uk', nllb: 'ukr_Cyrl', name: 'Ukrainian' },
  { iso639: 'be', nllb: 'bel_Cyrl', name: 'Belarusian' },
  { iso639: 'ka', nllb: 'kat_Geor', name: 'Georgian' },
  { iso639: 'hy', nllb: 'hye_Armn', name: 'Armenian' },
  { iso639: 'az', nllb: 'azj_Latn', name: 'Azerbaijani' },
  { iso639: 'kk', nllb: 'kaz_Cyrl', name: 'Kazakh' },
  { iso639: 'ky', nllb: 'kir_Cyrl', name: 'Kyrgyz' },
  { iso639: 'uz', nllb: 'uzn_Latn', name: 'Uzbek' },
  { iso639: 'tg', nllb: 'tgk_Cyrl', name: 'Tajik' },
  { iso639: 'mn', nllb: 'khk_Cyrl', name: 'Mongolian' },
  { iso639: 'fa', nllb: 'pes_Arab', name: 'Persian' },
  { iso639: 'ur', nllb: 'urd_Arab', name: 'Urdu' },
  { iso639: 'bn', nllb: 'ben_Beng', name: 'Bengali' },
  { iso639: 'pa', nllb: 'pan_Guru', name: 'Punjabi' },
  { iso639: 'gu', nllb: 'guj_Gujr', name: 'Gujarati' },
  { iso639: 'or', nllb: 'ory_Orya', name: 'Odia' },
  { iso639: 'ta', nllb: 'tam_Taml', name: 'Tamil' },
  { iso639: 'te', nllb: 'tel_Telu', name: 'Telugu' },
  { iso639: 'kn', nllb: 'kan_Knda', name: 'Kannada' },
  { iso639: 'ml', nllb: 'mal_Mlym', name: 'Malayalam' },
  { iso639: 'si', nllb: 'sin_Sinh', name: 'Sinhala' },
  { iso639: 'my', nllb: 'mya_Mymr', name: 'Burmese' },
  { iso639: 'km', nllb: 'khm_Khmr', name: 'Khmer' },
  { iso639: 'lo', nllb: 'lao_Laoo', name: 'Lao' },
  { iso639: 'ka', nllb: 'kat_Geor', name: 'Georgian' },
  { iso639: 'am', nllb: 'amh_Ethi', name: 'Amharic' },
  { iso639: 'ti', nllb: 'tir_Ethi', name: 'Tigrinya' },
  { iso639: 'so', nllb: 'som_Latn', name: 'Somali' },
  { iso639: 'sw', nllb: 'swh_Latn', name: 'Swahili' },
  { iso639: 'yo', nllb: 'yor_Latn', name: 'Yoruba' },
  { iso639: 'ig', nllb: 'ibo_Latn', name: 'Igbo' },
  { iso639: 'ha', nllb: 'hau_Latn', name: 'Hausa' },
  { iso639: 'zu', nllb: 'zul_Latn', name: 'Zulu' },
  { iso639: 'af', nllb: 'afr_Latn', name: 'Afrikaans' },
  { iso639: 'is', nllb: 'isl_Latn', name: 'Icelandic' },
  { iso639: 'mt', nllb: 'mlt_Latn', name: 'Maltese' },
  { iso639: 'cy', nllb: 'cym_Latn', name: 'Welsh' },
  { iso639: 'ga', nllb: 'gle_Latn', name: 'Irish' },
  { iso639: 'gd', nllb: 'gla_Latn', name: 'Scottish Gaelic' },
  { iso639: 'eu', nllb: 'eus_Latn', name: 'Basque' },
  { iso639: 'ca', nllb: 'cat_Latn', name: 'Catalan' },
  { iso639: 'gl', nllb: 'glg_Latn', name: 'Galician' },
  { iso639: 'ast', nllb: 'ast_Latn', name: 'Asturian' },
  { iso639: 'oc', nllb: 'oci_Latn', name: 'Occitan' },
  { iso639: 'br', nllb: 'bre_Latn', name: 'Breton' },
  { iso639: 'co', nllb: 'cos_Latn', name: 'Corsican' },
  { iso639: 'rm', nllb: 'roh_Latn', name: 'Romansh' },
  { iso639: 'lb', nllb: 'ltz_Latn', name: 'Luxembourgish' },
  { iso639: 'fo', nllb: 'fao_Latn', name: 'Faroese' },
  { iso639: 'frr', nllb: 'frr_Latn', name: 'North Frisian' },
  { iso639: 'fy', nllb: 'fry_Latn', name: 'Western Frisian' },
  { iso639: 'yi', nllb: 'yid_Hebr', name: 'Yiddish' },
  { iso639: 'la', nllb: 'lat_Latn', name: 'Latin' },
];

/**
 * Map pour conversion rapide ISO639 -> NLLB
 */
export const ISO_TO_NLLB_MAP = new Map<string, string>(
  NLLB_LANGUAGE_MAPPING.map(mapping => [mapping.iso639, mapping.nllb])
);

/**
 * Map pour conversion rapide NLLB -> ISO639
 */
export const NLLB_TO_ISO_MAP = new Map<string, string>(
  NLLB_LANGUAGE_MAPPING.map(mapping => [mapping.nllb, mapping.iso639])
);

/**
 * Convertit un code ISO639 en code NLLB
 */
export function convertToNLLBCode(iso639Code: string): string {
  const nllbCode = ISO_TO_NLLB_MAP.get(iso639Code);
  if (!nllbCode) {
    throw new Error(`Langue "${iso639Code}" non supportée par NLLB. Langues supportées: ${Array.from(ISO_TO_NLLB_MAP.keys()).join(', ')}`);
  }
  return nllbCode;
}

/**
 * Convertit un code NLLB en code ISO639
 */
export function convertFromNLLBCode(nllbCode: string): string {
  const iso639Code = NLLB_TO_ISO_MAP.get(nllbCode);
  if (!iso639Code) {
    throw new Error(`Code NLLB "${nllbCode}" non reconnu`);
  }
  return iso639Code;
}

/**
 * Vérifie si une langue est supportée par NLLB
 */
export function isLanguageSupportedByNLLB(iso639Code: string): boolean {
  return ISO_TO_NLLB_MAP.has(iso639Code);
}

/**
 * Obtient la liste des langues supportées par NLLB (codes ISO639)
 */
export function getNLLBSupportedLanguages(): string[] {
  return Array.from(ISO_TO_NLLB_MAP.keys());
}

/**
 * Obtient des informations détaillées sur une langue supportée
 */
export function getLanguageInfo(iso639Code: string): LanguageMapping | undefined {
  return NLLB_LANGUAGE_MAPPING.find(mapping => mapping.iso639 === iso639Code);
}
