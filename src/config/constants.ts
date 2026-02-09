/**
 * Constantes da Aplicação
 * Centraliza todos os valores mágicos e configurações
 */

// =====================================================
// PAGINAÇÃO
// =====================================================
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,
    MATERIAS_PAGE_SIZE: 10,
    PERSONNEL_PAGE_SIZE: 20,
    MISSIONS_PAGE_SIZE: 15,
} as const;

// =====================================================
// VERSÃO DA APLICAÇÃO
// =====================================================
export const APP_VERSION = '1.7.0';
export const APP_NAME = 'Sistema Rural BM';
export const APP_SUBTITLE = 'AI HYBRID';

// =====================================================
// DELAYS E TIMEOUTS
// =====================================================
export const DELAYS = {
    AI_MOCK_DELAY_MS: 1500,
    TOAST_DURATION_MS: 3000,
    DEBOUNCE_SEARCH_MS: 300,
    AUTO_SAVE_DELAY_MS: 2000,
} as const;

// =====================================================
// LIMITES DE UPLOAD
// =====================================================
export const UPLOAD_LIMITS = {
    MAX_FILE_SIZE_MB: 50,
    MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
    MAX_VIDEO_SIZE_MB: 500,
    MAX_VIDEO_SIZE_BYTES: 500 * 1024 * 1024,
    ALLOWED_PDF_TYPES: ['application/pdf'],
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
} as const;

// =====================================================
// SUPABASE BUCKETS
// =====================================================
export const STORAGE_BUCKETS = {
    PRESENTATIONS: 'apresentacoes',
    VIDEOS: 'videos',
    SSCI_DOCUMENTS: 'ssci-documents',
    PERSONNEL_DOCS: 'personnel-documents',
    PRODUCT_RECEIPTS: 'product-receipts',
} as const;

// =====================================================
// ROTAS
// =====================================================
export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    AVISOS: '/avisos',
    OPERACIONAL: '/operacional',
    PESSOAL: '/pessoal',
    INSTRUCAO: '/instrucao',
    LOGISTICA: '/logistica',
    SOCIAL: '/social',
    SSCI: '/ssci',
} as const;

// =====================================================
// PERMISSÕES
// =====================================================
export const PERMISSIONS = {
    READER: 'reader' as const,
    EDITOR: 'editor' as const,
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// =====================================================
// STATUS
// =====================================================
export const MISSION_STATUS = {
    SCHEDULED: 'agendada',
    IN_PROGRESS: 'em_andamento',
    COMPLETED: 'concluida',
    CANCELLED: 'cancelada',
} as const;

export const MISSION_PRIORITY = {
    LOW: 'baixa',
    MEDIUM: 'media',
    HIGH: 'alta',
    URGENT: 'urgente',
} as const;

export const PERSONNEL_STATUS = {
    ACTIVE: 'ATIVO',
    VACATION: 'FÉRIAS',
    TRAINING: 'EM CURSO',
} as const;

export const VEHICLE_STATUS = {
    ACTIVE: 'active',
    DOWN: 'down',
    MAINTENANCE: 'maintenance',
} as const;

// =====================================================
// CORES DO TEMA
// =====================================================
export const THEME_COLORS = {
    PRIMARY: '#d81818',
    PRIMARY_DARK: '#b01010',
    SECONDARY_GREEN: '#2e7d32',
    FOREST: '#2e5c3e',
    FOREST_DARK: '#1f422b',
    RUSTIC_BROWN: '#5d4037',
    STATUS_GOOD: '#2e7d32',
    STATUS_BAD: '#d32f2f',
    STATUS_WARN: '#ed6c02',
} as const;

// =====================================================
// MENSAGENS PADRÃO
// =====================================================
export const MESSAGES = {
    LOADING: 'Carregando...',
    SAVING: 'Salvando...',
    SUCCESS: 'Operação realizada com sucesso!',
    ERROR_GENERIC: 'Ocorreu um erro. Tente novamente.',
    ERROR_NETWORK: 'Erro de conexão. Verifique sua internet.',
    ERROR_PERMISSION: 'Você não tem permissão para esta ação.',
    CONFIRM_DELETE: 'Tem certeza que deseja excluir?',
    NO_DATA: 'Nenhum dado encontrado.',
} as const;

// =====================================================
// VALIDAÇÕES
// =====================================================
export const VALIDATION = {
    MIN_PASSWORD_LENGTH: 6,
    MIN_DESCRIPTION_LENGTH: 10,
    MAX_DESCRIPTION_LENGTH: 1000,
    MIN_PROTOCOL_LENGTH: 3,
    EMAIL_REGEX: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/,
    PHONE_REGEX: /^\(\d{2}\) \d{4,5}-\d{4}$/,
} as const;

// =====================================================
// API CONFIGURATION
// =====================================================
export const API_CONFIG = {
    GEMINI_TIMEOUT_MS: 30000,
    SUPABASE_TIMEOUT_MS: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
} as const;

// =====================================================
// CACHE
// =====================================================
export const CACHE_CONFIG = {
    AI_RESPONSE_TTL_MS: 3600000, // 1 hora
    QUERY_CACHE_TTL_MS: 300000,  // 5 minutos
    MAX_CACHE_SIZE: 100,
} as const;
