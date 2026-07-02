'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge, statusVariant } from '@/components/ui/badge';
import { damageApi } from '@/lib/api/phase4';
import { formatDate, formatNumber } from '@/lib/utils/cn';

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  PHYSICAL: 'Physical', EXPIRED: 'Expired', WATER: 'Water', PEST: 'Pest', OTHER: 'Other',
};

export default function DamageReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['damage-report', id],
    queryFn: () => damageApi.findById(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['damage-report', id] });
    queryClient.invalidateQueries({ queryKey: ['damage-reports'] });
  };

  const submitMutation = useMutation({ mutationFn: () => damageApi.submit(id), onSuccess: invalidate });
  const approveMutation = useMutation({ mutationFn: () => damageApi.approve(id), onSuccess: invalidate });
  const rejectMutation = useMutation({
    mutationFn: () => damageApi.reject(id, rejectReason || 'Rejected'),
    onSuccess: () => { invalidate(); setShowRejectInput(false); },
  });
  const postMutation = useMutation({ mutationFn: () => damageApi.post(id), onSuccess: invalidate });

  if (isLoading) return <Spinner />;
  if (!report) return <div className="py-12 text-center text-gray-500">Report not found.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{report.reportNo}</h1>
            <Badge className={statusVariant(report.status)}>{report.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Created {formatDate(report.createdAt)} by {report.createdBy?.fullName}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/stock/damage')}>Back</Button>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Warehouse</p>
          <p className="mt-1 font-semibold">{report.warehouse?.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Branch</p>
          <p className="mt-1 font-semibold">{report.branch?.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Approved By</p>
          <p className="mt-1 font-semibold">{report.approvedBy?.fullName ?? '—'}</p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</p>
        <p className="mt-1 text-sm">{report.reason}</p>
        {report.notes && <p className="mt-1 text-sm text-gray-500">{report.notes}</p>}
      </div>

      {report.rejectionReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Rejected: {report.rejectionReason}</p>
        </div>
      )}

      {/* Items */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Damaged Items</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Damage Type</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.product?.name}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{item.batch?.batchNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unit?.symbol}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">-{formatNumber(item.quantity)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{DAMAGE_TYPE_LABELS[item.damageType] ?? item.damageType}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{item.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workflow actions */}
      {report.status === 'DRAFT' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm text-blue-800">Review items above, then submit for manager approval.</p>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
          </Button>
        </div>
      )}

      {report.status === 'SUBMITTED' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-sm text-amber-800">Awaiting manager approval. Approve to move forward or reject to send back.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </Button>
            <Button variant="outline" onClick={() => setShowRejectInput((v) => !v)}>Reject</Button>
          </div>
          {showRejectInput && (
            <div className="mt-3 flex gap-2">
              <Input placeholder="Rejection reason..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="flex-1" />
              <Button variant="outline" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>Confirm Reject</Button>
            </div>
          )}
        </div>
      )}

      {report.status === 'APPROVED' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm text-green-800">
            Approved. Posting will deduct items from AVAILABLE stock and move them to DAMAGED state.
          </p>
          <Button onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
            {postMutation.isPending ? 'Posting...' : 'Post to Ledger'}
          </Button>
        </div>
      )}

      {report.status === 'POSTED' && (
        <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
          Posted on {formatDate(report.postedAt!)}. Stock has been deducted from AVAILABLE and credited to DAMAGED.
        </div>
      )}
    </div>
  );
}
