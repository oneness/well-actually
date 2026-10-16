{
  description = "Well, Actually — browser extension development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [ nodejs_24 pnpm_10 ];

          # On NixOS the Playwright browsers have to come from nixpkgs rather
          # than from `playwright install`, which drops an unpatched binary in
          # ~/.cache. The version of playwright-driver here and @playwright/test
          # in package.json are kept in step; if the two disagree, Playwright
          # will not find the browser at all.
          env = nixpkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
            PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          };
        };
      });
    };
}
