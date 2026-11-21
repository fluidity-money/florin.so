import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMockStrategy } from '../../../lib/mock-vaults';
import { VaultDetail } from '../../../components/vault-detail';

export const metadata: Metadata = { title: 'Demo vault strategy — Florin' };

export default async function VaultStrategyPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const strategy = getMockStrategy(slug);
	if (!strategy) notFound();
	return <VaultDetail key={strategy.slug} strategy={strategy} />;
}
