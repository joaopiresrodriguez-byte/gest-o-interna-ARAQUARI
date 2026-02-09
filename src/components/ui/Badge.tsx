import React from 'react';

export interface BadgeProps {
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    children: React.ReactNode;
    className?: string;
    icon?: string;
}

/**
 * Componente Badge reutilizável para status e tags
 */
export const Badge = React.memo<BadgeProps>(({
    variant = 'neutral',
    children,
    className = '',
    icon
}) => {
    const variantClasses = {
        success: 'bg-secondary-green/10 text-secondary-green border-secondary-green/20',
        warning: 'bg-amber-50 text-amber-700 border-amber-100',
        danger: 'bg-red-50 text-red-700 border-red-100',
        info: 'bg-blue-50 text-blue-700 border-blue-100',
        neutral: 'bg-gray-100 text-gray-700 border-gray-200'
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${variantClasses[variant]} ${className}`}>
            {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
            {children}
        </span>
    );
});

Badge.displayName = 'Badge';
