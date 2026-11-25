// Stacking order for things drawn over the map.
//
// The map sits in its own stacking context at z-index 0, so MapLibre's
// internal layers never compete with the app. The floating panels use 1000
// to 1200, so anything that must stay readable on top of them goes above.
export const OVERLAY_MAX_Z = 1200;

// Toasts report route results and errors, so they always sit above the map
// and its panels.
export const TOAST_Z = 2000;
