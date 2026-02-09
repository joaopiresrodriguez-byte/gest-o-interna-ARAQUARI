import React from 'react';

export interface CardProps {
    title?: string;
    icon?: string;
    headerColor?: 'primary' | 'secondary' | 'success' | 'info' | 'warning';
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

/**
 * Componente Card reutilizável com header gradiente opcional
 */
export const Card = React.memo<CardProps>(({
    title,
    icon,
    headerColor = 'primary',
    children,
    className = '',
    noPadding = false
}) => {
    const headerGradients = {
        primary: 'from-rustic-brown to-[#4c2d27]',
        secondary: 'from-gray-700 to-gray-900',
        success: 'from-secondary-green to-green-700',
        info: 'from-blue-600 to-blue-800',
        warning: 'from-amber-500 to-amber-700'
    };

    return (
        <section className={`bg-white rounded-xl shadow-sm border border-rustic-border overflow-hidden ${className}`}>
            {title && (
                <div className={`bg-gradient-to-r ${headerGradients[headerColor]} p-5 text-white flex items-center justify-between`}>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        {icon && <span className="material-symbols-outlined">{icon}</span>}
                        {title}
                    </h3>
                </div>
            )}
            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>
        </section>
    );
});

Card.displayName = 'Card';
