import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    label?: string;
    error?: string;
    icon?: string;
    value: string;
    onChange: (value: string) => void;
    containerClassName?: string;
}

/**
 * Componente Input reutilizável com label, erro e ícone
 */
export const Input = React.memo<InputProps>(({
    label,
    error,
    icon,
    value,
    onChange,
    className = '',
    containerClassName = '',
    ...props
}) => {
    return (
        <div className={`flex flex-col gap-2 ${containerClassName}`}>
            {label && (
                <label className="text-xs font-black uppercase text-rustic-brown/60 ml-1">
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
                        {icon}
                    </span>
                )}
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full h-11 ${icon ? 'pl-11' : 'pl-4'} pr-4 rounded-lg border ${error ? 'border-red-500 bg-red-50/20' : 'border-rustic-border bg-white'
                        } text-sm focus:ring-2 focus:ring-primary/20 transition-all ${className}`}
                    {...props}
                />
            </div>
            {error && (
                <span className="text-xs text-red-600 ml-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {error}
                </span>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
    label?: string;
    error?: string;
    value: string;
    onChange: (value: string) => void;
    containerClassName?: string;
}

/**
 * Componente TextArea reutilizável
 */
export const TextArea = React.memo<TextAreaProps>(({
    label,
    error,
    value,
    onChange,
    className = '',
    containerClassName = '',
    ...props
}) => {
    return (
        <div className={`flex flex-col gap-2 ${containerClassName}`}>
            {label && (
                <label className="text-xs font-black uppercase text-rustic-brown/60 ml-1">
                    {label}
                </label>
            )}
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full p-4 rounded-lg border ${error ? 'border-red-500 bg-red-50/20' : 'border-rustic-border bg-white'
                    } text-sm focus:ring-2 focus:ring-primary/20 resize-none transition-all ${className}`}
                {...props}
            />
            {error && (
                <span className="text-xs text-red-600 ml-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {error}
                </span>
            )}
        </div>
    );
});

TextArea.displayName = 'TextArea';
