'use client';

import { useQuery } from '@tanstack/react-query';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { api } from '@/lib/api/client';
import { formatDate, formatNumber } from '@/lib/utils/cn';
import type { Product } from '@/lib/api/catalog';

export interface Batch {
  id: string;
  productId: string;
  batchCode: string;
  manufactureDate?: string;
  expiryDate?: string;
  status: string;
  quantity: number | string;
}

type Props = {
  open: boolean;
  onClose: () => void;
  product: Product | null;
};

export function BatchesDialog({ open, onClose, product }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['batches', product?.id],
    queryFn: async () => {
      if (!product) return { items: [] as Batch[] };
      return api.get(`/catalog/batches?productId=${encodeURIComponent(product.id)}`) as Promise<{ items: Batch[] }>;
    },
    enabled: open && !!product,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? `Batches - ${product.name}` : 'Batches'}
      size="xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" /> Loading batches...
        </div>
      ) : error ? (
        <div className="text-sm text-red-600">
          Failed to load batches: {(error as Error).message}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-sm text-slate-500">No batches found for this product.</div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Batch Code</TH>
              <TH>Manufacture Date</TH>
              <TH>Expiry Date</TH>
              <TH>Status</TH>
              <TH className="text-right">Quantity</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((b) => (
              <TR key={b.id}>
                <TD className="font-medium text-slate-900">{b.batchCode}</TD>
                <TD>{formatDate(b.manufactureDate)}</TD>
                <TD>{formatDate(b.expiryDate)}</TD>
                <TD>
                  <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                </TD>
                <TD className="text-right">{formatNumber(b.quantity)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Modal>
  );
}
