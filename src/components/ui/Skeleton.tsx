import React from 'react';

export interface SkeletonProps {
    width?: string;
    height?: string;
    className?: string;
    rounded?: 'sm' | 'md' | 'lg' | 'full';
}

/**
 * Componente Skeleton — placeholder shimmer para loading states.
 * Usa a classe .skeleton do index.css (animação shimmer via CSS).
 */
export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = '16px',
    className = '',
    rounded = 'md',
}) => {
    const roundedMap = {
        sm:   'rounded-sm',
        md:   'rounded-md',
        lg:   'rounded-lg',
        full: 'rounded-full',
    };

    return (
        <span
            className={`skeleton block ${roundedMap[rounded]} ${className}`}
            style={{ width, height }}
            aria-hidden="true"
        />
    );
};

Skeleton.displayName = 'Skeleton';

/* ─── Variante de linha de texto ─── */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
    lines = 3,
    className = '',
}) => (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
                key={i}
                height="14px"
                width={i === lines - 1 ? '65%' : '100%'}
            />
        ))}
    </div>
);

SkeletonText.displayName = 'SkeletonText';

/* ─── Variante de card ─── */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`bg-white rounded-xl border border-rustic-border p-5 space-y-3 ${className}`} aria-hidden="true">
        <div className="flex items-center gap-3">
            <Skeleton width="40px" height="40px" rounded="full" />
            <div className="flex-1 space-y-2">
                <Skeleton height="14px" width="40%" />
                <Skeleton height="12px" width="70%" />
            </div>
        </div>
        <SkeletonText lines={2} />
    </div>
);

SkeletonCard.displayName = 'SkeletonCard';

/* ─── Grid de cards skeleton ─── */
export const SkeletonGrid: React.FC<{
    count?: number;
    cols?: 2 | 3 | 4;
    className?: string;
}> = ({ count = 4, cols = 2, className = '' }) => {
    const colsMap = { 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' };
    return (
        <div className={`grid ${colsMap[cols]} gap-4 ${className}`} aria-hidden="true">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </div>
    );
};

SkeletonGrid.displayName = 'SkeletonGrid';
