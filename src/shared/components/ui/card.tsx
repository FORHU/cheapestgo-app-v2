import * as React from 'react';
import { cn } from '@/shared/lib/cn';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl text-slate-950 dark:text-slate-50 shadow-xl shadow-black/5 dark:shadow-black/20 rounded-2xl border border-white/20 dark:border-white/[0.08]',
                className
            )}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6', className)}
            {...props}
        />
    );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('leading-none font-semibold', className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('text-slate-500 dark:text-slate-400 text-sm', className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('px-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('flex items-center px-6', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
