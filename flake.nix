{
  description = "Client-side tracker for nixpkgs PR branch merge status";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs =
    inputs@{
      self,
      nixpkgs,
      flake-parts,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      perSystem =
        {
          pkgs,
          ...
        }:
        {
          devShells.default =
            let
              inherit (pkgs) mkShell nodejs pnpm;
            in
            mkShell {
              packages = [
                nodejs
                pnpm
              ];
            };

          packages = rec {
            nixpkgs-tracker = pkgs.stdenv.mkDerivation rec {
              pname = "nixpkgs-tracker";
              version =
                let
                  lastModifiedDate = self.lastModifiedDate or self.lastModified or "19700101";
                in
                builtins.substring 0 8 lastModifiedDate;

              src = ./.;

              pnpmDeps = pkgs.fetchPnpmDeps {
                inherit pname version src;
                fetcherVersion = 3;
                hash = "sha256-iv1gQ9+g2YmpqvBC2s/jQOAPjL2P0QSg9cmkqF3oJOU=";
              };

              nativeBuildInputs = with pkgs; [
                nodejs
                pnpmConfigHook
                pnpm
              ];

              buildPhase = ''
                runHook preBuild
                pnpm build
                runHook postBuild
              '';

              installPhase = ''
                runHook preInstall

                mkdir -p $out
                cp -r dist $out/

                runHook postInstall
              '';
            };

            default = nixpkgs-tracker;
          };
        };
    };
}
