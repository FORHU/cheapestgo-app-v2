import React from 'react';

interface PriceDisplayProps {
    price: number;
    originalPrice?: number;
    currency?: string;
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: { price: 'text-sm', original: 'text-xs' },
    md: { price: 'text-lg', original: 'text-sm' },
    lg: { price: 'text-xl', original: 'text-sm' },
};

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
    price,
    originalPrice,
    currency = '$',
    label,
    size = 'md',
    className = '',
}) => {
    const formatPrice = (value: number) => {
        return value.toLocaleString();
    };

    return (
        <div className={`flex flex-col ${className}`}>
            {originalPrice && originalPrice > price && (
                <span className={`${sizeClasses[size].original} text-slate-400 line-through`}>
                    {currency}{formatPrice(originalPrice)}
                </span>
            )}
            <div className="flex items-baseline gap-1">
                <span className={`${sizeClasses[size].price} font-mono font-bold text-slate-900 dark:text-white`}>
                    {currency}{formatPrice(price)}
                </span>
                {label && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
};
