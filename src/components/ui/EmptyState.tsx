import React from 'react';

export interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: string;
    };
    variant?: 'default' | 'minimal' | 'card';
    className?: string;
}

/**
 * Componente EmptyState — padrão único para estados vazios.
 * Substitui os 3+ padrões ad-hoc espalhados pelos módulos.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = 'inbox',
    title,
    description,
    action,
    variant = 'default',
    className = '',
}) => {
    if (variant === 'minimal') {
        return (
            <div className={`flex flex-col items-center justify-center py-8 gap-2 text-center ${className}`}>
                <span className="material-symbols-outlined text-3xl text-gray-300">{icon}</span>
                <p className="text-sm font-semibold text-gray-400">{title}</p>
                {description && <p className="text-xs text-gray-400">{description}</p>}
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col items-center justify-center gap-4 p-10 text-center
                border-2 border-dashed rounded-xl
                ${variant === 'card' ? 'bg-white border-gray-200' : 'border-gray-200 bg-gray-50/50'}
                animate-fade-in ${className}`}
        >
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-gray-400">{icon}</span>
            </div>

            <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-600">{title}</h3>
                {description && (
                    <p className="text-xs text-gray-400 max-w-xs leading-relaxed">{description}</p>
                )}
            </div>

            {action && (
                <button
                    onClick={action.onClick}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg
                        hover:brightness-110 active:scale-[0.97] transition-all duration-150 shadow-sm
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    {action.icon && (
                        <span className="material-symbols-outlined text-[16px]">{action.icon}</span>
                    )}
                    {action.label}
                </button>
            )}
        </div>
    );
};

EmptyState.displayName = 'EmptyState';
