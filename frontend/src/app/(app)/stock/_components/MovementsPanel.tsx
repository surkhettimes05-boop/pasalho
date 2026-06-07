'use client';

import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/app/(app)/products/_components/Modal';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { api } from '@/lib/api/client';
import { InventorySnapshot } from '@/lib/api/inventory';
import { formatNumber, formatDateTime } from '@/lib/utils/cn';

type Movement = {
  id: string;
  productId: string;
  warehouseId?: string;
  movementType: string;
  quantityDelta: number | string;
  unitId?: string;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  snapshot: InventorySnapshot | null;
};

export function MovementsPanel({ open, onClose, snapshot }: Props) {
  const movementsQ = useQuery({
    queryKey: ['stock-movements', snapshot?.productId, snapshot?.locationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (snapshot?.productId) params.set('productId', snapshot.productId);
      if (snapshot?.locationId) params.set('locationId', snapshot.locationId);
      try {
        const res = (await api.get(
          `/inventory/movements?${params.toString()}&limit=50`,
        )) as { items: Movement[]; total: number };
        return (res?.items ?? []) as Movement[];
      } catch {
        return [] as Movement[];
      }
    },
    enabled: open && snapshot !== null,
  });

  const movements: Movement[] = movementsQ.data ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={snapshot ? `Movements — ${snapshot.product?.name ?? '—'}` : 'Movements'}
      size="xl"
    >
      {movementsQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" /> Loading movements...
        </div>
      ) : movements.length === 0 ? (
        <p className="text-sm text-slate-500">
          No movements recorded for this product yet.
        </p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Type</TH>
              <TH className="text-right">Qty Delta</TH>
              <TH>Reason</TH>
              <TH>Reference</TH>
            </TR>
          </THead>
          <TBody>
            {movements.map((m) => (
              <TR key={m.id}>
                <TD className="text-xs text-slate-500">{formatDateTime(m.createdAt)}</TD>
                <TD>
                  <Badge variant={statusVariant(m.movementType)}>{m.movementType}</Badge>
                </TD>
                <TD
                  className={
                    'text-right tabular-nums font-semibold ' +
                    (Number(m.quantityDelta) < 0 ? 'text-red-600' : 'text-green-700')
                  }
                >
                  {Number(m.quantityDelta) > 0 ? '+' : ''}
                  {formatNumber(m.quantityDelta)}
                </TD>
                <TD className="text-sm">{m.reason ?? '—'}</TD>
                <TD className="font-mono text-xs text-slate-500">
                  {m.referenceType ? `${m.referenceType}: ${m.referenceId?.slice(0, 8) ?? '—'}` : '—'}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Modal>
  );
}
