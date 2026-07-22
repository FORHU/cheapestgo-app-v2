'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalSparkle } from '@/shared/components/ui/GlobalSparkle';

interface MobileSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSearch?: () => void;
    children?: React.ReactNode;
}

export function MobileSearchModal({ isOpen, onClose, onSearch, children }: MobileSearchModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        width: '100vw',
                        height: '100dvh',
                        zIndex: 99999,
                        display: 'flex',
                        flexDirection: 'column',
                        margin: 0,
                        padding: 0,
                    }}
                    className="bg-slate-100 dark:bg-slate-950 lg:hidden"
                >
                    <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
                        <GlobalSparkle />
                    </div>

                    <div className="relative z-10 flex flex-col h-full w-full">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (typeof window === 'undefined') return null;
    return createPortal(modalContent, document.body);
}
