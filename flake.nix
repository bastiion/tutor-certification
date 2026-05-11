{
  description = "Teilnahmebescheinigungen — dev shell with Cypress (stable nixpkgs)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    # act from stable nixpkgs (e.g. 0.2.77) rejects actions that declare `runs.using: node24`;
    # pull a newer act from unstable so `bun run ci:act` matches current GitHub Actions.
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self, nixpkgs, nixpkgs-unstable, flake-utils }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
        pkgsUnstable = import nixpkgs-unstable {
          inherit system;
          config.allowUnfree = true;
        };
        buildInputs = with pkgs; [
          pkgsUnstable.act
          actionlint
          bun
          docker-compose
          php84
          php84Packages.composer
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = buildInputs ++ [ pkgs.cypress ];
          shellHook = ''
            export CXXFLAGS="--std=c++17"
          '';
          CYPRESS_RUN_BINARY = "${pkgs.cypress}/bin/Cypress";
        };
      }
    );
}
