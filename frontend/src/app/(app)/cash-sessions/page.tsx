'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/client';
import { formatCurrency, formatDate } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toaster';

export default function CashSessionsPage() {
  const qc = useQueryClient();
  const [openOpen, setOpenOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');

  const sessionsQ = useQuery({
    queryKey: ['cash-sessions'],
    queryFn: () => api.get('/finance/cash-sessions/history?take=50') as Promise<{ sessions: any[]; total: number }>,
  });

  const currentQ = useQuery({
    queryKey: ['current-cash-session'],
    queryFn: () => api.get('/finance/cash-sessions/current?branchId=default') as Promise<any>,
  });

  const openMutation = useMutation({
    mutationFn: (data: { branchId: string; openingBalance: number; notes?: string }) =>
      api.post('/finance/cash-sessions/open', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-sessions'] });
      qc.invalidateQueries({ queryKey: ['current-cash-session'] });
      setOpenOpen(false);
      setOpeningBalance('');
      setNotes('');
      toast.success('Cash session opened');
    },
  });

  const closeMutation = useMutation({
    mutationFn: (data: { sessionId: string; closingBalance: number; actualCash: number; notes?: string }) =>
      api.post(`/finance/cash-sessions/${data.sessionId}/close`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-sessions'] });
      qc.invalidateQueries({ queryKey: ['current-cash-session'] });
      setCloseOpen(null);
      setClosingBalance('');
      setActualCash('');
      setNotes('');
      toast.success('Cash session closed');
    },
  });

  const handleOpen = () => {
    openMutation.mutate({
      branchId: 'default',
      openingBalance: parseFloat(openingBalance),
      notes: notes || undefined,
    });
  };

  const handleClose = () => {
    if (!closeOpen) return;
    closeMutation.mutate({
      sessionId: closeOpen,
      closingBalance: parseFloat(closingBalance),
      actualCash: parseFloat(actualCash),
      notes: notes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cash Sessions</h1>
          <p className="mt-1 text-sm text-slate-500">Manage daily cash sessions and reconciliation</p>
        </div>
        {!currentQ.data && (
          <Button onClick={() => setOpenOpen(true)}>+ Open Session</Button>
        )}
      </div>

      {currentQ.data && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-green-900">Current Session Open</div>
                <div className="text-xs text-green-700">
                  Opened at {formatDate(currentQ.data.openedAt)} by {currentQ.data.openedBy?.fullName}
                </div>
              </div>
              <Button onClick={() => setCloseOpen(currentQ.data.id)}>Close Session</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessionsQ.isLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Spinner size="sm" /> Loading sessions...
            </div>
          ) : !sessionsQ.data?.sessions?.length ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              No cash sessions yet.
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Opened At</TH>
                  <TH>Opened By</TH>
                  <TH className="text-right">Opening Balance</TH>
                  <TH className="text-right">Closing Balance</TH>
                  <TH className="text-right">Variance</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {sessionsQ.data.sessions.map((session: any) => (
                  <TR key={session.id}>
                    <TD className="text-sm text-slate-500">{formatDate(session.openedAt)}</TD>
                    <TD>{session.openedBy?.fullName || '—'}</TD>
                    <TD className="text-right tabular-nums">{formatCurrency(session.openingBalance)}</TD>
                    <TD className="text-right tabular-nums">
                      {session.closingBalance ? formatCurrency(session.closingBalance) : '—'}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {session.variance !== null && session.variance !== undefined ? (
                        <span className={Math.abs(Number(session.variance)) > 0 ? 'text-red-600 font-semibold' : 'text-green-700'}>
                          {formatCurrency(session.variance)}
                        </span>
                      ) : '—'}
                    </TD>
                    <TD>
                      <Badge variant={session.status === 'OPEN' ? 'blue' : 'green'}>
                        {session.status}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        open={openOpen}
        onClose={() => setOpenOpen(false)}
        title="Open Cash Session"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpenOpen(false)}>Cancel</Button>
            <Button onClick={handleOpen} disabled={openMutation.isPending}>
              {openMutation.isPending ? 'Opening...' : 'Open Session'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Opening Balance</Label>
            <Input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this session..."
              rows={3}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={closeOpen !== null}
        onClose={() => setCloseOpen(null)}
        title="Close Cash Session"
        footer={
          <>
            <Button variant="outline" onClick={() => setCloseOpen(null)}>Cancel</Button>
            <Button onClick={handleClose} disabled={closeMutation.isPending}>
              {closeMutation.isPending ? 'Closing...' : 'Close Session'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Closing Balance</Label>
            <Input
              type="number"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Actual Cash Count</Label>
            <Input
              type="number"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about variance..."
              rows={3}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
