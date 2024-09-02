import "./style.css";
import setupColorScheme from "./scheme.ts";
import {
  branches,
  deleteHistory,
  getMeregeCommit,
  getPR,
  hasToken,
  isContain,
  saveHistory,
  setToken,
} from "./utils.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1 id="title" >Nixpkgs-Tracker</h1>
    <div class="history" class="card">
      <h3>History</h3>
      <ul class="history-link"></ul>
    </div>
    <p>Check if a PR is merged to the following branches. <a href="https://github.com/ocfox/nixpkgs-tracker" target="_blank">Source</a></p>
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

const historyElement =
  document.querySelector<HTMLUListElement>(".history-link")!;
const history = JSON.parse(localStorage.getItem("history") || "[]");
console.log(history);
history.forEach((h: { pr: number; title: string }) => {
  const li = document.createElement("li");
  li.innerHTML = `<a href="?pr=${h.pr}">${h.title}</a>`;
  historyElement.appendChild(li);
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

function setPRtitle(title: string) {
  titleElement.innerText = title;
}

async function handlePR(pr: string) {
  enableButton(false);

  const prNumber = parseInt(pr, 10);
  if (prNumber < 20000) {
    setPRtitle("Pull Request before 20000 are not supported");
    titleElement.style.color = "red";
    enableButton(true);
    return;
  }

  const title = await getPR(pr);

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

  titleElement.href = "https://github.com/nixos/nixpkgs/pull/" + pr;
  setPRtitle(title.title);

  const mergeCommit = await getMeregeCommit(pr);
  const isPrSaved = history.some((h: { pr: number }) => h.pr === prNumber);
  let status = 1;

  async function checkBranch(branch: string) {
    const merged = await isContain(branch, mergeCommit);
    const branchElement = document.querySelector<HTMLHeadingElement>(
      `#${branch}`,
    )!;
    if (merged) {
      branchElement.textContent = `${branch} ✅`;
      branchElement.style.color = "green";
    } else {
      branchElement.textContent = `${branch} ❌`;
      branchElement.classList.add("unmerged");
      branchElement.style.color = "gray";
      status = 0;
    }
  }

  await Promise.all(branches.map(checkBranch));

  if (status === 1 && isPrSaved) {
    deleteHistory(prNumber);
  }
  if (status === 0 && !isPrSaved) {
    saveHistory({ pr: prNumber, title: title.title, mergeCommit });
  }

  enableButton(true);
}

if (hasToken()) {
  tokenElement.value = "Token is set";
  document.querySelector<HTMLButtonElement>("#save-token")!.textContent =
    "Change Token";
}
