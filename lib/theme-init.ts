// Day or night. The choice lives on <html data-theme>, which is what the
// stylesheet reads. It always starts from the device setting.
export const THEME_EVENT = 'florin-theme-change';
// Where an earlier version saved a manual choice. Only read to clear it.
export const LEGACY_THEME_STORAGE_KEY = 'florin-theme';

// Runs in <head> before first paint, so the page never flashes the wrong
// theme. It follows the device setting, including when that changes while the
// page is open, and forgets any choice an earlier version saved.
//
// If React ever has to rebuild the document (a hydration mismatch, or an
// extension editing the page), it strips data-theme from <html>. The observer
// puts the current theme straight back, including a manual switch.
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)'),cur;try{localStorage.removeItem('${LEGACY_THEME_STORAGE_KEY}')}catch(e){}function apply(){cur=m.matches?'dark':'light';d.dataset.theme=cur;window.dispatchEvent(new Event('${THEME_EVENT}'))}apply();m.addEventListener('change',apply);new MutationObserver(function(){var t=d.dataset.theme;if(t){cur=t}else{d.dataset.theme=cur;window.dispatchEvent(new Event('${THEME_EVENT}'))}}).observe(d,{attributes:true,attributeFilter:['data-theme']})})()`;
