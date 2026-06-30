import { cn } from '@/shared/lib/cn';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-white/10', className)}
            {...props}
        />
    );
}

export { Skeleton };
