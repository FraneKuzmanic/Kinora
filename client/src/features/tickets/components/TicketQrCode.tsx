import { useEffect, useState } from "react";

type TicketQrCodeProps = {
  value: string;
  size?: number;
};

export function TicketQrCode({
  value,
  size = 220,
}: TicketQrCodeProps) {
  const [markup, setMarkup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderQr() {
      const { BrowserQRCodeSvgWriter } = await import(
        "html5-qrcode/third_party/zxing-js.umd.js"
      );
      const writer = new BrowserQRCodeSvgWriter();
      const svg = writer.write(value, size, size);

      if (!cancelled) {
        setMarkup(svg.outerHTML);
      }
    }

    void renderQr();

    return () => {
      cancelled = true;
    };
  }, [size, value]);

  if (!markup) {
    return (
      <div
        className="flex items-center justify-center bg-white text-[11px] uppercase tracking-[0.2em] text-[var(--color-bg-primary)]"
        style={{ width: size, height: size }}
      >
        Loading QR
      </div>
    );
  }

  return (
    <div
      className="bg-white p-4 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
