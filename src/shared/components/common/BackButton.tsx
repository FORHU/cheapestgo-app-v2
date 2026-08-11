'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

interface BackButtonProps {
    label?: string;
    className?: string;
    href?: string;
    bareIcon?: boolean;
}

const BackButton: React.FC<BackButtonProps> = ({ label = 'Back', className, href, bareIcon = false }) => {
    const router = useRouter();

    const content = bareIcon ? (
        <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
    ) : (
        <>
            <ChevronLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" />
            {label}
        </>
    );

    const classes = cn(
        'flex items-center text-blue-600 hover:text-blue-700 font-normal text-sm transition-colors group',
        className
    );

    if (href) {
        return (
            <Link href={href} className={classes}>
                {content}
            </Link>
        );
    }

    return (
        <button onClick={() => router.back()} className={classes}>
            {content}
        </button>
    );
};

export default BackButton;
