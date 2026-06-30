'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useLogin } from '../hooks/use-auth';

export function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    const login = useLogin();

    const validate = () => {
        const e: typeof errors = {};
        if (!email) e.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
        if (!password) e.password = 'Password is required';
        else if (password.length < 8) e.password = 'Password must be at least 8 characters';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        login.mutate({ email, password });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                id="email"
                type="email"
                label="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
                placeholder="you@example.com"
                icon={Mail}
                error={errors.email}
                autoComplete="email"
            />

            <div className="relative">
                <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: undefined })); }}
                    placeholder="Your password"
                    icon={Lock}
                    error={errors.password}
                    autoComplete="current-password"
                    className="pr-10"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>

            <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-slate-600 dark:text-slate-400">Keep me signed in</span>
                </label>
                <Link href="/forgot-password" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    Forgot password?
                </Link>
            </div>

            <Button
                type="submit"
                fullWidth
                isLoading={login.isPending}
                rightIcon={<ArrowRight size={16} />}
            >
                Sign in
            </Button>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    Create one
                </Link>
            </p>
        </form>
    );
}
