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
            done({
                success: true,
                latitude: best.latitude,
                longitude: best.longitude,
                accuracy: Math.round(best.accuracy),
                timestamp: new Date().toISOString()
            });
        };

        // Watch the position and collect several fixes. Browsers often return a
        // coarse first fix and refine it a moment later, so we take up to a few
        // samples and keep the most accurate one. maximumAge: 0 forces a fresh
        // fix instead of reusing a possibly stale cached location.
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const accuracy = position.coords.accuracy != null ? position.coords.accuracy : Infinity;
                samples.push({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy
                });
                // Stop early once we have a good fix.
                if (samples.length >= 3 || accuracy <= 50) {
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
            { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
        );

        timer = setTimeout(() => {
            finish();
        }, timeoutMs + 2000);
    });
};
