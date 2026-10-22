"use client";

import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = ["ean_13", "ean_8", "upc_a", "code_128"];

function CameraView({ onCode, onFail }: { onCode: (code: string) => void; onFail: (msg: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onCodeRef.current = onCode;
    onFailRef.current = onFail;
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const video = videoRef.current;

    async function start() {
      try {
        const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
        const detector = new Detector({ formats: FORMATS });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video);
            const code = found[0]?.rawValue;
            if (code && !stopped) {
              stopped = true;
              onCodeRef.current(code);
              return;
            }
          } catch {
            // Un cuadro sin lectura no es un error.
          }
          timer = setTimeout(tick, 200);
        };
        tick();
      } catch {
        if (!stopped) onFailRef.current("No pudimos abrir la cámara. Revisa el permiso del navegador.");
      }
    }
    start();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, []);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      className="aspect-[4/3] w-full rounded-2xl bg-black object-cover"
      aria-label="Vista de la cámara"
    />
  );
}

export function CameraScanButton({ onScan }: { onScan: (code: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Se comprueba tras montar para no generar diferencias de hidratación.
    setSupported("BarcodeDetector" in window); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  if (!supported) return null;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <ScanLine size={16} aria-hidden />
        Cámara
      </Button>
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Escanear código">
        {open ? (
          <div className="flex flex-col gap-3">
            <CameraView
              onCode={(code) => {
                setOpen(false);
                onScan(code);
              }}
              onFail={setError}
            />
            {error ? (
              <p role="alert" className="text-sm text-[var(--color-expense)]">
                {error}
              </p>
            ) : (
              <p className="text-center text-xs text-[var(--color-text-muted)]">Apunta al código de barras.</p>
            )}
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
