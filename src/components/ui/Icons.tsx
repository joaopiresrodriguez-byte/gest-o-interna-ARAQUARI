import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

// 1. Ícone de Alteração de Opções / Parâmetros (Sliders / Ajustes de Gestão)
export const OptionSlidersIcon: React.FC<IconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

// 2. Ícone de Edição de Registro / Form (Lápis com Quadrado)
export const EditPencilIcon: React.FC<IconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

// 3. Ícone de Salvamento
export const SaveIcon: React.FC<IconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

// 4. Ícone de Exclusão / Lixeira
export const TrashIcon: React.FC<IconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// 5. Ícone de Reordenação / Mover
export const ReorderIcon: React.FC<IconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <circle cx="9" cy="5" r="1" fill="currentColor" />
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="19" r="1" fill="currentColor" />
    <circle cx="15" cy="5" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="19" r="1" fill="currentColor" />
  </svg>
);

// 6. Ícone de Status / Alternar
export const StatusToggleIcon: React.FC<IconProps> = ({ size = 18, className = '', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 20v-4h4" />
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 4v4h-4" />
  </svg>
);

// Componente Botão de Ação Padronizado com Tema CBMSC (Dourado/Âmbar no Hover)
export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'alteration' | 'edit' | 'save' | 'delete' | 'reorder' | 'status' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  icon?: React.ReactNode;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'alteration',
  size = 'md',
  label,
  icon,
  className = '',
  title,
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'p-1.5 text-xs gap-1.5 min-h-[30px]',
    md: 'p-2 text-sm gap-2 min-h-[36px]',
    lg: 'px-3 py-2 text-base gap-2.5 min-h-[42px]',
  };

  const iconSizes = {
    sm: 15,
    md: 18,
    lg: 20,
  };

  const variantClasses = {
    // Alteração de Opções / Parâmetros - Tema CBMSC (Âmbar/Dourado no Hover)
    alteration:
      'text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 active:scale-95',
    edit:
      'text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 hover:border-blue-400 active:scale-95',
    save:
      'text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 hover:border-emerald-400 active:scale-95',
    delete:
      'text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 bg-rose-50/50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 hover:border-rose-400 active:scale-95',
    reorder:
      'text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-amber-500/50 hover:text-amber-500 cursor-grab active:cursor-grabbing',
    status:
      'text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 active:scale-95',
    neutral:
      'text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95',
  };

  const renderIcon = () => {
    if (icon) return icon;
    const currentSize = iconSizes[size];
    switch (variant) {
      case 'alteration':
        return <OptionSlidersIcon size={currentSize} />;
      case 'edit':
        return <EditPencilIcon size={currentSize} />;
      case 'save':
        return <SaveIcon size={currentSize} />;
      case 'delete':
        return <TrashIcon size={currentSize} />;
      case 'reorder':
        return <ReorderIcon size={currentSize} />;
      case 'status':
        return <StatusToggleIcon size={currentSize} />;
      default:
        return null;
    }
  };

  const defaultTitle = title || label;

  return (
    <button
      type="button"
      title={defaultTitle}
      aria-label={defaultTitle || 'Ação'}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {renderIcon()}
      {label && <span>{label}</span>}
      {children}
    </button>
  );
};
