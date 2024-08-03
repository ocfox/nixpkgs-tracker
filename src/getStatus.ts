const branches = [
  "staging-next",
  "master",
  "nixpkgs-unstable",
  "nixos-unstable-small",
  "nixos-unstable",
];

export async function getPRTitle(pr: string) {
  return fetch(`https://api.github.com/repos/nixos/nixpkgs/pulls/${pr}`)
    .then((response) => response.json())
    .then((data) => data.title);
}

export async function getPRstatus(pr: string) {
  const url = `https://api.github.com/repos/nixos/nixpkgs/pulls/${pr}`;

  const response = await fetch(url);
  if (response.status === 404) {
    return;
  }
  const data = await response.json();
  if (!data.merged) {
    return;
  }

  const inBranches = branches.map(async (branch) => {
    return {
      branch,
      contain: await isContain(branch, data.merge_commit_sha),
    };
  });

  const statuses = await Promise.all(inBranches);
  return statuses;
}

async function isContain(branch: string, commit: string) {
  const url = `https://api.github.com/repos/nixos/nixpkgs/compare/${branch}...${commit}`;
  const response = await fetch(url);
  if (response.status === 404) {
    return false;
  }
  const data = await response.json();
  if (data.status === "identical" || data.status === "behind") {
    return true;
  }
  return false;
}
