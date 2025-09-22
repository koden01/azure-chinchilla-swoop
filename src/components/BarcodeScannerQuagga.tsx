import React, { useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2, CameraOff } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

interface BarcodeScannerQuaggaProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const BarcodeScannerQuagga: React.FC<BarcodeScannerQuaggaProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const initializeQuagga = async () => {
      setIsInitializing(true);
      setIsScanning(false);
      setCameraError(null);

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
              facingMode: "environment",
            },
          },
          locator: {
            patchSize: "medium",
            halfSample: true,
            debug: {
              showCanvas: false,
              showPatches: false,
              showFoundPatches: false,
              showSkeleton: false,
              showLabels: false,
              showTestMarkers: false,
              showQuagga: false,
            },
          },
          numOfWorkers: navigator.hardwareConcurrency || 0,
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
            let errorMessage = "Gagal mengakses kamera";
            
            if (err.name === 'NotReadableError') {
              errorMessage = "Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain yang menggunakan kamera dan coba lagi.";
            } else if (err.name === 'PermissionDeniedError') {
              errorMessage = "Izin akses kamera ditolak. Silakan berikan izin akses kamera di pengaturan browser Anda.";
            } else if (err.name === 'NotFoundError') {
              errorMessage = "Tidak ada kamera yang ditemukan. Pastikan perangkat Anda memiliki kamera yang berfungsi.";
            }
            
            setCameraError(errorMessage);
            showError(errorMessage);
            setIsInitializing(false);
            return;
          }
          console.log("QuaggaJS initialization finished. Starting...");
          Quagga.start();
          setIsInitializing(false);
          setIsScanning(true);
          showSuccess("Kamera siap digunakan");
        });
      } catch (error: any) {
        console.error("QuaggaJS init promise error:", error);
        const errorMessage = error.message || "Terjadi kesalahan tak terduga saat mengakses kamera";
        setCameraError(errorMessage);
        showError(errorMessage);
        setIsInitializing(false);
      }
    };

    initializeQuagga();

    Quagga.onDetected((result) => {
      if (result.codeResult && result.codeResult.code) {
        const code = result.codeResult.code;
        console.log("Barcode detected:", code);
        onScan(code);
      }
    });

    return () => {
      if (isScanning) {
        Quagga.stop();
        console.log("QuaggaJS stopped.");
      }
    };
  }, [onScan, onClose, isScanning]);

  const handleCloseClick = () => {
    if (isScanning) {
      Quagga.stop();
    }
    onClose();
  };

  const handleRetryCamera = () => {
    if (isScanning) {
      Quagga.stop();
    }
    setCameraError(null);
    setIsInitializing(true);
    
    // Reinitialize after a short delay
    setTimeout(() => {
      if (videoRef.current) {
        const initializeQuagga = async () => {
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
                  facingMode: "environment",
                },
              },
              // ... rest of config
            }, (err) => {
              if (err) {
                setCameraError("Gagal mengakses kamera setelah percobaan ulang");
                setIsInitializing(false);
                return;
              }
              Quagga.start();
              setIsInitializing(false);
              setIsScanning(true);
              setCameraError(null);
            });
          } catch (error) {
            setCameraError("Gagal mengakses kamera");
            setIsInitializing(false);
          }
        };
        initializeQuagga();
      }
    }, 500);
  };

  return (
    <div className="relative w-full h-auto aspect-video bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center">
      {isInitializing && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75 text-white z-10">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Memulai kamera...</p>
        </div>
      )}
      
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white z-10 p-4">
          <CameraOff className="h-12 w-12 mb-4 text-red-400" />
          <p className="text-center mb-4">{cameraError}</p>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleRetryCamera}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Coba Lagi
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseClick}
              className="text-white border-white hover:bg-white/20"
            >
              Tutup
            </Button>
          </div>
        </div>
      )}
      
      <div id="interactive" className="w-full h-full" ref={videoRef}></div>
      
      {!cameraError && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 text-white hover:bg-white/20 z-20"
          onClick={handleCloseClick}
          disabled={isInitializing}
        >
          <XCircle className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default BarcodeScannerQuagga;