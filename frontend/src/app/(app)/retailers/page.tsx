'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge, statusVariant } from '@/components/ui/badge';
import { salesApi, Retailer } from '@/lib/api/sales';
import { api } from '@/lib/api/client';
import { formatCurrency, formatDate } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toaster';
import { RetailerForm } from './_components/RetailerForm';
import { RetailerLedger } from './_components/RetailerLedger';

export default function RetailersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [ledgerFor, setLedgerFor] = useState<Retailer | null>(null);

  const listQ = useQuery({
    queryKey: ['retailers'],
    queryFn: () => salesApi.listRetailers(),
  });

  const items = (listQ.data?.items ?? []).filter((r) => {
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
          <h1 className="text-2xl font-bold text-slate-900">Retailers</h1>
          <p className="mt-1 text-sm text-slate-500">Manage retailers and view credit ledgers</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ New Retailer</Button>
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
          {listQ.isLoading ? (
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
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-mono text-xs text-slate-700">{r.code}</TD>
                    <TD className="font-medium text-slate-900">{r.shopName}</TD>
                    <TD>{r.ownerName}</TD>
                    <TD className="font-mono text-sm">{r.phone}</TD>
                    <TD className="text-right tabular-nums">{formatCurrency(r.creditLimit)}</TD>
                    <TD>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </TD>
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLedgerFor(r)}
                      >
                        View Ledger
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RetailerForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['retailers'] });
          setCreateOpen(false);
        }}
      />

      <RetailerLedger
        retailer={ledgerFor}
        open={ledgerFor !== null}
        onClose={() => setLedgerFor(null)}
      />
    </div>
  );
}
