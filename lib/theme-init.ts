// Day or night. The choice lives on <html data-theme>, which is what the
// stylesheet reads. With no saved choice it follows the device setting.
export const THEME_STORAGE_KEY = 'florin-theme';
export const THEME_EVENT = 'florin-theme-change';

// Runs in <head> before first paint, so the page never flashes the wrong
// theme. It also keeps following the device setting until a choice is saved.
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');function saved(){try{var v=localStorage.getItem('${THEME_STORAGE_KEY}');return v==='light'||v==='dark'?v:null}catch(e){return null}}function apply(){d.dataset.theme=saved()||(m.matches?'dark':'light');window.dispatchEvent(new Event('${THEME_EVENT}'))}apply();m.addEventListener('change',apply)})()`;
