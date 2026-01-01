import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const DEVICES = [
  {
    id: 'steam_deck',
    name: 'Steam Deck',
    icon: '🎮',
    description: 'Valve\'s handheld gaming PC'
  },
  {
    id: 'rog_ally',
    name: 'ROG Ally',
    icon: '🎯',
    description: 'ASUS handheld with Windows'
  },
  {
    id: 'legion_go',
    name: 'Legion Go',
    icon: '⚡',
    description: 'Lenovo\'s detachable handheld'
  },
  {
    id: 'all',
    name: 'Show All Devices',
    icon: '🌐',
    description: 'Browse deals for all handhelds'
  }
];

export default function DeviceOnboarding() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if onboarding already completed
    const completed = document.cookie
      .split('; ')
      .find(row => row.startsWith('onboarding_completed='));

    if (!completed) {
      // Show modal after short delay
      setTimeout(() => setIsOpen(true), 800);
    }
  }, []);

  const handleDeviceSelect = (deviceId: string) => {
    // Set device cookie (1 year expiry)
    document.cookie = `handheld_device=${deviceId}; path=/; max-age=31536000`;

    // Set onboarding completed cookie (1 year expiry)
    document.cookie = `onboarding_completed=true; path=/; max-age=31536000`;

    // Track analytics
    if (typeof window !== 'undefined' && (window as any).umami) {
      (window as any).umami.track('onboarding_device_selected', {
        device: deviceId
      });
    }

    // Reload page to apply device context
    window.location.reload();
  };

  const handleSkip = () => {
    // Set default to 'all'
    document.cookie = `handheld_device=all; path=/; max-age=31536000`;
    document.cookie = `onboarding_completed=true; path=/; max-age=31536000`;

    if (typeof window !== 'undefined' && (window as any).umami) {
      (window as any).umami.track('onboarding_skipped');
    }

    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.3s ease-out' }}
    >
      <div
        className="relative w-full max-w-2xl bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden"
        style={{ animation: 'slideUp 0.4s ease-out' }}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-800">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Welcome to Handheld Deals! 👋
              </h2>
              <p className="text-zinc-400">
                Select your device to see personalized game deals and performance ratings
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Device Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DEVICES.map((device) => (
              <button
                key={device.id}
                onClick={() => handleDeviceSelect(device.id)}
                className="group relative flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500 rounded-xl transition-all text-left hover:scale-[1.02]"
              >
                <div className="text-4xl">{device.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                    {device.name}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-0.5">
                    {device.description}
                  </p>
                </div>
                <div className="text-zinc-600 group-hover:text-blue-400 transition-colors">
                  →
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              You can change this anytime using the device switcher
            </p>
            <button
              onClick={handleSkip}
              className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-zinc-800"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>

      {/* Inline CSS for animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `
      }} />
    </div>
  );
}