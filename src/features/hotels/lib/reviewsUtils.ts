export interface HotelReview {
    averageScore: number;
    name: string;
    date: string;
    headline?: string;
    pros?: string;
    cons?: string;
    country?: string;
    type?: string;
    language?: string;
}

export interface TravelerBreakdown {
    family:       number;
    couple:       number;
    friendsGroup: number;
    solo:         number;
    business:     number;
}

export function calculateAverageRating(reviews: HotelReview[]): number {
    if (!reviews || reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (r.averageScore || 0), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
}

export function formatReviewDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

export function getRatingLabel(score: number): string {
    if (score >= 9) return 'Exceptional';
    if (score >= 8) return 'Excellent';
    if (score >= 7) return 'Very Good';
    if (score >= 6) return 'Good';
    if (score >= 5) return 'Average';
    return 'Below Average';
}

export function getRatingColor(score: number): string {
    if (score >= 9) return 'bg-indigo-600';
    if (score >= 8) return 'bg-emerald-500';
    if (score >= 7) return 'bg-teal-500';
    if (score >= 6) return 'bg-blue-500';
    return 'bg-amber-500';
}

export function calculateTravelerBreakdown(reviews: HotelReview[]): TravelerBreakdown {
    if (!reviews || reviews.length === 0) {
        return { family: 0, couple: 0, friendsGroup: 0, solo: 0, business: 0 };
    }
    const counts = { family: 0, couple: 0, friendsGroup: 0, solo: 0, business: 0 };
    for (const review of reviews) {
        const t = (review.type || '').toLowerCase();
        if      (t.includes('family')   || t.includes('children')) counts.family++;
        else if (t.includes('couple')   || t.includes('partner'))  counts.couple++;
        else if (t.includes('friend')   || t.includes('group') || t.includes('extended')) counts.friendsGroup++;
        else if (t.includes('solo')     || t.includes('single'))   counts.solo++;
        else if (t.includes('business') || t.includes('work'))     counts.business++;
        else counts.couple++;
    }
    const total = reviews.length;
    return {
        family:       Math.round((counts.family       / total) * 100),
        couple:       Math.round((counts.couple       / total) * 100),
        friendsGroup: Math.round((counts.friendsGroup / total) * 100),
        solo:         Math.round((counts.solo         / total) * 100),
        business:     Math.round((counts.business     / total) * 100),
    };
}
