/**
 * Configuração e Utilitários de Multi-Tenancy (SaaS Fase 1)
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

/**
 * Retorna o organization_id atual ou o fallback do tenant matriz.
 */
export function resolveTenantId(currentOrgId?: string | null): string {
  if (currentOrgId && currentOrgId.trim().length > 0) {
    return currentOrgId;
  }
  return DEFAULT_TENANT_ID;
}
