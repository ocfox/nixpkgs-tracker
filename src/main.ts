import "./style.css";
import setupColorScheme from "./scheme.ts";
import { getPRstatus, getPRTitle, hasToken, setToken } from "./utils.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1 id="title" >Nixpkgs-Tracker</h1>
    <p>Check if a PR is merged to the following branches</p>
    <p>If you just check it a couple times an hour, it will work fine without the token.</p>
    <div class="token">
      <input type="text" name="token" id="token" class="input" placeholder="Set Token for gh limit">
      <button id="save-token" type="button">Set Token</button>
    </div>
    <div class="card">
      <input type="text" id="pr" name="text" class="input" placeholder="Pull Request Number"> 
      <button id="check" type="button">Check</button>
    </div>
    <a id="pr-link" href="" target="_blank"></a>
    <div id="branch" class="card">
      <h2 id="staging-next">staging-next</h2>
      <h2 id="master">master</h2>
      <h2 id="nixos-unstable-small">nixos-unstable-small</h2>
      <h2 id="nixpkgs-unstable">nixpkgs-unstable</h2>
      <h2 id="nixos-unstable">nixos-unstable</h2>
    </div>
  </div>
`;

setupColorScheme(document.querySelector<HTMLButtonElement>("#title")!);

const titleElement = document.querySelector<HTMLAnchorElement>("#pr-link")!;
const inputElement = document.querySelector<HTMLInputElement>("#pr")!;
const tokenElement = document.querySelector<HTMLInputElement>("#token")!;
const checkButton = document.querySelector<HTMLButtonElement>("#check")!;
const saveTokenButton =
  document.querySelector<HTMLButtonElement>("#save-token")!;

tokenElement.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    setToken(tokenElement.value);
  }
});

saveTokenButton.addEventListener("click", () => {
  setToken(tokenElement.value);
  tokenElement.value = "Token is set";
  saveTokenButton.textContent = "Change Token";
});

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

  if (title.status === 404) {
    titleElement.innerText = "PR not found";
    titleElement.href = "#";
    titleElement.style.color = "red";
    enableButton(true);
    return;
  }

  if (title.status === 403) {
    titleElement.innerText = "Rate limit exceeded -- Please set token";
    titleElement.style.color = "red";
    enableButton(true);
    return;
  }

  if (title.status === 401) {
    titleElement.innerText = "Unauthorized -- Please set correct token";
    titleElement.style.color = "red";

    setToken("");
    saveTokenButton.textContent = "Set Token";
    tokenElement.focus();

    return;
  }

  document.querySelector<HTMLAnchorElement>("#pr-link")!.href =
    "https://github.com/nixos/nixpkgs/pull/" + pr;

  document.querySelector<HTMLAnchorElement>("#pr-link")!.innerText =
    title.title;

  const datas = await getPRstatus(pr);
  if (!datas) {
    return;
  }
  for (const data of datas) {
    const branch = document.querySelector<HTMLHeadingElement>(
      `#${data.branch}`
    )!;
    if (data.contain) {
      branch.textContent = `${data.branch} ✅`;
      branch.style.color = "green";
    } else {
      branch.textContent = `${data.branch} ❌`;
      branch.classList.add("unmerged");
      branch.style.color = "gray";
    }
  }
  enableButton(true);
}

if (hasToken()) {
  tokenElement.value = "Token is set";
  document.querySelector<HTMLButtonElement>("#save-token")!.textContent =
    "Change Token";
}
