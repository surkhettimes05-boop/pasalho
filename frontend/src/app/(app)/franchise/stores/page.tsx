'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { franchiseApi } from '@/lib/api/franchise';

export default function FranchiseStoresPage() {
  const qc = useQueryClient(); const [partnerId, setPartnerId] = useState(''); const [branchId, setBranchId] = useState(''); const [name, setName] = useState(''); const [address, setAddress] = useState('');
  const partners = useQuery({ queryKey: ['franchise-partners'], queryFn: franchiseApi.listPartners });
  const stores = useQuery({ queryKey: ['franchise-stores'], queryFn: franchiseApi.listStores });
  const branches = useQuery({ queryKey: ['franchise-branches'], queryFn: franchiseApi.listBranches });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['franchise-stores'] }); qc.invalidateQueries({ queryKey: ['franchise-overview'] }); };
  const create = useMutation({ mutationFn: () => franchiseApi.createStore({ partnerId, branchId, name, address }), onSuccess: () => { setName(''); setAddress(''); invalidate(); } });
  const assignBranch = useMutation({ mutationFn: ({ id, nextBranchId }: { id: string; nextBranchId: string }) => franchiseApi.assignStoreBranch(id, nextBranchId), onSuccess: invalidate });
  const activeBranches = branches.data?.filter((branch) => branch.status === 'ACTIVE') ?? [];
  return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Franchise Stores</h1><p className="mt-1 text-sm text-slate-600">Connect each store to its franchise partner and operating branch.</p></header>
    <form className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><Select label="Partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}><option value="">Select partner</option>{(partners.data ?? []).filter((p) => p.status === 'ACTIVE').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} required><option value="">Select branch</option>{activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</Select><Input label="Store name" value={name} onChange={(e) => setName(e.target.value)} required /><Input label="Location / address" value={address} onChange={(e) => setAddress(e.target.value)} required /><Button className="self-end" disabled={create.isPending || !partnerId || !branchId || !name || !address}>Add store</Button>{create.isError && <p role="alert" className="text-sm text-red-700">{(create.error as Error).message}</p>}</form>
    {branches.isError && <p role="alert" className="text-sm text-red-700">Could not load branches: {(branches.error as Error).message}</p>}
    <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Store</th><th className="p-3">Partner</th><th className="p-3">Branch</th><th className="p-3">Address</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y">{(stores.data ?? []).map((s) => { const selectedBranchId = s.branchId ?? ''; return <tr key={s.id}><td className="p-3 font-semibold">{s.name}</td><td className="p-3">{s.partnerName}</td><td className="p-3"><div className="flex min-w-64 gap-2"><Select aria-label={`Branch for ${s.name}`} label="" value={selectedBranchId} disabled={assignBranch.isPending || Boolean(s.inventoryLocationId)} onChange={(e) => assignBranch.mutate({ id: s.id, nextBranchId: e.target.value })}><option value="">Assign a branch</option>{activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}</Select>{s.inventoryLocationId && <span className="self-center text-xs text-slate-500">Location set</span>}</div></td><td className="p-3">{s.address}</td><td className="p-3">{s.status}</td></tr>; })}</tbody></table></div>
    {assignBranch.isError && <p role="alert" className="text-sm text-red-700">{(assignBranch.error as Error).message}</p>}
  </div>;
}
