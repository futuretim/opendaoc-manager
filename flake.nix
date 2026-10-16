{
  description = "OpenDAoC Manager — admin/GM web console (Vite SPA + Fastify API)";

  # Single input, pinned to the stable NixOS 24.11 release branch. Run
  # `nix flake lock` (or the first `nix develop`) to pin an exact revision in
  # flake.lock for byte-for-byte reproducibility across machines.
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
    in
    {
      # `nix develop` — reproducible dev environment on any machine.
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          name = "opendaoc-manager";

          packages = [
            pkgs.nodejs_22 # Node.js 22 + npm
            pkgs.openssl # `openssl rand -hex 32` for SESSION_SECRET
            pkgs.mariadb # mariadb client + local server for dev
            pkgs.git
            pkgs.jq
          ];

          shellHook = ''
            echo "OpenDAoC Manager dev shell"
            echo "  node $(node --version)  npm $(npm --version)"
            echo
            echo "  npm install        install all workspaces"
            echo "  npm run migrate    apply Manager DB schema"
            echo "  npm run dev:api    API  -> http://localhost:4000"
            echo "  npm run dev:web    SPA  -> http://localhost:5173"
            echo
            if [ ! -f .env ]; then
              echo "  (no .env yet: cp .env.example .env, then set SESSION_SECRET + DB creds)"
            fi
          '';
        };
      });

      # `nix fmt` formats the Nix files.
      formatter = forAllSystems (pkgs: pkgs.nixpkgs-fmt);
    };
}
