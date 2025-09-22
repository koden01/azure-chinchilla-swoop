import React, { useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';

interface BarcodeScannerQuaggaProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const BarcodeScannerQuagga: React.FC<BarcodeScannerQuaggaProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;

    const initializeQuagga = async () => {
      setIsInitializing(true);
      setIsScanning(false); // Ensure scanning is false until init is complete

      try {
        await Quagga.init({
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: videoRef.current,
            constraints: {
              width: { min: 640 },
              height: { min: 480 },
              aspectRatio: { min: 1, max: 100 },
              facingMode: "environment", // Prefer rear camera
            },
          },
          locator: {
            patchSize: "medium",
            halfSample: true,
            debug: {
              showCanvas: false, // Set to true for debugging Quagga's detection
              showPatches: false,
              showFoundPatches: false,
              showSkeleton: false,
              showLabels: false,
              showTestMarkers: false,
              showQuagga: false,
            },
          },
          numOfWorkers: navigator.hardwareConcurrency || 0, // Use all available cores
          locate: true,
          decoder: {
            readers: [
              "code_128_reader",
              "ean_reader",
              "ean_8_reader",
              "code_39_reader",
              "code_39_vin_reader",
              "codabar_reader",
              "upc_reader",
              "upc_e_reader",
              "i2of5_reader",
              "2of5_reader",
              "code_93_reader",
            ],
          },
        }, (err) => {
          if (err) {
            console.error("QuaggaJS initialization error:", err);
            showError(`Gagal menginisialisasi kamera: ${err.message || "Pastikan browser Anda mengizinkan akses kamera."}`);
            setIsInitializing(false);
            onClose(); // Close scanner on error
            return;
          }
          console.log("QuaggaJS initialization finished. Starting...");
          Quagga.start();
          setIsInitializing(false);
          setIsScanning(true);
        });
      } catch (error: any) {
        console.error("QuaggaJS init promise error:", error);
        showError(`Gagal menginisialisasi kamera: ${error.message || "Terjadi kesalahan tak terduga."}`);
        setIsInitializing(false);
        onClose(); // Close scanner on error
      }
    };

    initializeQuagga();

    Quagga.onDetected((result) => {
      if (result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;
        console.log("Barcode detected:", code);
        Quagga.stop(); // Stop scanning after detection
        onScan(code);
        onClose(); // Close the camera view
      }
    });

    // Optional: for debugging processing frames
    // Quagga.onProcessed((result) => {
    //   const drawingCtx = Quagga.canvas.ctx.overlay;
    //   const drawingCanvas = Quagga.canvas.dom.overlay;

    //   if (result) {
    //     if (result.boxes) {
    //       drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")!), parseInt(drawingCanvas.getAttribute("height")!));
    //       result.boxes.filter(function (box) {
    //         return box !== result.box;
    //       }).forEach(function (box) {
    //         Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
    //       });
    //     }

    //     if (result.box) {
    //       Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "#00F", lineWidth: 2 });
    //     }

    //     if (result.codeResult && result.codeResult.code) {
    //       Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
    //     }
    //   }
    // });

    return () => {
      if (isScanning) { // Only stop if it was actually scanning
        Quagga.stop();
        console.log("QuaggaJS stopped.");
      }
    };
  }, [onScan, onClose, isScanning]);

  return (
    <div className="relative w-full h-auto aspect-video bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
      {isInitializing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75 text-white z-10">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Memulai kamera...</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <XCircle className="h-4 w-4 mr-2" /> Tutup
          </Button>
        </div>
      )}
      <div id="interactive" className="w-full h-full" ref={videoRef}></div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 text-white hover:bg-white/20 z-20"
        onClick={onClose}
        disabled={isInitializing}
      >
        <XCircle className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default BarcodeScannerQuagga;