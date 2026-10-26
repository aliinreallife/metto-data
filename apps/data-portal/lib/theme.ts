/** Applied in the document head before CSS/content can paint. No user input. */
export const THEME_STORAGE_KEY = "metto:theme";
export const THEME_INIT_SCRIPT = `(function(){var preference;try{preference=localStorage.getItem("metto:theme")}catch(e){}var dark=preference==="dark"||(preference!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark)})();`;
