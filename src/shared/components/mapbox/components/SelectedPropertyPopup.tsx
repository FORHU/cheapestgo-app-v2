import React from 'react';
import { MapMarker } from '@/shared/components/map/MapMarker';
import type { MappableProperty } from '@/shared/components/map/types';
import { useUserCurrency } from '@/stores/searchStore';
import { convertCurrency } from '@/shared/lib/currency';

interface SelectedPropertyPopupProps {
    selectedProperty: MappableProperty | null;
    onClose: () => void;
    onViewDetails: (id: string) => void;
    onSelect: (id: string) => void;
    isMobile?: boolean;
}

export const SelectedPropertyPopup = React.memo(({
    selectedProperty,
    onClose,
    onViewDetails,
    onSelect,
    isMobile = false,
}: SelectedPropertyPopupProps) => {
    const targetCurrency = useUserCurrency();

    if (!selectedProperty) return null;

    // The preview card that used to sit above the pin is gone: the bottom rail
    // already shows the selected property, and enlarges its card on selection.
    return (
        <MapMarker
            property={selectedProperty}
            displayPrice={convertCurrency(selectedProperty.price, selectedProperty.currency || 'USD', targetCurrency)}
            displayCurrency={targetCurrency}
            isSelected={true}
            isHovered={false}
            onClick={() => onSelect(selectedProperty.id)}
            onHover={() => {}}
        />
    );
});
