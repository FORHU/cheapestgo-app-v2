"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

export const ScrollToTop = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => setIsVisible(window.scrollY > 300);
        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.2 }}
                    onClick={scrollToTop}
                    className={cn(
                        "fixed z-50 flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full",
                        "bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                        "right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] lg:bottom-8"
                    )}
                    aria-label="Scroll to top"
                >
                    <ArrowUp className="w-4 h-4 lg:w-5 lg:h-5" />
                </motion.button>
            )}
        </AnimatePresence>
    );
};
