export default function setupColorScheme(element: HTMLButtonElement) {
  let isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const setScheme = (scheme: boolean) => {
    isDark = scheme;
    document.body.style.backgroundColor = isDark ? "#333" : "#fff";
    document.body.style.color = isDark ? "#fff" : "#333";
  };
  element.addEventListener("click", () => setScheme(!isDark));
  setScheme(isDark);
}
