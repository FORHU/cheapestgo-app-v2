import type { Metadata } from 'next';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';

export const metadata: Metadata = {
    title: 'Terms of Service — CheapestGo',
    description: 'The terms and conditions governing your use of CheapestGo.',
};

export default function TermsPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />

            <main className="flex-1">
                <div className="max-w-3xl mx-auto px-4 py-12">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Terms of Service</h1>
                        <p className="text-slate-500 dark:text-slate-400">Please read these terms carefully before using CheapestGo.</p>
                        <div className="flex gap-4 mt-3 text-xs text-slate-400 dark:text-slate-500">
                            <span>Effective: May 1, 2025</span>
                            <span>Last updated: April 1, 2025</span>
                        </div>
                    </div>

                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-700 dark:text-slate-300">

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Acceptance of Terms</h2>
                            <p className="text-sm leading-relaxed">
                                By accessing or using the CheapestGo website and services (the "Platform"), you agree to
                                be bound by these Terms of Service ("Terms") and all applicable laws and regulations. If
                                you do not agree to these Terms, you may not use the Platform. CheapestGo is operated by
                                JTP Partners, 30 Wall Street, 8th Floor, New York, NY 10005, United States. These Terms
                                constitute a legally binding agreement between you and CheapestGo.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Eligibility</h2>
                            <p className="text-sm mb-2">To use CheapestGo, you must:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>Be at least 18 years of age</li>
                                <li>Have the legal capacity to enter into a binding contract</li>
                                <li>Not be prohibited from using the Platform under applicable laws</li>
                                <li>Provide accurate, current, and complete information when creating an account or making a booking</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Account Registration</h2>
                            <p className="text-sm mb-2">
                                To access certain features of the Platform, you may need to create an account. You agree to:
                            </p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>Provide accurate and truthful information during registration</li>
                                <li>Keep your login credentials confidential and not share them with third parties</li>
                                <li>Notify us immediately of any unauthorized use of your account</li>
                                <li>Be responsible for all activity that occurs under your account</li>
                            </ul>
                            <p className="text-sm mt-2">
                                CheapestGo reserves the right to suspend or terminate accounts that violate these Terms
                                or that are inactive for an extended period.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Booking Process and Confirmation</h2>
                            <p className="text-sm mb-2">
                                When you make a booking through CheapestGo, you are entering into a contract with the
                                travel supplier (hotel, airline, or package provider), not with CheapestGo. CheapestGo
                                acts as an intermediary facilitating the booking.
                            </p>
                            <ul className="list-disc pl-5 space-y-1.5 text-sm">
                                <li>
                                    <strong>Booking confirmation:</strong> A booking is confirmed only when you receive a
                                    written confirmation email from CheapestGo with a booking reference number.
                                </li>
                                <li>
                                    <strong>Accuracy:</strong> You are responsible for ensuring all booking details
                                    (dates, guest names, room type) are correct before confirming payment.
                                </li>
                                <li>
                                    <strong>Supplier terms:</strong> Your booking is subject to the terms and conditions
                                    of the individual travel supplier, including their cancellation and no-show policies.
                                </li>
                                <li>
                                    <strong>Availability:</strong> Prices and availability are not guaranteed until
                                    payment is successfully processed and a confirmation is issued.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Pricing and Payments</h2>
                            <ul className="list-disc pl-5 space-y-1.5 text-sm">
                                <li>
                                    <strong>Markup:</strong> CheapestGo applies a transparent service markup (currently
                                    12%) to wholesale hotel and travel rates. This markup is included in the price shown
                                    to you — there are no hidden fees.
                                </li>
                                <li>
                                    <strong>Currency:</strong> Prices are displayed in the currency of your choosing.
                                    Currency conversion rates are provided for reference and may vary at time of payment.
                                </li>
                                <li>
                                    <strong>Payment processing:</strong> All payments are processed securely by Stripe,
                                    Inc. By making a payment, you also agree to Stripe's terms of service. CheapestGo
                                    does not store your card details.
                                </li>
                                <li>
                                    <strong>Taxes and fees:</strong> Displayed prices include applicable service fees.
                                    Local taxes or tourism fees charged directly by the hotel at check-in are not included
                                    unless stated otherwise.
                                </li>
                                <li>
                                    <strong>Price changes:</strong> Prices are subject to change until payment is
                                    completed. We are not liable for price fluctuations prior to booking confirmation.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Cancellations and Refunds</h2>
                            <p className="text-sm leading-relaxed">
                                Cancellations and refunds are governed by our{' '}
                                <a href="/refund" className="text-blue-600 dark:text-blue-400 hover:underline">
                                    Refund &amp; Cancellation Policy
                                </a>
                                , which is incorporated into these Terms by reference. Please review it carefully before
                                making a booking, as policies vary by hotel and rate type.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Prohibited Conduct</h2>
                            <p className="text-sm mb-2">You agree not to:</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>Use the Platform for any unlawful purpose or in violation of any regulations</li>
                                <li>Make fraudulent bookings, use stolen payment credentials, or engage in chargebacks in bad faith</li>
                                <li>Attempt to reverse-engineer, scrape, or extract data from the Platform</li>
                                <li>Use automated bots or scripts to access or interact with the Platform</li>
                                <li>Resell or redistribute bookings for commercial purposes without our written consent</li>
                                <li>Post false or misleading information, reviews, or impersonate any person or entity</li>
                                <li>Interfere with the security, integrity, or performance of the Platform</li>
                                <li>Harass, threaten, or harm other users or CheapestGo staff</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Intellectual Property</h2>
                            <p className="text-sm leading-relaxed">
                                All content on the CheapestGo Platform — including logos, text, graphics, software, and
                                design — is the property of CheapestGo or its licensors and is protected by applicable
                                intellectual property laws. You may not reproduce, distribute, or create derivative works
                                from our content without prior written consent. Hotel and flight images and descriptions are provided
                                by our partners (Duffel, Mystifly, TravelgateX, ONDA, Rakuten) and respective suppliers under license.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Disclaimers</h2>
                            <p className="text-sm mb-2">
                                CheapestGo provides its services on an "as is" and "as available" basis. We do not
                                guarantee that:
                            </p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>The Platform will be uninterrupted, error-free, or free of viruses</li>
                                <li>Hotel descriptions, photos, or amenity lists are fully accurate (these are provided by suppliers)</li>
                                <li>Prices displayed will always be the lowest available in the market</li>
                                <li>All bookings will be honored by the travel supplier in the event of supplier insolvency or overbooking</li>
                            </ul>
                            <p className="text-sm mt-2">
                                CheapestGo is not responsible for the acts, errors, omissions, representations,
                                warranties, or negligence of any travel supplier.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Limitation of Liability</h2>
                            <p className="text-sm leading-relaxed">
                                To the maximum extent permitted by applicable law, CheapestGo, its officers, directors,
                                employees, and affiliates shall not be liable for any indirect, incidental, special,
                                consequential, or punitive damages, including loss of profits, data, or goodwill, arising
                                out of or in connection with your use of the Platform or any booking made through it. Our
                                total aggregate liability to you for any claim arising out of these Terms shall not exceed
                                the total amount paid by you for the booking giving rise to the claim.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Indemnification</h2>
                            <p className="text-sm leading-relaxed">
                                You agree to indemnify, defend, and hold harmless CheapestGo and JTP Partners from and
                                against any claims, liabilities, damages, losses, and expenses (including legal fees)
                                arising out of or in any way connected with your use of the Platform, your violation of
                                these Terms, or your violation of any rights of another person.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Governing Law and Dispute Resolution</h2>
                            <p className="text-sm leading-relaxed">
                                These Terms are governed by the laws of the State of New York, United States, without
                                regard to its conflict of law provisions.
                            </p>
                            <p className="text-sm leading-relaxed mt-2">
                                Any dispute arising from or relating to these Terms or your use of CheapestGo shall
                                first be attempted to be resolved through good-faith negotiation. If unresolved within
                                30 days, disputes shall be submitted to binding arbitration in New York City, New York,
                                under the rules of the American Arbitration Association (AAA). You waive any right to
                                participate in a class action lawsuit or class-wide arbitration.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Changes to These Terms</h2>
                            <p className="text-sm leading-relaxed">
                                CheapestGo reserves the right to modify these Terms at any time. We will notify registered
                                users of material changes via email and by posting an updated version on the Platform with
                                a revised "Last Updated" date. Your continued use of the Platform after changes take effect
                                constitutes your acceptance of the revised Terms.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Contact</h2>
                            <p className="text-sm mb-2">For questions about these Terms:</p>
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
