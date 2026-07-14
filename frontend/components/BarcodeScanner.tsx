"use client";

import { useEffect, useRef, useState } from "react";

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const FORMATI_EAN = ["ean_13", "ean_8"];

export interface BarcodeScannerProps {
  onDetected: (codice: string) => void;
  onClose: () => void;
}

/** Scanner EAN: usa BarcodeDetector nativo dove disponibile, altrimenti @zxing/browser. */
export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    let annullato = false;
    let stream: MediaStream | null = null;
    let controlliZxing: { stop: () => void } | null = null;
    let animationFrame: number | null = null;

    async function avviaNativo(BarcodeDetectorCtor: BarcodeDetectorConstructor, video: HTMLVideoElement) {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (annullato) return;
      video.srcObject = stream;
      await video.play();
      const detector = new BarcodeDetectorCtor({ formats: FORMATI_EAN });

      const loop = async () => {
        if (annullato) return;
        try {
          const risultati = await detector.detect(video);
          const primo = risultati[0];
          if (primo) {
            onDetected(primo.rawValue);
            return;
          }
        } catch {
          // frame non decodificabile: si riprova al frame successivo
        }
        if (!annullato) {
          animationFrame = requestAnimationFrame(() => void loop());
        }
      };
      animationFrame = requestAnimationFrame(() => void loop());
    }

    async function avviaZxing(video: HTMLVideoElement) {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      if (annullato) return;
      const controlli = await reader.decodeFromVideoDevice(undefined, video, (result, _err, ctrl) => {
        if (result) {
          onDetected(result.getText());
          ctrl.stop();
        }
      });
      controlliZxing = controlli;
    }

    async function avvia(video: HTMLVideoElement) {
      try {
        if (typeof window !== "undefined" && window.BarcodeDetector) {
          await avviaNativo(window.BarcodeDetector, video);
        } else {
          await avviaZxing(video);
        }
      } catch {
        if (!annullato) {
          setErrore("Impossibile accedere alla fotocamera: inserisci il codice manualmente.");
        }
      }
    }

    void avvia(videoEl);

    return () => {
      annullato = true;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      if (controlliZxing) controlliZxing.stop();
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
      videoEl.srcObject = null;
    };
  }, [onDetected]);

  return (
    <div className="space-y-2 rounded border border-black/20 p-3 dark:border-white/20">
      <video ref={videoRef} className="w-full rounded bg-black" muted playsInline />
      {errore && <p className="text-sm text-red-600">{errore}</p>}
      <button
        type="button"
        onClick={onClose}
        className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/20"
      >
        Chiudi scanner
      </button>
    </div>
  );
}
