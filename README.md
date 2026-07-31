### How this works

With the GitHub API:

`get PR merged commit hash → compare target branch HEAD ... commit → get status`

nixpkgs-tracker is not the same as [nixpk.gs/pr-tracker](https://nixpk.gs/pr-tracker.html):
it does not proxy any requests through a server to get PR status.

Therefore, there is no server-side performance bottleneck — all requests go
directly from your browser to the GitHub API.

You can get static files with:

```sh
nix build github:ocfox/nixpkgs-tracker
```

### Features

- [x] Show PR status
- [x] Stable link (e.g. https://nixpkgs-tracker.ocfox.me/?pr=512987)
- [x] Auto-check PR from the URL on load
- [x] GitHub token for a higher request limit (optional, stored in localStorage)
- [x] Check multiple branches at the same time
- [x] Copy result card as an image

<img width="3696" height="1917" alt="nixpkgs-tracker" src="https://github.com/user-attachments/assets/fb0d18d6-5482-4ec4-8f85-0a00831e43f5" />

### Development

```sh
nix develop
pnpm install
pnpm dev
```

```sh
pnpm build
pnpm typecheck
```
