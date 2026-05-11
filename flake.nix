{
  description = "Teilnahmebescheinigungen — dev shell with Cypress (stable nixpkgs)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
        buildInputs = with pkgs; [
          act
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
