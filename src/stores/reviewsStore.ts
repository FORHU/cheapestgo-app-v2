import { create } from 'zustand';

interface ReviewsState {
    displayCount: number;
    sortBy: 'newest' | 'highest' | 'lowest';
    expandedReviewIds: Set<string>;

    loadMore: () => void;
    resetDisplayCount: (initial?: number) => void;
    setSortBy: (sort: 'newest' | 'highest' | 'lowest') => void;
    toggleExpanded: (reviewId: string) => void;
    isExpanded: (reviewId: string) => boolean;
}

export const useReviewsStore = create<ReviewsState>((set, get) => ({
    displayCount: 4,
    sortBy: 'newest',
    expandedReviewIds: new Set(),

    loadMore: () => set((state) => ({ displayCount: state.displayCount + 4 })),

    resetDisplayCount: (initial = 4) => set({ displayCount: initial }),

    setSortBy: (sortBy) => set({ sortBy }),

    toggleExpanded: (reviewId) => set((state) => {
        const newSet = new Set(state.expandedReviewIds);
        if (newSet.has(reviewId)) newSet.delete(reviewId);
        else newSet.add(reviewId);
        return { expandedReviewIds: newSet };
    }),

    isExpanded: (reviewId) => get().expandedReviewIds.has(reviewId),
}));
