'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { salesApi } from '@/lib/api/sales';
import { api } from '@/lib/api/client';
import { formatCurrency, formatDate } from '@/lib/utils/cn';
import { RetailerLedger } from '../retailers/_components/RetailerLedger';
import { Retailer } from '@/lib/api/sales';

export default function CollectionsPage() {
  const [search, setSearch] = useState('');
  const [ledgerFor, setLedgerFor] = useState<Retailer | null>(null);

  const retailersQ = useQuery({
    queryKey: ['retailers'],
    queryFn: () => salesApi.listRetailers(),
  });

  // Filter retailers with outstanding balance
  const items = (retailersQ.data?.items ?? [])
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.shopName.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.code.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Collections</h1>
          <p className="mt-1 text-sm text-slate-500">Track outstanding payments and aging</p>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <Input
            placeholder="Search by name, phone, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {retailersQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading retailers...
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              No retailers found.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Code</TH>
                  <TH>Shop Name</TH>
                  <TH>Owner</TH>
                  <TH>Phone</TH>
                  <TH className="text-right">Credit Limit</TH>
                  <TH className="text-right">Outstanding</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((r) => (
                  <RetailerRow key={r.id} retailer={r} onViewLedger={() => setLedgerFor(r)} />
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RetailerLedger
        retailer={ledgerFor}
        open={ledgerFor !== null}
        onClose={() => setLedgerFor(null)}
      />
    </div>
  );
}

function RetailerRow({ retailer, onViewLedger }: { retailer: Retailer; onViewLedger: () => void }) {
  const outstandingQ = useQuery({
    queryKey: ['retailer-outstanding', retailer.id],
    queryFn: () => api.get(`/finance/retailers/${retailer.id}/outstanding`) as Promise<{ outstanding: number }>,
  });

  const outstanding = outstandingQ.data?.outstanding ?? 0;
  const creditLimit = Number(retailer.creditLimit ?? 0);
  const creditUtilization = creditLimit > 0 ? (outstanding / creditLimit) * 100 : 0;

  return (
    <TR>
      <TD className="font-mono text-xs text-slate-700">{retailer.code}</TD>
      <TD className="font-medium text-slate-900">{retailer.shopName}</TD>
      <TD>{retailer.ownerName}</TD>
      <TD className="font-mono text-sm">{retailer.phone}</TD>
      <TD className="text-right tabular-nums">{formatCurrency(creditLimit)}</TD>
      <TD className="text-right tabular-nums">
        <div className="flex flex-col items-end">
          <span className={outstanding > 0 ? 'text-red-600 font-semibold' : 'text-green-700'}>
            {formatCurrency(outstanding)}
          </span>
          <span className="text-xs text-slate-500">
            {creditUtilization.toFixed(1)}% utilized
          </span>
        </div>
      </TD>
      <TD>
        <Badge variant={statusVariant(retailer.status)}>{retailer.status}</Badge>
      </TD>
      <TD className="text-right">
        <Button size="sm" variant="outline" onClick={onViewLedger}>
          View Ledger
        </Button>
      </TD>
    </TR>
  );
}
