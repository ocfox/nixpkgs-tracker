export default function setFavicon(color: "blue" | "green" | "orange" | "red") {
  const link = document.getElementById("favicon") as HTMLLinkElement;
  link.href = `/favicon-${color}.svg`;
}
