import type { Metadata } from 'next';
import { Header } from '@/shared/components/header';
import { Footer } from '@/shared/components/footer';

export const metadata: Metadata = {
    title: 'Refund & Cancellation Policy — CheapestGo',
    description: 'Understand how cancellations, refunds, and amendments work on CheapestGo.',
};

export default function RefundPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
            <Header />

            <main className="flex-1">
                <div className="max-w-3xl mx-auto px-4 py-12">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Refund &amp; Cancellation Policy</h1>
                        <p className="text-slate-500 dark:text-slate-400">Everything you need to know about cancellations, refunds, and booking changes.</p>
                        <div className="flex gap-4 mt-3 text-xs text-slate-400 dark:text-slate-500">
                            <span>Effective: May 1, 2025</span>
                            <span>Last updated: April 1, 2025</span>
                        </div>
                    </div>

                    <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-700 dark:text-slate-300">

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Overview</h2>
                            <p className="text-sm leading-relaxed">
                                CheapestGo acts as an intermediary between you and travel suppliers (hotels, airlines,
                                and package providers). Cancellation and refund rights are primarily governed by the
                                individual supplier's policies, which vary by property, rate type, and booking dates.
                                This policy explains how we facilitate cancellations and refunds on your behalf.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Hotel Cancellation Types</h2>
                            <p className="text-sm mb-3">When you book a hotel through CheapestGo, you will see one of the following rate types:</p>
                            <div className="space-y-3">
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                                    <p className="font-semibold text-green-800 dark:text-green-300 mb-1 text-sm">Free Cancellation</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        You may cancel at no charge before the deadline specified at booking. The exact
                                        deadline (e.g., "Free cancellation until 48 hours before check-in") is shown on
                                        the booking page and in your confirmation email.
                                    </p>
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                    <p className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1 text-sm">Partially Refundable</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        A partial refund applies depending on when you cancel relative to the check-in
                                        date. The penalty amount and cutoff dates are displayed before you confirm payment.
                                    </p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                                    <p className="font-semibold text-red-800 dark:text-red-300 mb-1 text-sm">Non-Refundable</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        No refund is provided if you cancel. These rates are typically lower in price
                                        and are clearly labeled "Non-refundable" before checkout.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">How to Cancel a Booking</h2>
                            <p className="text-sm mb-2">To cancel a booking:</p>
                            <ol className="list-decimal pl-5 space-y-1.5 text-sm">
                                <li>Log in to your CheapestGo account and go to <strong>My Bookings</strong>.</li>
                                <li>Select the booking you wish to cancel and click <strong>Cancel Booking</strong>.</li>
                                <li>Review the cancellation policy and any applicable fees shown on screen.</li>
                                <li>Confirm the cancellation. You will receive a cancellation confirmation email.</li>
                            </ol>
                            <p className="text-sm mt-2">
                                Alternatively, contact us at{' '}
                                <a href="mailto:support@cheapestgo.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                                    support@cheapestgo.com
                                </a>{' '}
                                with your booking reference number and we will process the cancellation within 1 business day.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Refund Processing</h2>
                            <ul className="list-disc pl-5 space-y-1.5 text-sm">
                                <li>
                                    <strong>Eligible refunds</strong> are processed back to the original payment method
                                    (credit/debit card or GrabPay) used at checkout via Stripe.
                                </li>
                                <li>
                                    <strong>Processing time:</strong> Once we initiate the refund, it typically takes
                                    5–10 business days to appear on your statement, depending on your bank or card issuer.
                                </li>
                                <li>
                                    <strong>CheapestGo service fee:</strong> Our platform service markup (currently 12%)
                                    is non-refundable unless the cancellation is due to a supplier error or CheapestGo
                                    system fault.
                                </li>
                                <li>
                                    <strong>Stripe processing fees:</strong> Payment processing fees charged by Stripe
                                    are non-refundable by CheapestGo, in line with Stripe's standard policy.
                                </li>
                                <li>
                                    <strong>Currency:</strong> Refunds are issued in the same currency as the original
                                    payment. Exchange rate differences at the time of refund are not our responsibility.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">No-Shows</h2>
                            <p className="text-sm leading-relaxed">
                                If you fail to check in on the scheduled arrival date without cancelling in advance,
                                the booking will be treated as a no-show. No-show policies vary by hotel — most hotels
                                will charge the full booking amount. CheapestGo cannot override hotel no-show policies.
                                We strongly recommend cancelling ahead of time if your plans change.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Booking Amendments</h2>
                            <p className="text-sm mb-2">
                                Date changes, room type changes, and guest name corrections are subject to hotel
                                availability and supplier policies. To request an amendment:
                            </p>
                            <ol className="list-decimal pl-5 space-y-1 text-sm">
                                <li>Contact us at support@cheapestgo.com with your booking reference</li>
                                <li>Specify the change you need and the reason</li>
                                <li>We will check availability with the supplier and confirm if the amendment is possible</li>
                            </ol>
                            <p className="text-sm mt-2">
                                <strong>Note:</strong> Amendments may result in a price difference (additional charge
                                or credit) and may not always be possible without cancelling and rebooking. We cannot
                                guarantee that amendment requests will be accommodated.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Supplier Cancellations and Force Majeure</h2>
                            <p className="text-sm mb-2">
                                In rare cases, a hotel or travel supplier may cancel your booking due to overbooking,
                                closure, natural disaster, or force majeure events. If this occurs:
                            </p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li>CheapestGo will notify you as soon as we are informed by the supplier</li>
                                <li>We will process a full refund of the amount paid to CheapestGo, including our service fee</li>
                                <li>We will assist you in finding alternative accommodation where possible, though we cannot guarantee a replacement</li>
                            </ul>
                            <p className="text-sm mt-2">
                                CheapestGo is not liable for losses arising from supplier cancellations, including
                                transportation costs, additional hotel nights booked elsewhere, or consequential losses.
                                We recommend purchasing travel insurance to cover such events.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Disputes and Chargebacks</h2>
                            <p className="text-sm leading-relaxed">
                                If you have a concern about a charge, please contact us at support@cheapestgo.com
                                before initiating a chargeback with your bank. Most issues can be resolved quickly.
                                Chargebacks initiated without first contacting CheapestGo may result in account
                                suspension. CheapestGo reserves the right to contest chargebacks that are made in bad
                                faith or that do not comply with our cancellation policy.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Flight Packages</h2>
                            <p className="text-sm leading-relaxed">
                                For all-inclusive flight + hotel packages, cancellation terms depend on both the hotel
                                and airline components. Airline tickets are generally non-refundable or carry significant
                                cancellation fees. The specific terms for your package will be shown during checkout and
                                in your confirmation email. If you need to cancel a package, contact us immediately at
                                support@cheapestgo.com for guidance.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Contact for Refund Requests</h2>
                            <p className="text-sm mb-2">
                                For all refund and cancellation queries, please have your booking reference number
                                ready and reach us at:
                            </p>
                            <ul className="list-none space-y-1 text-sm">
                                <li>Email: <a href="mailto:support@cheapestgo.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@cheapestgo.com</a></li>
                                <li>Address: JTP Partners · 30 Wall Street, 8th Floor · New York, NY 10005 · USA</li>
                            </ul>
                            <p className="text-sm mt-2">We aim to respond to all refund requests within 1–2 business days.</p>
                        </section>

                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
