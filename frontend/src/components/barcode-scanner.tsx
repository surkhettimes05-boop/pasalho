'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Props = {
  onScan: (code: string) => void;
  onClose: () => void;
};

const ELEMENT_ID = 'barcode-scanner-region';

export function BarcodeScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const el = document.getElementById(ELEMENT_ID);
    if (!el) return;

    const scanner = new Html5Qrcode(ELEMENT_ID, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
    });
    scannerRef.current = scanner;

    (async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!cameras || cameras.length === 0) {
          setError('No camera found. Use manual entry below.');
          setStarting(false);
          return;
        }
        const cameraId = cameras[0].id;
        await scanner.start(
          cameraId,
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (cancelled) return;
            scanner.stop().catch(() => {});
            onScan(decodedText);
          },
          () => {
            // per-frame error, ignore
          },
        );
        if (!cancelled) setStarting(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(
          e?.message?.includes('Permission')
            ? 'Camera permission denied. Use manual entry below.'
            : 'Could not start camera. Use manual entry below.',
        );
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      scanner.stop().catch(() => {});
      scanner.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitManual = () => {
    if (manualCode.trim()) {
      scannerRef.current?.stop().catch(() => {});
      onScan(manualCode.trim());
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-black">
        <div id={ELEMENT_ID} className="w-full" style={{ minHeight: 240 }} />
        {starting && !error ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
            Starting camera...
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-amber-700">{error}</p>
      ) : (
        <p className="text-xs text-slate-500">
          Point the camera at a barcode. The first successful read closes the scanner.
        </p>
      )}

      <div className="border-t border-slate-200 pt-3">
        <p className="mb-2 text-xs font-medium text-slate-600">Manual entry (no camera)</p>
        <div className="flex gap-2">
          <Input
            placeholder="Type or paste barcode..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitManual();
              }
            }}
          />
          <Button type="button" onClick={submitManual} disabled={!manualCode.trim()}>
            Use
          </Button>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-3">
        <Button variant="outline" type="button" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
