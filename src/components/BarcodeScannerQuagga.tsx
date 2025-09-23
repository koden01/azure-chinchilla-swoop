import React, { useEffect, useRef, useState } from 'react';
import Quagga from 'quagga';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { XCircle, Loader2, CameraOff, AlertTriangle, Keyboard } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

interface BarcodeScannerQuaggaProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const BarcodeScannerQuagga: React.FC<BarcodeScannerQuaggaProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const quaggaInitializedRef = useRef(false);

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      setCameraError("Browser environment not detected");
      setIsInitializing(false);
      return;
    }

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access not supported in this browser");
      setIsInitializing(false);
      return;
    }

    // Check if we're on HTTPS (required for camera access)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      setCameraError("Camera access requires HTTPS connection");
      setIsInitializing(false);
      return;
    }

    if (!videoRef.current || quaggaInitializedRef.current) return;

    const initializeQuagga = async () => {
      setIsInitializing(true);
      setIsScanning(false);
      setCameraError(null);
      quaggaInitializedRef.current = true;

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
              showCanvas: true, // Changed to true to show canvas
              showPatches: true, // Show patches for better visualization
              showFoundPatches: true,
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
            
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              errorMessage = "Izin akses kamera ditolak. Silakan berikan izin akses kamera di pengaturan browser Anda.";
            } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
              errorMessage = "Tidak ada kamera yang ditemukan. Pastikan perangkat Anda memiliki kamera yang berfungsi.";
            } else if (err.name === 'NotReadableError') {
              errorMessage = "Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain yang menggunakan kamera dan coba lagi.";
            } else if (err.name === 'AbortError') {
              errorMessage = "Operasi kamera dibatalkan. Silakan coba lagi.";
            } else if (err.message?.includes('getUserMedia')) {
              errorMessage = "Browser tidak mendukung akses kamera. Pastikan Anda menggunakan browser modern seperti Chrome, Firefox, atau Safari.";
            }
            
            setCameraError(errorMessage);
            setIsInitializing(false);
            quaggaInitializedRef.current = false;
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
        setIsInitializing(false);
        quaggaInitializedRef.current = false;
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
      if (quaggaInitializedRef.current) {
        Quagga.stop();
        console.log("QuaggaJS stopped.");
        quaggaInitializedRef.current = false;
      }
    };
  }, [onScan, onClose]);

  const handleCloseClick = () => {
    if (quaggaInitializedRef.current) {
      Quagga.stop();
      quaggaInitializedRef.current = false;
    }
    onClose();
  };

  const handleRetryCamera = () => {
    if (quaggaInitializedRef.current) {
      Quagga.stop();
      quaggaInitializedRef.current = false;
    }
    setCameraError(null);
    setIsInitializing(true);
    setShowManualInput(false);
    
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
              locator: {
                patchSize: "medium",
                halfSample: true,
                debug: {
                  showCanvas: true,
                  showPatches: true,
                  showFoundPatches: true,
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
                setCameraError("Gagal mengakses kamera setelah percobaan ulang");
                setIsInitializing(false);
                quaggaInitializedRef.current = false;
                return;
              }
              Quagga.start();
              setIsInitializing(false);
              setIsScanning(true);
              setCameraError(null);
              quaggaInitializedRef.current = true;
            });
          } catch (error) {
            setCameraError("Gagal mengakses kamera");
            setIsInitializing(false);
            quaggaInitializedRef.current = false;
          }
        };
        initializeQuagga();
      }
    }, 500);
  };

  const handleManualInput = () => {
    if (manualInput.trim()) {
      onScan(manualInput.trim());
      setManualInput('');
      setShowManualInput(false);
    }
  };

  return (
    <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden">
      {isInitializing && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75 text-white z-10 p-4">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Memulai kamera...</p>
        </div>
      )}
      
      {cameraError && !showManualInput && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white z-10 p-4">
          <AlertTriangle className="h-12 w-12 mb-4 text-yellow-400" />
          <p className="text-center mb-4">{cameraError}</p>
          <p className="text-sm text-center mb-6 text-gray-300">
            Kamera tidak dapat diakses karena koneksi HTTP. 
            Gunakan input manual atau coba dengan koneksi HTTPS.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowManualInput(true)}
              className="bg-blue-600 hover:bg-blue-700 mb-2"
            >
              <Keyboard className="mr-2 h-4 w-4" />
              Input Manual
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryCamera}
              className="text-white border-white hover:bg-white/20"
            >
              Coba Lagi Kamera
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

      {showManualInput && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white z-10 p-4">
          <Keyboard className="h-12 w-12 mb-4 text-blue-400" />
          <h3 className="text-lg font-semibold mb-2">Input Manual Resi</h3>
          <div className="w-full max-w-xs mb-4">
            <Input
              ref={manualInputRef}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Masukkan nomor resi"
              className="text-gray-800 h-12 text-center text-lg"
              onKeyPress={(e) => e.key === 'Enter' && handleManualInput()}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleManualInput}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!manualInput.trim()}
            >
              Simpan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualInput(false)}
              className="text-white border-white hover:bg-white/20"
            >
              Kembali
            </Button>
          </div>
        </div>
      )}
      
      <div id="interactive" className="w-full h-64 relative" ref={videoRef}>
        {/* Overlay untuk menunjukkan area scan */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-32 border-4 border-green-500 rounded-lg bg-green-500 bg-opacity-20 flex items-center justify-center">
            <div className="text-white text-sm font-semibold">Arahkan barcode ke sini</div>
          </div>
        </div>
      </div>
      
      {!cameraError && (
        <div className="absolute top-2 right-2 flex gap-2 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setShowManualInput(true)}
            title="Input Manual"
          >
            <Keyboard className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={handleCloseClick}
            disabled={isInitializing}
            title="Tutup Kamera"
          >
            <XCircle className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default BarcodeScannerQuagga;