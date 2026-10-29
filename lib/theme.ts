/** Choix de thème mémorisé par le bouton lune/soleil ; absent = réglage de l'appareil. */
export const THEME_STORAGE_KEY = "rempart-theme";

/**
 * Exécuté dans le <head> avant l'affichage : applique le thème choisi sans flash blanc.
 * Sans choix mémorisé, le CSS suit prefers-color-scheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
