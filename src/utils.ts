import Cookies from "js-cookie";

const branches = [
  "staging-next",
  "master",
  "nixpkgs-unstable",
  "nixos-unstable-small",
  "nixos-unstable",
];

export function setToken(token: string) {
  Cookies.set("token", token, { expires: 365, sameSite: "strict" });
}

function getToken() {
  return Cookies.get("token");
}

export function hasToken(): boolean {
  return !!getToken();
}

function header() {
  const token = getToken();
  if (token) {
    return {
      Authorization: `token ${token}`,
    };
  }
}

const headers = header();

type PRtitle = {
  title: string;
  status: number;
};

export async function getPRTitle(pr: string): Promise<PRtitle> {
  const response = await fetch(
    `https://api.github.com/repos/nixos/nixpkgs/pulls/${pr}`,
    { headers }
  );

  const data = await response.json();

  return {
    title: data.title,
    status: response.status,
  };
}

export async function getPRstatus(pr: string) {
  const url = `https://api.github.com/repos/nixos/nixpkgs/pulls/${pr}`;

  const response = await fetch(url, { headers });
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
  const response = await fetch(url, { headers });
  if (response.status === 404) {
    return false;
  }
  const data = await response.json();
  if (data.status === "identical" || data.status === "behind") {
    return true;
  }
  return false;
}
