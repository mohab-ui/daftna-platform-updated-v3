/**
 * ThemeScript
 * - Runs before first paint (in <head>)
 * - Sets documentElement.dataset.theme = 'light' | 'dark'
 * - Persists choice in localStorage
 * - Prevents flicker
 */

export default function ThemeScript() {
  // Keep it very small + resilient. No external deps.
  const code = `
(function(){
  try {
    var key = 'theme';
    var stored = localStorage.getItem(key);
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored ? stored : (prefersDark ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
  `.trim();

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
