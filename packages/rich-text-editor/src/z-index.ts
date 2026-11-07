/**
 * Stacking layers for editor overlays. Must stay in sync with styles/editor.css.
 * Fullscreen sits above Bootstrap component modals (1055). Editor dialogs and
 * popups sit above the fullscreen editor.
 */
export const RTE_Z_FULLSCREEN = 10040;
export const RTE_Z_CONTEXT_TOOLBAR = 10050;
export const RTE_Z_MODAL = 10060;
export const RTE_Z_NOTIFICATION = 10065;
export const RTE_Z_POPUP = 10070;
