"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Eraser, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A hand-drawn signature pad on a plain <canvas> (no dependency). Captures pointer strokes and,
 * on save, exports a PNG data URL. Always draws dark ink on white so the exported image reads on
 * any background.
 */
export function SignaturePad({
  onSave,
  saving = false,
  initialDataUrl,
  saved = false,
}: {
  onSave: (dataUrl: string) => void | Promise<void>;
  saving?: boolean;
  initialDataUrl?: string | null;
  saved?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasInk(true);
      };
      img.src = initialDataUrl;
    }
  }, [initialDataUrl]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  }

  function onUp() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function save() {
    if (!hasInk) return;
    onSave(canvasRef.current!.toDataURL("image/png"));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-white p-2 shadow-xs">
        <canvas
          ref={canvasRef}
          className="h-48 w-full touch-none rounded-lg bg-white"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={saving}>
          <Eraser className="size-4" /> Clear
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!hasInk || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {saved ? "Update signature" : "Save signature"}
        </Button>
        {saved && !saving && <span className="text-xs text-emerald-600">Saved ✓</span>}
      </div>
    </div>
  );
}
