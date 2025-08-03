/**
 * Types générés pour le service de traduction gRPC
 * Compatible avec nice-grpc
 */

// Messages de requête
export interface TranslateRequest {
  text: string;
  source_language: string;
  target_language: string;
}

export interface TranslateMultipleRequest {
  text: string;
  source_language: string;
  target_languages: string[];
}

export interface DetectLanguageRequest {
  text: string;
}

export interface SupportedLanguagesRequest {}

export interface ServiceStatsRequest {}

export interface HealthCheckRequest {
  service: string;
}

// Messages de réponse
export interface TranslateResponse {
  translated_text: string;
  detected_source_language: string;
  confidence_score: number;
  model_tier: string;
  processing_time_ms: number;
  from_cache: boolean;
}

export interface TranslationResult {
  target_language: string;
  translated_text: string;
  confidence_score: number;
  model_tier: string;
  processing_time_ms: number;
  from_cache: boolean;
}

export interface TranslateMultipleResponse {
  translations: TranslationResult[];
  detected_source_language: string;
}

export interface DetectLanguageResponse {
  detected_language: string;
  confidence_score: number;
  complexity_score: number;
  recommended_model_tier: string;
}

export interface SupportedLanguagesResponse {
  languages: string[];
}

export interface ServiceStatsResponse {
  cache_size: number;
  supported_languages_count: number;
  models_loaded_count: number;
  device_info: string;
  service_ready: boolean;
}

export enum HealthCheckStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  SERVICE_UNKNOWN = 3,
}

export interface HealthCheckResponse {
  status: HealthCheckStatus;
  message: string;
}

// Définition du service pour nice-grpc
export interface TranslationService {
  translateText(request: TranslateRequest): Promise<TranslateResponse>;
  translateMultiple(request: TranslateMultipleRequest): Promise<TranslateMultipleResponse>;
  detectLanguage(request: DetectLanguageRequest): Promise<DetectLanguageResponse>;
  getSupportedLanguages(request: SupportedLanguagesRequest): Promise<SupportedLanguagesResponse>;
  getServiceStats(request: ServiceStatsRequest): Promise<ServiceStatsResponse>;
}

export interface HealthCheck {
  check(request: HealthCheckRequest): Promise<HealthCheckResponse>;
}

// Définition complète pour nice-grpc
export const TranslationServiceDefinition = {
  name: 'translation.TranslationService',
  fullName: 'translation.TranslationService',
  methods: {
    translateText: {
      name: 'TranslateText',
      requestType: Object as any, // TranslateRequest
      responseType: Object as any, // TranslateResponse
      options: {},
    },
    translateMultiple: {
      name: 'TranslateMultiple',
      requestType: Object as any, // TranslateMultipleRequest
      responseType: Object as any, // TranslateMultipleResponse
      options: {},
    },
    detectLanguage: {
      name: 'DetectLanguage',
      requestType: Object as any, // DetectLanguageRequest
      responseType: Object as any, // DetectLanguageResponse
      options: {},
    },
    getSupportedLanguages: {
      name: 'GetSupportedLanguages',
      requestType: Object as any, // SupportedLanguagesRequest
      responseType: Object as any, // SupportedLanguagesResponse
      options: {},
    },
    getServiceStats: {
      name: 'GetServiceStats',
      requestType: Object as any, // ServiceStatsRequest
      responseType: Object as any, // ServiceStatsResponse
      options: {},
    },
  },
} as const;

export const HealthCheckDefinition = {
  name: 'translation.HealthCheck',
  fullName: 'translation.HealthCheck',
  methods: {
    check: {
      name: 'Check',
      requestType: Object as any, // HealthCheckRequest
      responseType: Object as any, // HealthCheckResponse
      options: {},
    },
  },
} as const;
