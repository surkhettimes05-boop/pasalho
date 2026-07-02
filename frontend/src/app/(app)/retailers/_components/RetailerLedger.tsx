'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Retailer } from '@/lib/api/sales';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils/cn';

interface Props {
  retailer: Retailer | null;
  open: boolean;
  onClose: () => void;
}

export function RetailerLedger({ retailer, open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState('ledger');

  const ledgerQ = useQuery({
    queryKey: ['retailer-ledger', retailer?.id],
    queryFn: () => api.get(`/finance/retailers/${retailer!.id}/ledger`) as Promise<{ items: any[]; outstanding: number }>,
    enabled: !!retailer && open,
  });

  const agingQ = useQuery({
    queryKey: ['retailer-aging', retailer?.id],
    queryFn: () => api.get(`/finance/retailers/${retailer!.id}/aging`) as Promise<{ outstanding: number; buckets: Array<{ days: string; amount: number; count: number }> }>,
    enabled: !!retailer && open && activeTab === 'aging',
  });

  if (!open || !retailer) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={retailer.shopName}
      size="xl"
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{retailer.ownerName} · {retailer.phone}</p>
          {ledgerQ.data ? (
            <div className="text-right">
              <div className="text-xs text-slate-500">Outstanding</div>
              <div className={`text-lg font-bold ${Number(ledgerQ.data.outstanding) > 0 ? 'text-red-600' : 'text-green-700'}`}>
                {formatCurrency(ledgerQ.data.outstanding)}
              </div>
            </div>
          ) : null}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="aging">Aging Report</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-4">
            {ledgerQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner size="sm" /> Loading ledger...
              </div>
            ) : !ledgerQ.data?.items?.length ? (
              <div className="text-sm text-slate-500">No ledger entries yet.</div>
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
                        <Badge variant={e.entryType.includes('DEBIT') ? 'red' : 'green'}>
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
          </TabsContent>

          <TabsContent value="aging" className="space-y-4">
            {agingQ.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner size="sm" /> Loading aging report...
              </div>
            ) : agingQ.data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  {agingQ.data.buckets.map((bucket) => (
                    <div key={bucket.days} className="rounded-lg border p-4">
                      <div className="text-xs text-slate-500">{bucket.days} days</div>
                      <div className="mt-2 text-lg font-bold text-slate-900">
                        {formatCurrency(bucket.amount)}
                      </div>
                      <div className="text-xs text-slate-500">{bucket.count} invoices</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </Modal>
  );
}
