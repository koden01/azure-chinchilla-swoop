import React, { useEffect, useRef, useState, useCallback } from 'react';
import Quagga from 'quagga';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { beepSuccess, beepFailure } from '@/utils/audio';

interface BarcodeScannerQuaggaProps {
  onScan: (decodedText: string) => void;
  onClose: () => void; // Untuk memberi sinyal kepada parent untuk mematikan kamera
  isActive: boolean;
}

const BarcodeScannerQuagga: React.FC<BarcodeScannerQuaggaProps> = ({ onScan, onClose, isActive }) => {
  const interactiveRef = useRef<HTMLDivElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastDetectedCode = useRef<string | null>(null);
  const lastDetectionTime = useRef<number>(0);
  const detectionCooldown = 1500; // Cooldown untuk mencegah pemindaian ulang barcode yang sama terlalu cepat

  useEffect(() => {
    if (!isActive) {
      console.log("[QuaggaJS] Stopping scanner.");
      Quagga.stop();
      setIsInitializing(false);
      setCameraError(null);
      return;
    }

    if (!interactiveRef.current) {
      console.error("[QuaggaJS] Interactive element not found.");
      setCameraError("Gagal memulai kamera: Elemen tampilan tidak tersedia.");
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    setCameraError(null);
    lastDetectedCode.current = null;

    console.log("[QuaggaJS] Initializing scanner...");

    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: interactiveRef.current,
        constraints: {
          facingMode: "environment", // Prioritaskan kamera belakang
          width: { min: 640, ideal: 1280, max: 1920 }, // Meminta lebar ideal yang lebih besar
          height: { min: 480, ideal: 720, max: 1080 }, // Meminta tinggi ideal yang lebih kecil dari lebar
        },
      },
      decoder: {
        readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader"],
      },
      locate: true, // Aktifkan penggambaran kotak pembatas
      numOfWorkers: 0, // Gunakan 0 untuk berjalan di main thread untuk debugging yang lebih sederhana
      frequency: 5, // Mengurangi frekuensi pemrosesan frame untuk mengurangi beban CPU
    }, (err) => {
      if (err) {
        console.error("[QuaggaJS] Initialization error:", err);
        setCameraError(`Gagal memulai kamera: ${err.message || "Pastikan izin kamera diberikan dan aplikasi berjalan di HTTPS."}`);
        setIsInitializing(false);
        beepFailure.play().catch(() => console.log("Audio play failed"));
        return;
      }
      console.log("[QuaggaJS] Initialization finished. Starting scanner.");
      Quagga.start();
      setIsInitializing(false);
      beepSuccess.play().catch(() => console.log("Audio play failed")); // Putar beep sukses saat kamera dimulai
    });

    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      if (code) {
        // Implementasi cooldown untuk mencegah pemindaian ulang barcode yang sama terlalu cepat
        if (lastDetectedCode.current === code && (Date.now() - lastDetectionTime.current < detectionCooldown)) {
          return;
        }
        lastDetectedCode.current = code;
        lastDetectionTime.current = Date.now(); // Simpan waktu deteksi terakhir

        console.log("[QuaggaJS] Barcode detected:", code);
        onScan(code);
        beepSuccess.play().catch(() => console.log("Audio play failed"));
        
        // Reset lastDetectedCode setelah cooldown untuk memungkinkan pemindaian ulang kode yang sama setelah penundaan
        setTimeout(() => {
          if (lastDetectedCode.current === code) { // Hanya hapus jika masih kode yang sama
            lastDetectedCode.current = null;
          }
        }, detectionCooldown);
      }
    });

    Quagga.onProcessed((result) => {
      const drawingCtx = Quagga.canvas.ctx.overlay;
      const drawingCanvas = Quagga.canvas.dom.overlay;

      if (drawingCtx && drawingCanvas) {
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

        if (result && result.boxes) {
          result.boxes.filter((box) => box !== result.box).forEach((box) => {
            Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
          });
        }

        if (result && result.box) {
          Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "lime", lineWidth: 4 });
        }
      }
    });

    return () => {
      console.log("[QuaggaJS] Cleanup effect running.");
      Quagga.stop();
      Quagga.offDetected();
      Quagga.offProcessed();
    };
  }, [isActive, onScan, onClose]); // Dependencies: isActive, onScan, onClose

  const handleRetryCamera = () => {
    console.log("[QuaggaJS] Retrying camera initialization...");
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

      <div id="interactive" ref={interactiveRef} className="viewport w-full h-full object-cover" />
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

export default BarcodeScannerQuagga;