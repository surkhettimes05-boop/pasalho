'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils/cn';

const ACTIONS = [
  'ALL',
  'LOGIN_SUCCESS', 'LOGIN_FAILURE',
  'USER_CREATED', 'USER_UPDATED',
  'INVOICE_CREATED', 'INVOICE_POSTED', 'INVOICE_VOIDED', 'INVOICE_CANCELLED',
  'PAYMENT_RECORDED',
  'STOCK_ADJUSTMENT_CREATED', 'STOCK_ADJUSTMENT_POSTED',
  'RETAILER_CREATED', 'RETAILER_UPDATED',
  'PRODUCT_CREATED', 'PRODUCT_UPDATED',
  'BRANCH_CREATED', 'WAREHOUSE_CREATED',
];

const actionVariant = (action: string) => {
  if (action.includes('FAILURE') || action.includes('VOID') || action.includes('CANCEL')) return 'danger';
  if (action.includes('LOGIN_SUCCESS')) return 'success';
  if (action.includes('POSTED') || action.includes('APPROVED')) return 'success';
  return 'default';
};

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const logsQ = useQuery({
    queryKey: ['audit-logs', actionFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (actionFilter !== 'ALL') params.set('action', actionFilter);
      return api.get(`/audit-logs?${params.toString()}`) as Promise<{ items: any[]; total: number }>;
    },
  });

  const items = (logsQ.data?.items ?? []).filter((log: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.entityType?.toLowerCase().includes(q) ||
      log.entityId?.toLowerCase().includes(q) ||
      log.actor?.fullName?.toLowerCase().includes(q) ||
      log.actor?.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete history of all sensitive actions in the system
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-xs">
              <Select
                label="Filter by Action"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:max-w-sm">
              <Input
                label="Search"
                placeholder="Actor, entity, action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-slate-500 pb-1">
              {logsQ.isLoading ? 'Loading...' : `${items.length} entries`}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {logsQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading audit logs...
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">No audit log entries found.</div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Timestamp</TH>
                  <TH>Action</TH>
                  <TH>Entity</TH>
                  <TH>Actor</TH>
                  <TH>Branch</TH>
                  <TH>Details</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((log: any) => (
                  <TR key={log.id}>
                    <TD className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TD>
                    <TD>
                      <Badge variant={actionVariant(log.action)}>
                        {log.action.replace(/_/g, ' ')}
                      </Badge>
                    </TD>
                    <TD className="text-sm">
                      <span className="font-medium text-slate-700">{log.entityType}</span>
                      <span className="ml-1 font-mono text-xs text-slate-400">
                        {log.entityId?.slice(0, 8)}
                      </span>
                    </TD>
                    <TD className="text-sm">
                      {log.actor?.fullName ?? log.actorUserId?.slice(0, 8)}
                    </TD>
                    <TD className="text-xs text-slate-500">
                      {log.branch?.name ?? '—'}
                    </TD>
                    <TD className="text-xs text-slate-500">
                      {log.reason ? (
                        <span className="italic">{log.reason}</span>
                      ) : log.afterData ? (
                        <span className="font-mono">
                          {JSON.stringify(log.afterData).slice(0, 50)}
                        </span>
                      ) : '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
