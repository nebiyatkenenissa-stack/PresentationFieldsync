// Accuracy thresholds (meters).
const GOOD_ACCURACY_M = 30;   // strong satellite fix — finish right away
const IO_ACCURACY_M = 150;    // still trustworthy enough for a field location
const POOR_ACCURACY_M = 2000; // above this, the fix is almost certainly a
                              // network/IP estimate, not a real GPS position

export const getCurrentGps = (timeoutMs = 10000) => {
    return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            resolve({ success: false, error: 'GPS is not available in this browser/context. Use HTTPS or localhost.' });
            return;
        }

        let settled = false;
        let watchId = null;
        let timer = null;
        const samples = [];

        const stopWatching = () => {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
        };

        const done = (result) => {
            if (!settled) {
                settled = true;
                stopWatching();
                if (timer) clearTimeout(timer);
                resolve(result);
            }
        };

        const finish = () => {
            if (samples.length === 0) {
                done({ success: false, error: 'GPS timed out. Please try again.' });
                return;
            }
            // Pick the most accurate sample (smallest accuracy value in meters).
            samples.sort((a, b) => a.accuracy - b.accuracy);
            const best = samples[0];
            const lowAccuracy = best.accuracy > IO_ACCURACY_M;
            const networkEstimate = best.accuracy > POOR_ACCURACY_M;
            done({
                success: true,
                latitude: best.latitude,
                longitude: best.longitude,
                accuracy: Math.round(best.accuracy),
                lowAccuracy,
                networkEstimate,
                samples: samples.length,
                timestamp: new Date().toISOString()
            });
        };

        // Watch the position and collect several fixes. Browsers often return a
        // coarse first fix and refine it a moment later, so we keep sampling
        // until we have a genuinely good fix or we hit the deadline. We only
        // settle early once a sample is inside GOOD_ACCURACY_M, and we never
        // call `done` on the very first (often stale/coarse) preliminary fix.
        // maximumAge: 0 forces a fresh fix instead of reusing a cached location.
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const accuracy = position.coords.accuracy != null ? position.coords.accuracy : Infinity;
                samples.push({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy
                });
                const bestAccuracy = samples.reduce((m, s) => Math.min(m, s.accuracy), Infinity);
                // A strong fix is final; otherwise keep refining until we have
                // a few samples so a single glitch does not win.
                if (bestAccuracy <= GOOD_ACCURACY_M && samples.length >= 2) {
                    finish();
                } else if (samples.length >= 4) {
                    finish();
                }
            },
            (error) => {
                const messages = {
                    1: 'GPS permission denied. Please allow location access.',
                    2: 'GPS position unavailable. Move to a more open area and retry.',
                    3: 'GPS timed out. Please retry.'
                };
                done({ success: false, error: messages[error.code] || ('GPS error: ' + error.message) });
            },
            { enableHighAccuracy: true, timeout: Math.min(timeoutMs, 15000), maximumAge: 0 }
        );

        timer = setTimeout(() => {
            finish();
        }, timeoutMs + 2000);
    });
};
