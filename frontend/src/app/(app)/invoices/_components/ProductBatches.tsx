'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';

export interface Batch {
  id: string;
  productId: string;
  batchCode: string;
  manufactureDate?: string;
  expiryDate?: string;
  status: string;
  quantity?: number | string;
}

/**
 * Hook that returns the available batches for a given product, sorted with the
 * soonest-expiring ACTIVE batch first. Returns an empty list when the product
 * is not batch-tracked or the API call fails.
 */
export function useProductBatches(productId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['product-batches', productId],
    queryFn: async () => {
      if (!productId) return [] as Batch[];
      try {
        const res = (await api.get(
          `/catalog/batches?productId=${encodeURIComponent(productId)}`,
        )) as { items?: Batch[] };
        const list = res?.items ?? [];
        return list.filter((b) => !b.status || b.status === 'ACTIVE' || b.status === 'AVAILABLE');
      } catch {
        return [] as Batch[];
      }
    },
    enabled: !!productId && enabled,
    staleTime: 30_000,
  });
}

type Props = {
  productId: string;
  isBatchTracked: boolean;
  value: string | undefined;
  onChange: (batchId: string) => void;
};

export function BatchSelect({ productId, isBatchTracked, value, onChange }: Props) {
  const q = useProductBatches(productId, isBatchTracked);

  if (!isBatchTracked) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  if (q.isLoading) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Spinner size="sm" /> loading
      </span>
    );
  }
  const list = q.data ?? [];
  if (list.length === 0) {
    return <span className="text-xs text-amber-600">no batches</span>;
  }
  return (
    <select
      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select batch</option>
      {list.map((b) => (
        <option key={b.id} value={b.id}>
          {b.batchCode}
          {b.expiryDate ? ` (exp ${b.expiryDate.slice(0, 10)})` : ''}
        </option>
      ))}
    </select>
  );
}
