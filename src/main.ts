import "./style.css";
import setupColorScheme from "./scheme.ts";
import { getPRstatus, getPRTitle } from "./utils.ts";

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

const inputElement = document.querySelector<HTMLInputElement>(".input")!;
const checkButton = document.querySelector<HTMLButtonElement>("#check")!;

inputElement.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    redirectToPRPage();
  }
});

checkButton.addEventListener("click", () => {
  redirectToPRPage();
});

async function redirectToPRPage() {
  const pr = inputElement.value;
  if (pr) {
    window.location.href = `?pr=${pr}`;
  }
}

const urlParams = new URLSearchParams(window.location.search);
const pr = urlParams.get("pr");

if (pr) {
  inputElement.value = pr;
  handlePR(pr);
}

function enableButton(set: boolean) {
  checkButton.disabled = !set;
  inputElement.disabled = !set;
}

async function handlePR(pr: string) {
  enableButton(false);
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
  enableButton(true);
}
