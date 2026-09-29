'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { franchiseApi } from '@/lib/api/franchise';

export default function FranchiseStoresPage() {
  const qc = useQueryClient(); const [partnerId, setPartnerId] = useState(''); const [name, setName] = useState(''); const [address, setAddress] = useState('');
  const partners = useQuery({ queryKey: ['franchise-partners'], queryFn: franchiseApi.listPartners });
  const stores = useQuery({ queryKey: ['franchise-stores'], queryFn: franchiseApi.listStores });
  const create = useMutation({ mutationFn: () => franchiseApi.createStore({ partnerId, name, address }), onSuccess: () => { setName(''); setAddress(''); qc.invalidateQueries({ queryKey: ['franchise-stores'] }); qc.invalidateQueries({ queryKey: ['franchise-overview'] }); } });
  return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Franchise Stores</h1><p className="mt-1 text-sm text-slate-600">Connect each store to its franchise partner.</p></header>
    <form className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><Select label="Partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}><option value="">Select partner</option>{(partners.data ?? []).filter((p) => p.status === 'ACTIVE').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><Input label="Store name" value={name} onChange={(e) => setName(e.target.value)} required /><Input label="Location / address" value={address} onChange={(e) => setAddress(e.target.value)} required /><Button className="self-end" disabled={create.isPending || !partnerId || !name || !address}>Add store</Button>{create.isError && <p role="alert" className="text-sm text-red-700">{(create.error as Error).message}</p>}</form>
    <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Store</th><th className="p-3">Partner</th><th className="p-3">Location</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y">{(stores.data ?? []).map((s) => <tr key={s.id}><td className="p-3 font-semibold">{s.name}</td><td className="p-3">{s.partnerName}</td><td className="p-3">{s.address}</td><td className="p-3">{s.status}</td></tr>)}</tbody></table></div>
  </div>;
}
