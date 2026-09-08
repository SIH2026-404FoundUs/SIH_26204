let googleMapsPromise = null;

/**
 * Asynchronously loads the Google Maps JavaScript API SDK once.
 * Prevents duplicate script tag injections and returns a Promise that resolves
 * with the `google.maps` instance.
 *
 * Automatically includes `visualization` (for Heatmaps) and `places` libraries.
 */
export function loadGoogleMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window environment is not available'));
  }

  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.VITE_GOOGLE_GEOCODE_API_KEY ||
    '';

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-maps-js-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google && window.google.maps) {
          resolve(window.google.maps);
        } else {
          reject(new Error('Google Maps SDK script attached but window.google.maps is missing'));
        }
      });
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization,places&v=3.58`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps SDK script loaded but window.google.maps is undefined'));
      }
    };

    script.onerror = (error) => {
      googleMapsPromise = null;
      reject(new Error('Failed to load Google Maps JavaScript SDK script.'));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
