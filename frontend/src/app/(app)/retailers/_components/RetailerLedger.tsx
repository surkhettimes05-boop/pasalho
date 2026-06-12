'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Retailer } from '@/lib/api/sales';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils/cn';

interface Props {
  retailer: Retailer | null;
  open: boolean;
  onClose: () => void;
}

export function RetailerLedger({ retailer, open, onClose }: Props) {
  const ledgerQ = useQuery({
    queryKey: ['retailer-ledger', retailer?.id],
    queryFn: () => api.get(`/retailers/${retailer!.id}/ledger`) as Promise<{ items: any[]; outstanding: number }>,
    enabled: !!retailer && open,
  });

  if (!open || !retailer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{retailer.shopName}</h2>
            <p className="text-sm text-slate-500">{retailer.ownerName} · {retailer.phone}</p>
          </div>
          <div className="flex items-center gap-4">
            {ledgerQ.data ? (
              <div className="text-right">
                <div className="text-xs text-slate-500">Outstanding</div>
                <div className={`text-lg font-bold ${Number(ledgerQ.data.outstanding) > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {formatCurrency(ledgerQ.data.outstanding)}
                </div>
              </div>
            ) : null}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {ledgerQ.isLoading ? (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading ledger...
            </div>
          ) : !ledgerQ.data?.items?.length ? (
            <div className="px-6 py-8 text-sm text-slate-500">No ledger entries yet.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Type</TH>
                  <TH>Reference</TH>
                  <TH className="text-right">Debit</TH>
                  <TH className="text-right">Credit</TH>
                  <TH className="text-right">Balance After</TH>
                </TR>
              </THead>
              <TBody>
                {ledgerQ.data.items.map((e: any) => (
                  <TR key={e.id}>
                    <TD className="text-xs text-slate-500">{formatDate(e.createdAt)}</TD>
                    <TD>
                      <Badge variant={e.entryType === 'INVOICE_DEBIT' ? 'red' : 'green'}>
                        {e.entryType.replace('_', ' ')}
                      </Badge>
                    </TD>
                    <TD className="font-mono text-xs text-slate-500">{e.referenceId?.slice(0, 12)}…</TD>
                    <TD className="text-right tabular-nums text-red-600">
                      {Number(e.debitAmount) > 0 ? formatCurrency(e.debitAmount) : '—'}
                    </TD>
                    <TD className="text-right tabular-nums text-green-700">
                      {Number(e.creditAmount) > 0 ? formatCurrency(e.creditAmount) : '—'}
                    </TD>
                    <TD className="text-right tabular-nums font-semibold">
                      {e.balanceAfter != null ? formatCurrency(e.balanceAfter) : '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>

        <div className="border-t px-6 py-3 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
