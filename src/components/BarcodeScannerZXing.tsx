import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { beepSuccess, beepFailure } from '@/utils/audio';

interface BarcodeScannerZXingProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  isActive: boolean;
}

const BarcodeScannerZXing: React.FC<BarcodeScannerZXingProps> = ({ onScan, onClose, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastDetectedCode = useRef<string | null>(null);
  const lastDetectionTime = useRef<number>(0);
  const detectionCooldown = 1500; // Cooldown untuk mencegah pemindaian ulang barcode yang sama terlalu cepat

  const hints = useMemo(() => {
    const h = new Map();
    const formats = [BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX];
    h.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    h.set(DecodeHintType.TRY_HARDER, true); // Coba lebih keras untuk mendeteksi
    return h;
  }, []); // Dependensi kosong agar hanya dibuat sekali

  useEffect(() => {
    if (!isActive) {
      console.log("[ZXing-JS] Stopping scanner.");
      if (codeReader.current) {
        codeReader.current.reset();
        codeReader.current = null; // Pastikan referensi diatur ulang
      }
      setIsInitializing(false);
      setCameraError(null);
      return;
    }

    if (!videoRef.current) {
      console.error("[ZXing-JS] Video element not found.");
      setCameraError("Gagal memulai kamera: Elemen tampilan tidak tersedia.");
      setIsInitializing(false);
      return;
    }

    // Reset state saat memulai inisialisasi baru
    setIsInitializing(true);
    setCameraError(null);
    lastDetectedCode.current = null;

    console.log("[ZXing-JS] Initializing scanner...");

    // Pastikan tidak ada instance codeReader yang berjalan
    if (codeReader.current) {
      codeReader.current.reset();
      codeReader.current = null;
    }

    codeReader.current = new BrowserMultiFormatReader(hints);

    codeReader.current.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
      // Set isInitializing ke false setelah deteksi pertama atau jika ada error inisialisasi
      if (isInitializing && !cameraError) {
        setIsInitializing(false);
        // beepSuccess.play().catch(() => console.log("Audio play failed")); // Dihapus: Tidak lagi membunyikan beep saat inisialisasi
      }

      if (result) {
        const code = result.getText();
        if (code) {
          if (lastDetectedCode.current === code && (Date.now() - lastDetectionTime.current < detectionCooldown)) {
            return;
          }
          lastDetectedCode.current = code;
          lastDetectionTime.current = Date.now();

          console.log("[ZXing-JS] Barcode detected:", code);
          onScan(code);
          beepSuccess.play().catch(() => console.log("Audio play failed"));

          setTimeout(() => {
            if (lastDetectedCode.current === code) {
              lastDetectedCode.current = null;
            }
          }, detectionCooldown);
        }
      }

      if (error) { // Log errors, but only set cameraError for critical ones
        if (error.name === 'NotFoundException') {
          // This error is expected if no barcode is found in a frame, don't log as critical
        } else if (error.name === 'NotAllowedError' || error.name === 'NotReadableError' || error.name === 'OverconstrainedError' || error.name === 'AbortError') {
          console.error("[ZXing-JS] Camera error:", error);
          setCameraError(`Gagal mengakses kamera: ${error.message || "Pastikan izin kamera diberikan dan aplikasi berjalan di HTTPS."}`);
          beepFailure.play().catch(() => console.log("Audio play failed"));
          codeReader.current?.reset();
        } else {
          // console.error("[ZXing-JS] Decoding error:", error); // Log other decoding errors if needed
        }
      }
    }).catch((err) => {
      console.error("[ZXing-JS] Initialization error:", err);
      setCameraError(`Gagal memulai kamera: ${err.message || "Pastikan izin kamera diberikan dan aplikasi berjalan di HTTPS."}`);
      setIsInitializing(false);
      beepFailure.play().catch(() => console.log("Audio play failed"));
    });

    return () => {
      console.log("[ZXing-JS] Cleanup effect running.");
      if (codeReader.current) {
        codeReader.current.reset();
        codeReader.current = null; // Pastikan referensi diatur ulang saat cleanup
      }
    };
  }, [isActive, onScan, hints, detectionCooldown]); // isInitializing dihapus dari dependensi

  const handleRetryCamera = () => {
    console.log("[ZXing-JS] Retrying camera initialization...");
    onClose(); // Ini akan mengatur isActive menjadi false di parent, memicu cleanup
    // Komponen parent perlu mengaktifkan kembali pemindai jika pengguna mengklik tombol toggle lagi
  };

  return (
    <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden">
      {isInitializing && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75 text-white z-10 p-4">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Memulai kamera...</p>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white z-10 p-4">
          <AlertTriangle className="h-12 w-12 mb-4 text-yellow-400" />
          <p className="text-center mb-4">{cameraError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryCamera}
            className="text-white border-white hover:bg-white/20"
          >
            Coba Lagi Kamera
          </Button>
        </div>
      )}

      <video ref={videoRef} className="w-full h-full object-cover" style={{ display: cameraError ? 'none' : 'block' }} />
      {!isInitializing && !cameraError && (
        <div className="absolute bottom-4 left-0 right-0 text-center z-20">
          <p className="text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full inline-block">
            Arahkan barcode ke tengah layar
          </p>
        </div>
      )}
    </div>
  );
};

export default BarcodeScannerZXing;