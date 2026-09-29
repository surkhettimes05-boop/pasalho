'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { franchiseApi } from '@/lib/api/franchise';

export default function FranchisePartnersPage() {
  const qc = useQueryClient(); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState('');
  const partners = useQuery({ queryKey: ['franchise-partners'], queryFn: franchiseApi.listPartners });
  const create = useMutation({ mutationFn: () => franchiseApi.createPartner({ name, phone, email: email || undefined }), onSuccess: () => { setName(''); setPhone(''); setEmail(''); qc.invalidateQueries({ queryKey: ['franchise-partners'] }); qc.invalidateQueries({ queryKey: ['franchise-overview'] }); } });
  return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Franchise Partners</h1><p className="mt-1 text-sm text-slate-600">Create partner records for franchise stores.</p></header>
    <form className="grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><Input label="Partner name" value={name} onChange={(e) => setName(e.target.value)} required /><Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required /><Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><Button className="self-end" disabled={create.isPending || !name || !phone}>Add partner</Button>{create.isError && <p role="alert" className="text-sm text-red-700">{(create.error as Error).message}</p>}</form>
    <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Email</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y">{(partners.data ?? []).map((p) => <tr key={p.id}><td className="p-3 font-semibold">{p.name}</td><td className="p-3">{p.phone}</td><td className="p-3">{p.email ?? '—'}</td><td className="p-3">{p.status}</td></tr>)}</tbody></table></div>
  </div>;
}
