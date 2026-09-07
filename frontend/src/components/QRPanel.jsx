import React from 'react'
import { QrCode, Loader2, Wifi } from 'lucide-react'

export default function QRPanel({ status, qrData }) {
  if (status.state === 'connecting') {
    return (
      <div className="card flex flex-col items-center gap-4 py-10">
        <Loader2 size={36} className="text-whatsapp-green animate-spin" />
        <div className="text-center">
          <p className="text-white font-semibold">Connecting to WhatsApp...</p>
          <p className="text-gray-400 text-sm mt-1">
            {status.message || 'Please wait, loading your account'}
          </p>
          {status.percent !== undefined && (
            <div className="mt-3 w-48 bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-whatsapp-green h-1.5 rounded-full transition-all"
                style={{ width: `${status.percent}%` }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (status.state === 'disconnected' && !qrData) {
    return (
      <div className="card flex flex-col items-center gap-4 py-10 border-yellow-800/30">
        <Wifi size={36} className="text-yellow-500" />
        <div className="text-center">
          <p className="text-white font-semibold">Waiting for WhatsApp Client</p>
          <p className="text-gray-400 text-sm mt-1">
            Start the backend server and wait for the QR code to appear
          </p>
        </div>
      </div>
    )
  }

  if (status.state === 'qr' && qrData) {
    const downloadQR = () => {
      if (!qrData.qrBase64) return
      const link = document.createElement('a')
      link.href = qrData.qrBase64
      link.download = 'whatsapp-qr-code.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }

    return (
      <div className="card flex flex-col md:flex-row items-center gap-8 py-6">
        {/* QR Image */}
        <div className="shrink-0">
          {qrData.qrBase64 ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-white rounded-2xl shadow-2xl">
                <img
                  src={qrData.qrBase64}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64 md:w-72 md:h-72"
                />
              </div>
              <button
                onClick={downloadQR}
                className="btn-ghost text-xs flex items-center gap-2"
              >
                <QrCode size={14} />
                Download QR Code
              </button>
            </div>
          ) : (
            <div className="w-64 h-64 md:w-72 md:h-72 bg-gray-800 rounded-2xl flex items-center justify-center">
              <QrCode size={48} className="text-gray-600" />
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-3">🔐 Scan to Login</h3>
          <ol className="space-y-3">
            {[
              'Open WhatsApp on your phone',
              'Tap Menu (⋮) or Settings',
              'Tap "Linked Devices"',
              'Tap "Link a Device"',
              'Point your phone camera at this QR code',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <span className="w-6 h-6 bg-whatsapp-green rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl">
            <p className="text-yellow-300 text-xs">
              ⚠️ QR code expires in ~60 seconds. A new one will appear automatically if it expires.
            </p>
          </div>
          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700/30 rounded-xl">
            <p className="text-blue-300 text-xs">
              💡 Tip: If the QR code is too small to scan, click "Download QR Code" and open the image on a larger screen.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
