"use client";

import { useRef, useEffect, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { X, RotateCcw } from "lucide-react";

export default function SignaturePad({
  onSave,
  onClear,
  existingSignature = null,
  width = 400,
  height = 200,
  backgroundColor = "#ffffff",
  penColor = "#000000",
}) {
  const sigPadRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (existingSignature && sigPadRef.current) {
      sigPadRef.current.fromDataURL(existingSignature);
      setIsEmpty(false);
    }
  }, [existingSignature]);

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
        className="border-2 border-slate-300 rounded-lg overflow-hidden bg-white cursor-crosshair"
        style={{ width, height }}
      >
        <SignatureCanvas
          ref={sigPadRef}
          canvasProps={{
            width,
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

