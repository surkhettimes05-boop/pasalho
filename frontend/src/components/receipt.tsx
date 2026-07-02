import React from 'react';
import { Invoice } from '@/lib/api/sales';
import { formatCurrency, formatDateTime } from '@/lib/utils/cn';

interface ReceiptProps {
  invoice: Invoice;
}

export function Receipt({ invoice }: ReceiptProps) {
  const items = invoice.items ?? [];

  return (
    <div className="mx-auto w-[80mm] bg-white p-4 text-xs text-black">
      <div className="mb-4 text-center">
        <h1 className="text-lg font-bold">PASALO ENTERPRISE</h1>
        <p>Main Road, Kathmandu, Nepal</p>
        <p>Phone: +977-1-4XXXXXX</p>
        <div className="my-2 border-b border-dashed" />
        <h2 className="font-bold uppercase">Tax Invoice</h2>
      </div>

      <div className="mb-2 space-y-1">
        <div className="flex justify-between">
          <span>Inv #:</span>
          <span className="font-bold">{invoice.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{formatDateTime(invoice.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Customer:</span>
          <span className="text-right">{invoice.retailer?.shopName ?? 'Cash Customer'}</span>
        </div>
      </div>

      <div className="my-2 border-b border-dashed" />

      <table className="w-full">
        <thead>
          <tr className="text-left font-bold">
            <th className="pb-1">Item</th>
            <th className="pb-1 text-right">Qty</th>
            <th className="pb-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it: any, i: number) => (
            <tr key={i} className="align-top">
              <td className="py-1">
                {it.product?.name ?? it.productId}
                <div className="text-[10px] text-gray-500">
                  {Number(it.unitPrice).toFixed(2)}
                </div>
              </td>
              <td className="py-1 text-right">{Number(it.quantity)}</td>
              <td className="py-1 text-right">
                {formatCurrency(Number(it.quantity) * Number(it.unitPrice))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-b border-dashed" />

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatCurrency(invoice.subtotal)}</span>
        </div>
        {Number(invoice.discountTotal) > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>- {formatCurrency(invoice.discountTotal)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Total:</span>
          <span>{formatCurrency(invoice.grandTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Paid:</span>
          <span>{formatCurrency(invoice.paidAmount)}</span>
        </div>
        <div className="flex justify-between font-bold italic">
          <span>Due:</span>
          <span>{formatCurrency(invoice.dueAmount)}</span>
        </div>
      </div>

      <div className="my-4 border-b border-dashed" />

      <div className="text-center italic">
        <p>Thank you for your business!</p>
        <p>Goods once sold are not returnable.</p>
      </div>

      <div className="mt-4 flex justify-center opacity-30">
        {/* Placeholder for QR code or signature */}
        <div className="h-12 w-12 border border-black" />
      </div>
    </div>
  );
}
