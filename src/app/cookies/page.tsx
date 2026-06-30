import type { Metadata } from 'next';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';

export const metadata: Metadata = {
    title: 'Cookie Policy — CheapestGo',
    description: 'How CheapestGo uses cookies and similar tracking technologies.',
};

export default function CookiesPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />

            <main className="flex-1">
                <div className="max-w-3xl mx-auto px-4 py-12">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Cookie Policy</h1>
                        <p className="text-slate-500 dark:text-slate-400">How we use cookies and similar technologies on CheapestGo.</p>
                        <div className="flex gap-4 mt-3 text-xs text-slate-400 dark:text-slate-500">
                            <span>Effective: May 1, 2025</span>
                            <span>Last updated: April 1, 2025</span>
                        </div>
                    </div>

                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-700 dark:text-slate-300">

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">What Are Cookies?</h2>
                            <p className="text-sm leading-relaxed">
                                Cookies are small text files placed on your device when you visit a website. They are
                                widely used to make websites work efficiently, to remember your preferences, and to
                                provide information to website operators. Similar technologies include web beacons,
                                pixels, local storage, and session storage, all of which we refer to collectively as
                                "cookies" in this policy.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Why We Use Cookies</h2>
                            <p className="text-sm mb-2">CheapestGo uses cookies to:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>Keep you signed in and maintain your session securely</li>
                                <li>Remember your preferences (currency, language, dark/light mode)</li>
                                <li>Save your recent searches and viewed properties</li>
                                <li>Prevent fraud and protect the security of your account</li>
                                <li>Measure performance and understand how visitors use our platform</li>
                                <li>Personalize content and show relevant deals and recommendations</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Types of Cookies We Use</h2>
                            <div className="space-y-4">
                                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-4">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1 text-sm">Strictly Necessary Cookies</p>
                                    <p className="text-sm leading-relaxed">
                                        These cookies are essential for the Platform to function. They enable core features
                                        such as authentication, session management, security tokens, and payment processing.
                                        You cannot opt out of these cookies as they are required for the service to operate.
                                    </p>
                                    <ul className="list-disc pl-5 space-y-0.5 mt-2 text-sm">
                                        <li><strong>auth-token</strong> — authentication session</li>
                                        <li><strong>__stripe_mid / __stripe_sid</strong> — Stripe fraud prevention</li>
                                    </ul>
                                </div>

                                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-4">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1 text-sm">Functional Cookies</p>
                                    <p className="text-sm leading-relaxed">
                                        These cookies remember your choices and personalize your experience. Disabling them
                                        may reduce functionality.
                                    </p>
                                    <ul className="list-disc pl-5 space-y-0.5 mt-2 text-sm">
                                        <li>Currency preference (e.g., KRW, USD, PHP)</li>
                                        <li>Theme preference (dark or light mode)</li>
                                        <li>Recently viewed hotels and search history</li>
                                    </ul>
                                </div>

                                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-4">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1 text-sm">Analytics Cookies</p>
                                    <p className="text-sm leading-relaxed">
                                        These help us understand how visitors interact with the Platform — which pages are
                                        most visited, where users drop off, and how we can improve the experience. Data is
                                        aggregated and anonymized where possible.
                                    </p>
                                    <ul className="list-disc pl-5 space-y-0.5 mt-2 text-sm">
                                        <li>Page view tracking and session duration</li>
                                        <li>Click-through rates on deals and search results</li>
                                        <li>Error logging and performance monitoring</li>
                                    </ul>
                                </div>

                                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 rounded-xl p-4">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1 text-sm">Marketing Cookies</p>
                                    <p className="text-sm leading-relaxed">
                                        We may use these to show you relevant travel deals on our Platform. We do not
                                        currently serve third-party advertising. If this changes, we will update this policy
                                        and request your consent.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Third-Party Cookies</h2>
                            <p className="text-sm mb-2">Some cookies are set by third-party services that appear on our pages:</p>
                            <ul className="list-disc pl-5 space-y-1.5 text-sm">
                                <li>
                                    <strong>Stripe</strong> — sets cookies for fraud detection and payment session
                                    management. See{' '}
                                    <a href="https://stripe.com/privacy" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                                        Stripe's Privacy Policy
                                    </a>.
                                </li>
                            </ul>
                            <p className="text-sm mt-2">
                                We have no control over third-party cookies. Please review the respective privacy
                                policies of these providers for more information.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Cookie Duration</h2>
                            <p className="text-sm mb-2">Cookies on CheapestGo are either:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>
                                    <strong>Session cookies</strong> — deleted automatically when you close your browser.
                                    Used for login sessions and temporary state.
                                </li>
                                <li>
                                    <strong>Persistent cookies</strong> — remain on your device for a set period (typically
                                    30 days to 1 year). Used for preferences and analytics.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Managing Your Cookie Preferences</h2>
                            <p className="text-sm mb-2">You can control cookies in several ways:</p>
                            <ul className="list-disc pl-5 space-y-1.5 text-sm">
                                <li>
                                    <strong>Browser settings:</strong> Most browsers allow you to refuse or delete cookies
                                    via their settings (usually under Privacy or Security). Note that disabling strictly
                                    necessary cookies will break core functionality such as login and checkout.
                                </li>
                                <li>
                                    <strong>Cookie banner:</strong> When you first visit CheapestGo, you may be presented
                                    with a cookie consent banner where you can accept or decline non-essential cookies.
                                </li>
                                <li>
                                    <strong>Opt-out tools:</strong> For analytics, you can use browser extensions such as
                                    the Google Analytics Opt-out Browser Add-on where applicable.
                                </li>
                            </ul>
                            <p className="text-sm mt-2">
                                Adjusting your cookie settings may affect the functionality of the Platform. Essential
                                cookies cannot be disabled without impacting your ability to use CheapestGo.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Do Not Track</h2>
                            <p className="text-sm leading-relaxed">
                                Some browsers send a "Do Not Track" (DNT) signal. CheapestGo does not currently respond
                                to DNT signals, as there is no universal standard for how websites should react to them.
                                We continue to evaluate this area as standards evolve.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Changes to This Cookie Policy</h2>
                            <p className="text-sm leading-relaxed">
                                We may update this Cookie Policy from time to time to reflect changes in technology,
                                regulation, or our use of cookies. When we make material changes, we will update the
                                "Last Updated" date at the top of this page. Continued use of the Platform after changes
                                are posted constitutes your acceptance of the revised policy.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Contact</h2>
                            <p className="text-sm mb-2">For questions about our use of cookies:</p>
                            <ul className="list-none space-y-1 text-sm">
                                <li>Email: <a href="mailto:support@cheapestgo.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@cheapestgo.com</a></li>
                                <li>Address: JTP Partners · 30 Wall Street, 8th Floor · New York, NY 10005 · USA</li>
                            </ul>
                        </section>

                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
