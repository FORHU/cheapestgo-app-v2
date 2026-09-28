'use client';

import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useLogin } from '../hooks/use-auth';
import { SocialLoginButtons } from './social-login-buttons';

export function LoginForm() {
    const tAll = useTranslations();
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
            <SocialLoginButtons label={tAll('auth.signInWithGoogle')} />

            <Input
                id="email"
                type="email"
                label="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
                placeholder={tAll('auth.signIn.emailPlaceholder')}
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
                    placeholder={tAll('auth.passwordPlaceholder')}
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

            {/*
                "Keep me signed in" was here and did nothing: it was `defaultChecked`, never
                read, and never sent — the login call carries an email and a password and
                nothing else. Honouring it means deciding how long a session lives, which is
                api-v2's to answer and not a checkbox's to imply. Removed rather than left
                lying to the customer about what ticking it does.
            */}
            <div className="flex justify-end text-sm">
                <Link href="/forgot-password"
                      className="font-medium text-alabaster-accent hover:underline dark:text-obsidian-accent">
                    {tAll('auth.forgotPasswordQ')}
                </Link>
            </div>

            <Button
                type="submit"
                fullWidth
                isLoading={login.isPending}
                rightIcon={<ArrowRight size={16} />}
            >
                {tAll('nav.signIn')}
            </Button>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                {tAll('auth.noAccount')}{' '}
                <Link href="/register"
                      className="font-medium text-alabaster-accent hover:underline dark:text-obsidian-accent">
                    {tAll('auth.createOne')}
                </Link>
            </p>
        </form>
    );
}
