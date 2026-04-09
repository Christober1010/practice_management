"use client";

import { useRef, useEffect, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { X, RotateCcw } from "lucide-react";

interface SignaturePadProps {
  onSave: (dataURL: string) => void;
  onClear?: () => void;
  existingSignature?: string | null;
  width?: number;
  height?: number;
  backgroundColor?: string;
  penColor?: string;
}

export default function SignaturePad({
  onSave,
  onClear,
  existingSignature = null,
  width = 400,
  height = 200,
  backgroundColor = "#ffffff",
  penColor = "#000000",
}: SignaturePadProps) {
  const sigPadRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [canvasWidth, setCanvasWidth] = useState<number>(width);

  useEffect(() => {
    if (existingSignature && sigPadRef.current) {
      sigPadRef.current.fromDataURL(existingSignature);
      setIsEmpty(false);
    }
  }, [existingSignature]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const w = el.clientWidth || width;
      // Keep a reasonable minimum so controls/layout don't collapse too much.
      const next = Math.max(280, Math.min(width, w));
      setCanvasWidth(next);
    };

    compute();

    // ResizeObserver for responsive canvas width
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    window.addEventListener('resize', compute);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [width]);

  const handleClear = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
      setIsEmpty(true);
      if (onClear) onClear();
    }
  };

  const handleSave = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const dataURL = sigPadRef.current.toDataURL("image/png");
      setIsEmpty(false);
      if (onSave) onSave(dataURL);
    }
  };

  const handleBegin = () => {
    setIsEmpty(false);
  };

  const handleEnd = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      setIsEmpty(false);
    } else {
      setIsEmpty(true);
    }
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="w-full max-w-full border-2 border-slate-300 rounded-lg overflow-hidden bg-white cursor-crosshair"
        style={{ height }}
      >
        <SignatureCanvas
          ref={sigPadRef}
          canvasProps={{
            width: canvasWidth,
            height,
            className: "signature-canvas w-full h-full",
            style: { touchAction: "none" },
          }}
          backgroundColor={backgroundColor}
          penColor={penColor}
          onBegin={handleBegin}
          onEnd={handleEnd}
          velocityFilterWeight={0.7}
          minWidth={1}
          maxWidth={3}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={isEmpty}
          className="flex-1"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isEmpty}
          className="flex-1 bg-teal-600 hover:bg-teal-700"
        >
          Save Signature
        </Button>
      </div>
      {existingSignature && !isEmpty && (
        <div className="text-xs text-slate-500 text-center">
          Signature loaded. Draw to update or click Clear to remove.
        </div>
      )}
    </div>
  );
}

