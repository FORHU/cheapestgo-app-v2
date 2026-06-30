import Link from 'next/link';
import { RegisterForm } from '@/features/auth/components/register-form';
import { PlaneTakeoff } from 'lucide-react';

export const metadata = { title: 'Create account — CheapestGo' };

export default function RegisterPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
            <div className="w-full max-w-sm space-y-8">
                {/* Logo */}
                <div className="text-center space-y-2">
                    <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white">
                        <PlaneTakeoff size={22} className="text-blue-600" />
                        CheapestGo
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create your account</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Start finding the cheapest fares worldwide</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/60 dark:border-white/10 p-8">
                    <RegisterForm />
                </div>

                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    Already have an account?{' '}
                    <Link href="/login" className="text-blue-600 hover:underline font-medium">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
