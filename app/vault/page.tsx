import type { Metadata } from 'next';
import { Vault } from '../../components/vault';

export const metadata: Metadata = { title: 'Vault — Florin' };

export default function VaultPage() {
	return <Vault />;
}
