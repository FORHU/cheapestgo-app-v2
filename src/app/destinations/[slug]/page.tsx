import { DestinationView } from '@/features/landing/components/destination-view';

interface Props {
    params: Promise<{ slug: string }>;
}

export default function DestinationPage({ params }: Props) {
    return <DestinationView params={params} />;
}
