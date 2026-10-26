import type { Metadata } from 'next';
import { MultiplyForm } from '../../components/multiply-form';

export const metadata: Metadata = { title: 'Multiply SPY — Florin' };

export default function MultiplyPage() {
  return <MultiplyForm />;
}
