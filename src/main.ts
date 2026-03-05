import "./style.css";
import setupColorScheme from "./scheme.ts";
import setFavicon from "./favicon.ts";
import {
  branches,
  getMergeCommit,
  getPR,
  hasToken,
  isContain,
  setToken,
  type PR,
} from "./utils.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1 id="title" >Nixpkgs-Tracker</h1>
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

async function redirectToPRPage() {
  const match = inputElement.value.match(/\/pull\/(\d+)/);
  const pr = match ? match[1] : inputElement.value;

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
  document.title = title;
}

async function handlePR(pr: string) {
  enableButton(false);

  const prNumber = parseInt(pr, 10);
  if (prNumber < 20000) {
    setPRtitle("Pull Request before 20000 are not supported");
    titleElement.style.color = "red";
    setFavicon("red");
    enableButton(true);
    return;
  }

  const prHeader = await getPR(pr);

  if (prHeader.closed) {
    titleElement.innerText = "PR is closed";
    titleElement.style.color = "red";
    setFavicon("red");
    enableButton(true);
    return;
  }

  if (prHeader.status === 404) {
    titleElement.innerText = "PR not found";
    titleElement.href = "#";
    titleElement.style.color = "red";
    setFavicon("red");
    enableButton(true);
    return;
  }

  if (prHeader.status === 403) {
    titleElement.innerText = "Rate limit exceeded -- Please set token";
    titleElement.style.color = "red";
    setFavicon("red");
    enableButton(true);
    return;
  }

  if (prHeader.status === 401) {
    titleElement.innerText = "Unauthorized -- Please set correct token";
    titleElement.style.color = "red";
    setFavicon("red");

    setToken("");
    saveTokenButton.textContent = "Set Token";
    tokenElement.focus();

    return;
  }

  titleElement.href = "https://github.com/nixos/nixpkgs/pull/" + pr;
  setPRtitle(prHeader.title);

  const mergeCommit = await getMergeCommit(pr);

  let mergedCount = 0;
  let totalCount = 0;

  async function checkBranch(branch: string) {
    const merged = await isContain(branch, mergeCommit);
    const branchElement = document.querySelector<HTMLHeadingElement>(
      `#${branch}`,
    )!;
    totalCount++;
    if (merged) {
      mergedCount++;
      branchElement.textContent = `${branch} ✅`;
      branchElement.style.color = "green";
    } else {
      branchElement.textContent = `${branch} ❌`;
      branchElement.classList.add("unmerged");
      branchElement.style.color = "gray";
    }
  }

  async function checkBaseBranch(header: PR) {
    const baseBranch = header.base;
    const merged = header.merged;
    const branchElement = document.querySelector<HTMLHeadingElement>(
      `#base-branch`,
    )!;
    totalCount++;
    if (merged) {
      mergedCount++;
      branchElement.textContent = `${baseBranch} ✅`;
      branchElement.style.color = "green";
    } else {
      branchElement.textContent = `${baseBranch} ❌`;
      branchElement.classList.add("unmerged");
      branchElement.style.color = "gray";
    }
  }

  if (prHeader.base && prHeader.base && prHeader.base.startsWith("release-")) {
    const releaseBranch = prHeader.base;
    const branchContainer = document.querySelector<HTMLDivElement>("#branch")!;

    branchContainer.innerHTML = "";

    const releaseBranchElement = document.createElement("h2");
    releaseBranchElement.id = "base-branch";
    releaseBranchElement.textContent = releaseBranch;
    branchContainer.appendChild(releaseBranchElement);

    await checkBaseBranch(prHeader);
  } else {
    await Promise.all(branches.map(checkBranch));
  }

  // All merged
  if (mergedCount === totalCount) {
    setFavicon("green");
  } else if (mergedCount > 0) { // Partially merged
    setFavicon("orange");
  } else { // None merged
    setFavicon("red");
  }
  
  enableButton(true);
}

if (hasToken()) {
  tokenElement.value = "Token is set";
  document.querySelector<HTMLButtonElement>("#save-token")!.textContent =
    "Change Token";
}
