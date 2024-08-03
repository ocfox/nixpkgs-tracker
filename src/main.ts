import "./style.css";
import setupColorScheme from "./scheme.ts";
import { getPRstatus, getPRTitle } from "./getStatus.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1 id="title" >Nixpkgs-Tracker</h1>
    <div class="card">
      <input type="text" name="text" class="input" placeholder="Pull Request"> 
      <button id="check" type="button">Check</button>
    </div>
    <a id="pr-link" href="" target="_blank"></a>
    <div class="card">
      <h2 id="staging-next">staging-next</h2>
      <h2 id="master">master</h2>
      <h2 id="nixos-unstable-small">nixos-unstable-small</h2>
      <h2 id="nixpkgs-unstable">nixpkgs-unstable</h2>
      <h2 id="nixos-unstable">nixos-unstable</h2>
    </div>
  </div>
`;

setupColorScheme(document.querySelector<HTMLButtonElement>("#title")!);

document
  .querySelector<HTMLInputElement>(".input")!
  .addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      document.querySelector<HTMLButtonElement>("#check")!.click();
    }
  });

document
  .querySelector<HTMLButtonElement>("#check")!
  .addEventListener("click", async () => {
    const pr = document.querySelector<HTMLInputElement>(".input")!.value;
    const title = await getPRTitle(pr);
    if (!title) {
      return;
    }

    document.querySelector<HTMLAnchorElement>("#pr-link")!.href =
      "https://github.com/nixos/nixpkgs/pull/" + pr;

    document.querySelector<HTMLAnchorElement>("#pr-link")!.innerText = title;

    const datas = await getPRstatus(pr);
    if (!datas) {
      return;
    }
    for (const data of datas) {
      const el = document.querySelector<HTMLHeadingElement>(`#${data.branch}`);
      if (data.contain) {
        el!.style.color = "green";
      } else {
        el!.style.color = "red";
      }
    }
  });
