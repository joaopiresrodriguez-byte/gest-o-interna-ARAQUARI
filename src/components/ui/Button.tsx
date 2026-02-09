import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'warning';
    size?: 'sm' | 'md' | 'lg';
    icon?: string;
    loading?: boolean;
    children: React.ReactNode;
    fullWidth?: boolean;
}

/**
 * Componente Button reutilizável com variantes e tamanhos consistentes
 */
export const Button = React.memo<ButtonProps>(({
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    children,
    fullWidth = false,
    className = '',
    disabled,
    ...props
}) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
        primary: 'bg-primary text-white hover:brightness-110 active:scale-[0.98] shadow-md border-b-4 border-red-800',
        secondary: 'bg-gray-600 text-white hover:bg-gray-700 active:scale-[0.98] shadow-md',
        success: 'bg-secondary-green text-white hover:bg-green-700 active:scale-[0.98] shadow-md',
        danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-md',
        warning: 'bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98] shadow-md',
        ghost: 'bg-transparent border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base'
    };

    const widthClass = fullWidth ? 'w-full' : '';

    const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`;

    return (
        <button
            className={combinedClasses}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : icon ? (
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
            ) : null}
            {children}
        </button>
    );
});

Button.displayName = 'Button';
