let googleMapsPromise = null;

const CALLBACK_NAME = '__sahyatriGoogleMapsReady';

// With loading=async, google.maps.* classes (Map, ControlPosition, Marker...)
// only exist after importLibrary() for their library resolves, so every
// library the app touches is imported before this loader resolves.
const LIBRARIES = ['core', 'maps', 'marker', 'places', 'geocoding', 'routes', 'streetView', 'geometry', 'visualization'];

/**
 * Loads the Google Maps JavaScript API once and resolves with the fully
 * populated `google.maps` namespace.
 */
export function loadGoogleMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window environment is not available'));
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.VITE_GOOGLE_GEOCODE_API_KEY ||
    '';

  const importAll = () =>
    Promise.all(LIBRARIES.map((name) => window.google.maps.importLibrary(name))).then(() => window.google.maps);

  googleMapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) {
      importAll().then(resolve, reject);
      return;
    }

    window[CALLBACK_NAME] = () => {
      delete window[CALLBACK_NAME];
      importAll().then(resolve, reject);
    };

    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&v=weekly&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.onerror = () => {
      googleMapsPromise = null;
      script.remove();
      reject(new Error('Failed to load Google Maps JavaScript SDK script.'));
    };

    document.head.appendChild(script);
  }).catch((err) => {
    googleMapsPromise = null;
    throw err;
  });

  return googleMapsPromise;
}
