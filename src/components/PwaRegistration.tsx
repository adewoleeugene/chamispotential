'use client';

import { useEffect, useState } from "react";

export function PwaRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        // If a worker is currently waiting to be activated
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
        }

        // Listen for new workers entering the waiting state (a new deployment)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
              }
            });
          }
        });

      } catch (error) {
        console.error("Service worker registration failed", error);
      }
    };

    void register();

    // Once the new worker takes control, automatically reload the page
    // so we get all the fresh assets for the new version.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return (
    <>
      {waitingWorker && (
        <div
          id="pwa-update-banner"
          style={{
            position: 'fixed',
            bottom: '5.5rem', /* Sits right above the install prompt if both are showing */
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: 'linear-gradient(135deg, #0e2535, #13364a)',
            border: '1px solid rgba(138, 173, 190, 0.4)',
            color: '#f6efe5',
            borderRadius: '14px',
            padding: '0.85rem 1.1rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            maxWidth: 'calc(100vw - 2rem)',
            width: 'max-content',
            animation: 'slideUpUpdate 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <style>{`
            @keyframes slideUpUpdate {
              from { opacity: 0; transform: translateX(-50%) translateY(20px); }
              to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.3, color: '#4ade80' }}>
              Update Available
            </span>
            <span style={{ fontSize: '0.75rem', color: '#8aadbe', lineHeight: 1.3 }}>
              A new version of RMS is ready.
            </span>
          </div>

          <button
            onClick={handleUpdate}
            style={{
              padding: '0.45rem 0.85rem',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: '#f6efe5',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Update Now
          </button>
        </div>
      )}
    </>
  );
}
