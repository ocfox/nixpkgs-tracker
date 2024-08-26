{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    treefmt-nix.url = "github:numtide/treefmt-nix";
    treefmt-nix.inputs.nixpkgs.follows = "nixpkgs";

    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.nixpkgs-stable.follows = "";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      treefmt-nix,
      git-hooks,
      ...
    }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      treefmtCfg = (treefmt-nix.lib.evalModule pkgs ./treefmt.nix).config.build;
    in
    rec {
      formatter.${system} = treefmtCfg.wrapper;
      checks.${system} = {
        formatting = treefmtCfg.check self;
        git-hooks-check = git-hooks.lib.${system}.run {
          src = ./.;
          hooks = {
            deadnix = {
              enable = true;
              stages = [ "pre-push" ];
            };
            statix = {
              enable = true;
              stages = [ "pre-push" ];
            };
            nixfmt = {
              package = pkgs.nixfmt-rfc-style;
              enable = true;
              stages = [
                "pre-push"
                "pre-commit"
              ];
            };
          };
        };
      };
      devShells.${system}.default = pkgs.mkShellNoCC {
        inherit (self.checks.${system}.git-hooks-check) shellHook;
        buildInputs = self.checks.${system}.git-hooks-check.enabledPackages;
        packages =
          [ pkgs.yarn ]
          ++ [
            treefmtCfg.wrapper
            (pkgs.lib.attrValues treefmtCfg.programs)
          ];
      };
    };
}
