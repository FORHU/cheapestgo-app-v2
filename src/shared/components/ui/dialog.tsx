'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/cn';

interface DialogContextValue {
    open: boolean;
    setOpen: (v: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue>({ open: false, setOpen: () => {} });

interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
}

function Dialog({ open: openProp, onOpenChange, children }: DialogProps) {
    const [openState, setOpenState] = React.useState(false);
    const open = openProp !== undefined ? openProp : openState;
    const setOpen = React.useCallback(
        (value: boolean) => {
            if (onOpenChange) onOpenChange(value);
            else setOpenState(value);
        },
        [onOpenChange]
    );
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [open, setOpen]);
    return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>;
}

function DialogTrigger({
    children,
    asChild,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
    const { setOpen } = React.useContext(DialogContext);
    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
            onClick: (e: React.MouseEvent) => {
                (children.props as any).onClick?.(e);
                setOpen(true);
            },
            ...props,
        } as any);
    }
    return <button onClick={() => setOpen(true)} {...props}>{children}</button>;
}

function DialogPortal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    return mounted ? createPortal(children, document.body) : null;
}

function DialogContent({
    className,
    children,
    showCloseButton = true,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean }) {
    const { open, setOpen } = React.useContext(DialogContext);
    return (
        <AnimatePresence>
            {open && (
                <DialogPortal>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setOpen(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
                            className={cn(
                                'relative w-full max-w-lg overflow-hidden bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10',
                                className
                            )}
                            {...(props as any)}
                        >
                            {children}
                            {showCloseButton && (
                                <button
                                    onClick={() => setOpen(false)}
                                    className="absolute top-6 right-6 rounded-xl opacity-70 transition-opacity hover:opacity-100 focus:outline-none text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                >
                                    <XIcon className="size-5" />
                                    <span className="sr-only">Close</span>
                                </button>
                            )}
                        </motion.div>
                    </div>
                </DialogPortal>
            )}
        </AnimatePresence>
    );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('flex flex-col gap-1.5 text-center sm:text-left', className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2', className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h2 className={cn('text-xl font-black text-slate-900 dark:text-white', className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
    return <p className={cn('text-slate-500 dark:text-slate-400 text-sm font-medium', className)} {...props} />;
}

function DialogClose({
    children,
    asChild,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
    const { setOpen } = React.useContext(DialogContext);
    if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
            onClick: (e: React.MouseEvent) => {
                (children.props as any).onClick?.(e);
                setOpen(false);
            },
            ...props,
        } as any);
    }
    return <button onClick={() => setOpen(false)} {...props}>{children}</button>;
}

export {
    Dialog,
    DialogTrigger,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
};
