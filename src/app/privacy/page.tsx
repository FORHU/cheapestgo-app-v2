import type { Metadata } from 'next';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';

export const metadata: Metadata = {
    title: 'Privacy Policy — CheapestGo',
    description: 'How CheapestGo collects, uses, and protects your personal information.',
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />

            <main className="flex-1">
                <div className="max-w-3xl mx-auto px-4 py-12">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Privacy Policy</h1>
                        <p className="text-slate-500 dark:text-slate-400">How we collect, use, and protect your personal information.</p>
                        <div className="flex gap-4 mt-3 text-xs text-slate-400 dark:text-slate-500">
                            <span>Effective: May 1, 2025</span>
                            <span>Last updated: April 1, 2025</span>
                        </div>
                    </div>

                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-700 dark:text-slate-300">

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Who We Are</h2>
                            <p className="text-sm leading-relaxed">
                                CheapestGo ("we," "us," or "our") is an online travel agency operated by JTP Partners,
                                located at 30 Wall Street, 8th Floor, New York, NY 10005, United States. We provide hotel
                                booking, flight package, and travel deal services primarily to travelers in Southeast Asia
                                through our website and mobile platform.
                            </p>
                            <p className="text-sm leading-relaxed mt-2">
                                For questions regarding this Privacy Policy, contact us at{' '}
                                <a href="mailto:support@cheapestgo.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                                    support@cheapestgo.com
                                </a>.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Information We Collect</h2>
                            <p className="text-sm font-medium mb-1">Information you provide directly:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>Name, email address, phone number, and date of birth when creating an account or making a booking</li>
                                <li>Billing address and payment information (processed securely by Stripe — we do not store card numbers)</li>
                                <li>Travel preferences, search history, and past booking details</li>
                                <li>Communications you send us via email or support channels</li>
                            </ul>
                            <p className="text-sm font-medium mt-3 mb-1">Information collected automatically:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>IP address, browser type, operating system, and device identifiers</li>
                                <li>Pages visited, time spent on pages, links clicked, and referral URLs</li>
                                <li>Cookies, web beacons, and similar tracking technologies (see our Cookie Policy)</li>
                                <li>Location data (country/region level) derived from your IP address</li>
                            </ul>
                            <p className="text-sm font-medium mt-3 mb-1">Information from third parties:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>Travel availability and pricing data from our partners (Duffel, Mystifly, TravelgateX, ONDA, Rakuten)</li>
                                <li>Payment confirmation and fraud signals from Stripe</li>
                                <li>Analytics data from service providers we use to improve our platform</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">How We Use Your Information</h2>
                            <ul className="list-disc pl-5 space-y-1.5 text-sm">
                                <li>To process and confirm your travel bookings and send booking confirmations</li>
                                <li>To process payments and prevent fraud through Stripe</li>
                                <li>To create and manage your CheapestGo account</li>
                                <li>To send transactional emails (booking confirmations, receipts, itinerary updates)</li>
                                <li>To send promotional emails and deal alerts — only with your consent, and you may opt out at any time</li>
                                <li>To improve our platform, personalize content, and analyze usage patterns</li>
                                <li>To comply with legal obligations and enforce our Terms of Service</li>
                                <li>To respond to your inquiries and provide customer support</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">How We Share Your Information</h2>
                            <p className="text-sm mb-2">We do not sell your personal information. We share your data only in the following circumstances:</p>
                            <ul className="list-disc pl-5 space-y-1.5 text-sm">
                                <li>
                                    <strong>Hotels and travel suppliers:</strong> Your name, contact details, and booking
                                    information are shared with hotels and suppliers to fulfill your reservation.
                                </li>
                                <li>
                                    <strong>Stripe:</strong> Payment information is processed by Stripe, Inc. See{' '}
                                    <a href="https://stripe.com/privacy" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>.
                                </li>
                                <li>
                                    <strong>Travel Partners (Duffel, Mystifly, TravelgateX, ONDA, Rakuten):</strong> Search queries and booking details are processed through our partner APIs to retrieve availability and pricing.
                                </li>
                                <li>
                                    <strong>Legal requirements:</strong> We may disclose information when required by law,
                                    court order, or to protect the rights, property, or safety of CheapestGo or others.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Cookies and Tracking Technologies</h2>
                            <p className="text-sm leading-relaxed">
                                We use cookies and similar technologies to operate our platform and improve your experience.
                                Please see our{' '}
                                <a href="/cookies" className="text-blue-600 dark:text-blue-400 hover:underline">Cookie Policy</a>
                                {' '}for full details on what cookies we use and how to manage your preferences.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Data Retention</h2>
                            <p className="text-sm mb-2">We retain your personal data for as long as necessary to:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>Maintain your account and provide our services</li>
                                <li>Comply with legal, tax, and accounting obligations (typically 7 years for financial records)</li>
                                <li>Resolve disputes and enforce our agreements</li>
                            </ul>
                            <p className="text-sm mt-2">
                                When you delete your account, we will delete or anonymize your personal data within
                                90 days, except where retention is required by law.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">International Data Transfers</h2>
                            <p className="text-sm leading-relaxed">
                                CheapestGo is headquartered in the United States. When you use our services from
                                Southeast Asia or other regions, your data is transferred to and processed in the United
                                States. We ensure appropriate safeguards are in place for international transfers,
                                including standard contractual clauses where required under applicable law (including
                                GDPR and the Philippine Data Privacy Act of 2012, Republic Act No. 10173).
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Your Rights and Choices</h2>
                            <p className="text-sm mb-2">Depending on your jurisdiction, you may have the following rights:</p>
                            <ul className="list-disc pl-5 space-y-1.5 text-sm">
                                <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
                                <li><strong>Deletion:</strong> Request deletion of your personal data ("right to be forgotten")</li>
                                <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
                                <li><strong>Opt-out:</strong> Unsubscribe from marketing emails at any time using the link in our emails</li>
                                <li><strong>Withdraw consent:</strong> Where processing is based on consent, you may withdraw it at any time</li>
                            </ul>
                            <p className="text-sm mt-2">
                                To exercise any of these rights, email us at{' '}
                                <a href="mailto:support@cheapestgo.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                                    support@cheapestgo.com
                                </a>
                                . We will respond within 30 days.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Children's Privacy</h2>
                            <p className="text-sm leading-relaxed">
                                CheapestGo is not intended for children under the age of 18. We do not knowingly collect
                                personal information from children. If you believe we have inadvertently collected
                                information from a child, please contact us immediately at support@cheapestgo.com
                                and we will delete such information promptly.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Security</h2>
                            <p className="text-sm leading-relaxed">
                                We implement industry-standard technical and organizational measures to protect your
                                personal data, including encryption in transit (TLS/HTTPS), encryption at rest, access
                                controls, and regular security reviews. Payment data is handled exclusively by Stripe,
                                which is PCI DSS compliant. However, no method of transmission over the internet is
                                completely secure, and we cannot guarantee absolute security.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Changes to This Policy</h2>
                            <p className="text-sm leading-relaxed">
                                We may update this Privacy Policy from time to time. When we make material changes, we
                                will notify you by email (if you have an account) or by posting a prominent notice on our
                                website. Your continued use of CheapestGo after the effective date of the revised policy
                                constitutes your acceptance of the changes.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Contact Us</h2>
                            <p className="text-sm mb-2">For privacy-related inquiries, requests, or complaints:</p>
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
