import Link from 'next/link';

const tabs = [['/franchise', 'Overview'], ['/franchise/partners', 'Partners'], ['/franchise/stores', 'Stores'], ['/franchise/supply-orders', 'Supply Orders']];

export default function FranchiseLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5"><header><p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Distribution · Franchise</p><nav className="mt-3 flex flex-wrap gap-2" aria-label="Franchise navigation">{tabs.map(([href, label]) => <Link key={href} href={href} className="rounded-md border bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">{label}</Link>)}</nav></header>{children}</div>;
}
