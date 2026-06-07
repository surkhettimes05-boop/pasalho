'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { api } from '@/lib/api/client';
import { formatNumber, formatDateTime } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toaster';

type AdjustmentStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';

type StockAdjustment = {
  id: string;
  referenceNumber?: string;
  warehouseId: string;
  warehouse?: { name: string; code: string };
  productId: string;
  product?: { name: string; skuCode: string };
  quantityDelta: number | string;
  reasonCode: string;
  status: AdjustmentStatus;
  createdBy?: { fullName: string };
  createdAt: string;
};

const STATUSES: (AdjustmentStatus | 'ALL')[] = [
  'ALL',
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'POSTED',
  'CANCELLED',
];

export default function StockAdjustmentsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<AdjustmentStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const listQ = useQuery({
    queryKey: ['stock-adjustments', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== 'ALL') params.set('status', status);
      params.set('limit', '100');
      try {
        const res = (await api.get(
          `/inventory/adjustments?${params.toString()}`,
        )) as { items: StockAdjustment[]; total: number };
        return (res?.items ?? []) as StockAdjustment[];
      } catch {
        return [] as StockAdjustment[];
      }
    },
  });

  const transition = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) =>
      api.post(`/inventory/adjustments/${id}/${action}`),
    onSuccess: (_d, vars) => {
      toast({ title: `Adjustment ${vars.action}ed`, variant: 'success' });
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
    },
    onError: (e: Error) =>
      toast({ title: 'Action failed', description: e.message, variant: 'error' }),
  });

  const items = (listQ.data ?? []).filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.referenceNumber?.toLowerCase().includes(q) ||
      a.product?.name?.toLowerCase().includes(q) ||
      a.product?.skuCode?.toLowerCase().includes(q) ||
      a.reasonCode.toLowerCase().includes(q)
    );
  });

  const nextAction = (s: AdjustmentStatus): { action: string; label: string } | null => {
    if (s === 'DRAFT') return { action: 'submit', label: 'Submit' };
    if (s === 'SUBMITTED') return { action: 'approve', label: 'Approve' };
    if (s === 'APPROVED') return { action: 'post', label: 'Post' };
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Adjustments</h1>
          <p className="mt-1 text-sm text-slate-500">
            DRAFT → SUBMITTED → APPROVED → POSTED
          </p>
        </div>
        <Link href="/stock/adjustments/new">
          <Button>+ New Adjustment</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:max-w-sm">
              <Input label="Search" placeholder="Reference, product, reason..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {listQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading adjustments...
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">No adjustments found.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Ref #</TH>
                  <TH>Warehouse</TH>
                  <TH>Product</TH>
                  <TH className="text-right">Qty Delta</TH>
                  <TH>Reason</TH>
                  <TH>Status</TH>
                  <TH>Created By</TH>
                  <TH>Created</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((a) => {
                  const nx = nextAction(a.status);
                  return (
                    <TR key={a.id}>
                      <TD className="font-mono text-xs">{a.referenceNumber ?? a.id.slice(0, 8)}</TD>
                      <TD>{a.warehouse?.name ?? a.warehouseId.slice(0, 8)}</TD>
                      <TD className="font-medium text-slate-900">
                        {a.product?.name ?? a.productId.slice(0, 8)}
                      </TD>
                      <TD
                        className={
                          'text-right tabular-nums font-semibold ' +
                          (Number(a.quantityDelta) < 0 ? 'text-red-600' : 'text-green-700')
                        }
                      >
                        {Number(a.quantityDelta) > 0 ? '+' : ''}
                        {formatNumber(a.quantityDelta)}
                      </TD>
                      <TD className="text-sm">{a.reasonCode}</TD>
                      <TD>
                        <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                      </TD>
                      <TD className="text-sm">{a.createdBy?.fullName ?? '—'}</TD>
                      <TD className="text-xs text-slate-500">{formatDateTime(a.createdAt)}</TD>
                      <TD className="text-right">
                        {nx ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ id: a.id, action: nx.action })}
                          >
                            {nx.label}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
