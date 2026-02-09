import React from 'react';

interface LoadingFallbackProps {
    message?: string;
}

/**
 * Componente de fallback para lazy loading de rotas
 * Exibe um spinner de carregamento enquanto o módulo é carregado
 */
export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    message = 'Carregando módulo...'
}) => {
    return (
        <div className="h-full w-full flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-4">
                <span className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-600 font-bold animate-pulse">{message}</p>
            </div>
        </div>
    );
};

/**
 * Variante menor para loading inline
 */
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({
    size = 'md'
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-3',
        lg: 'w-12 h-12 border-4'
    };

    return (
        <span
            className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin inline-block`}
        />
    );
};
