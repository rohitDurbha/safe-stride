// Stacking order for things drawn over the Leaflet map.
//
// Leaflet panes sit between 100 and 700 and its zoom and attribution controls
// use 800 to 1000. The map widgets (route form, view toggle) use 1000, so
// anything that must stay readable on top of the map has to go above that.
export const LEAFLET_MAX_Z = 1000;

// Toasts report route results and errors, so they always sit above the map
// and its controls.
export const TOAST_Z = 2000;
