import { TenantSettings } from '../services/types';

/**
 * Configuração e Utilitários de Multi-Tenancy (SaaS Fase 1 & 2)
 * 
 * Fornece os identificadores canônicos e valores de fallback
 * para garantir compatibilidade retroativa com zero downtime.
 */

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_TENANT_SLUG = 'cbmsc-araquari';

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  planTier: 'starter' | 'pro' | 'enterprise';
  isActive: boolean;
}

export const DEFAULT_TENANT_CONTEXT: TenantContext = {
  id: DEFAULT_TENANT_ID,
  slug: DEFAULT_TENANT_SLUG,
  name: 'Corpo de Bombeiros Militar de Araquari - CBMSC',
  planTier: 'enterprise',
  isActive: true,
};

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  organization_id: DEFAULT_TENANT_ID,
  unit_name: 'Corpo de Bombeiros Militar de Santa Catarina',
  station_name: 'Araquari',
  primary_color: '#b91c1c',
  secondary_color: '#78350f',
  logo_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhhkhZqDlWCkshTqvj49ObzKfPKSTNrk8jLEZpSAaoyFHhzejl3L6l_g1NZkZ1gen8Ccn-QS-xmIystBvz0nu1WNiaYjR6bzF-KWFnnv8i2Urv0at8T9f6Hg63iDrqbXlk8h3V7o8n_Vmv3XOVphoOEnBGSIDkK--xG2SN7JQLLCSPmxhXDvnN0uylpKXjNigsF67qeaR9VnBDdq5rdbRO6xnEAV-CFm-cpQjJrc9-a2p3GCLfDptK5_wDNtMtVoHgBNvUPuycbYU',
};

/**
 * Retorna o organization_id atual ou o fallback do tenant matriz.
 */
export function resolveTenantId(currentOrgId?: string | null): string {
  if (currentOrgId && currentOrgId.trim().length > 0) {
    return currentOrgId;
  }
  return DEFAULT_TENANT_ID;
}
