import { supabase } from './supabase';

/**
 * Erro customizado para operações de serviço
 */
export class ServiceError extends Error {
    constructor(
        message: string,
        public readonly originalError?: unknown,
        public readonly code?: string
    ) {
        super(message);
        this.name = 'ServiceError';
    }
}

/**
 * Resposta paginada genérica
 */
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * Opções para queries paginadas
 */
export interface PaginationOptions {
    page?: number;
    pageSize?: number;
}

/**
 * Opções para queries com filtros
 */
export interface QueryOptions extends PaginationOptions {
    orderBy?: string;
    ascending?: boolean;
}

/**
 * Serviço base genérico para operações CRUD
 * Elimina código duplicado em todos os serviços
 */
export class BaseService<T> {
    constructor(
        protected readonly tableName: string,
        protected readonly selectFields: string = '*'
    ) { }

    /**
     * Buscar todos os registros com paginação opcional
     */
    async getAll(options?: QueryOptions): Promise<T[] | PaginatedResponse<T>> {
        try {
            let query = supabase
                .from(this.tableName)
                .select(this.selectFields, { count: 'exact' });

            // Ordenação
            if (options?.orderBy) {
                query = query.order(options.orderBy, {
                    ascending: options.ascending ?? true,
                });
            }

            // Paginação
            if (options?.page && options?.pageSize) {
                const from = (options.page - 1) * options.pageSize;
                const to = from + options.pageSize - 1;
                query = query.range(from, to);
            }

            const { data, error, count } = await query;

            if (error) {
                throw new ServiceError(
                    `Erro ao buscar ${this.tableName}`,
                    error,
                    error.code
                );
            }

            // Se tem paginação, retorna resposta paginada
            if (options?.page && options?.pageSize) {
                return {
                    data: (data as T[]) || [],
                    total: count || 0,
                    page: options.page,
                    pageSize: options.pageSize,
                    totalPages: Math.ceil((count || 0) / options.pageSize),
                };
            }

            return (data as T[]) || [];
        } catch (error) {
            if (error instanceof ServiceError) throw error;
            throw new ServiceError(
                `Erro inesperado ao buscar ${this.tableName}`,
                error
            );
        }
    }

    /**
     * Buscar registro por ID
     */
    async getById(id: string | number): Promise<T | null> {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select(this.selectFields)
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Não encontrado
                }
                throw new ServiceError(
                    `Erro ao buscar ${this.tableName} por ID`,
                    error,
                    error.code
                );
            }

            return data as T;
        } catch (error) {
            if (error instanceof ServiceError) throw error;
            throw new ServiceError(
                `Erro inesperado ao buscar ${this.tableName} por ID`,
                error
            );
        }
    }

    /**
     * Criar novo registro
     */
    async create(data: Partial<T>): Promise<T> {
        try {
            const { data: created, error } = await supabase
                .from(this.tableName)
                .insert(data)
                .select(this.selectFields)
                .single();

            if (error) {
                throw new ServiceError(
                    `Erro ao criar ${this.tableName}`,
                    error,
                    error.code
                );
            }

            return created as T;
        } catch (error) {
            if (error instanceof ServiceError) throw error;
            throw new ServiceError(
                `Erro inesperado ao criar ${this.tableName}`,
                error
            );
        }
    }

    /**
     * Atualizar registro existente
     */
    async update(id: string | number, data: Partial<T>): Promise<T> {
        try {
            const { data: updated, error } = await supabase
                .from(this.tableName)
                .update(data)
                .eq('id', id)
                .select(this.selectFields)
                .single();

            if (error) {
                throw new ServiceError(
                    `Erro ao atualizar ${this.tableName}`,
                    error,
                    error.code
                );
            }

            return updated as T;
        } catch (error) {
            if (error instanceof ServiceError) throw error;
            throw new ServiceError(
                `Erro inesperado ao atualizar ${this.tableName}`,
                error
            );
        }
    }

    /**
     * Deletar registro
     */
    async delete(id: string | number): Promise<void> {
        try {
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('id', id);

            if (error) {
                throw new ServiceError(
                    `Erro ao deletar ${this.tableName}`,
                    error,
                    error.code
                );
            }
        } catch (error) {
            if (error instanceof ServiceError) throw error;
            throw new ServiceError(
                `Erro inesperado ao deletar ${this.tableName}`,
                error
            );
        }
    }

    /**
     * Buscar com filtros customizados
     */
    async query(
        filters: Record<string, unknown>,
        options?: QueryOptions
    ): Promise<T[] | PaginatedResponse<T>> {
        try {
            let query = supabase
                .from(this.tableName)
                .select(this.selectFields, { count: 'exact' });

            // Aplicar filtros
            Object.entries(filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });

            // Ordenação
            if (options?.orderBy) {
                query = query.order(options.orderBy, {
                    ascending: options.ascending ?? true,
                });
            }

            // Paginação
            if (options?.page && options?.pageSize) {
                const from = (options.page - 1) * options.pageSize;
                const to = from + options.pageSize - 1;
                query = query.range(from, to);
            }

            const { data, error, count } = await query;

            if (error) {
                throw new ServiceError(
                    `Erro ao buscar ${this.tableName} com filtros`,
                    error,
                    error.code
                );
            }

            // Se tem paginação, retorna resposta paginada
            if (options?.page && options?.pageSize) {
                return {
                    data: (data as T[]) || [],
                    total: count || 0,
                    page: options.page,
                    pageSize: options.pageSize,
                    totalPages: Math.ceil((count || 0) / options.pageSize),
                };
            }

            return (data as T[]) || [];
        } catch (error) {
            if (error instanceof ServiceError) throw error;
            throw new ServiceError(
                `Erro inesperado ao buscar ${this.tableName} com filtros`,
                error
            );
        }
    }

    /**
     * Contar registros com filtros opcionais
     */
    async count(filters?: Record<string, unknown>): Promise<number> {
        try {
            let query = supabase
                .from(this.tableName)
                .select('*', { count: 'exact', head: true });

            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    query = query.eq(key, value);
                });
            }

            const { count, error } = await query;

            if (error) {
                throw new ServiceError(
                    `Erro ao contar ${this.tableName}`,
                    error,
                    error.code
                );
            }

            return count || 0;
        } catch (error) {
            if (error instanceof ServiceError) throw error;
            throw new ServiceError(
                `Erro inesperado ao contar ${this.tableName}`,
                error
            );
        }
    }
}

/**
 * Helper para criar instâncias de serviço
 */
export function createService<T>(
    tableName: string,
    selectFields?: string
): BaseService<T> {
    return new BaseService<T>(tableName, selectFields);
}
