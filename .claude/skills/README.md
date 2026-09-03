# UI/UX Pro Max Skills

Vendored from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
(MIT, see `LICENSE`).

- **Upstream version:** 2.13.0
- **Commit:** `f3ac195224eac1eb0dfe1a3059c2a6add78ffbe3`

## Skills

| Skill | Purpose |
| --- | --- |
| `ui-ux-pro-max` | Core design intelligence — searchable data on styles, palettes, font pairings, UX guidelines, charts, and 22 stacks |
| `ui-styling` | shadcn/ui + Tailwind components, theming, dark mode, canvas visuals |
| `design` | Umbrella design skill — logos, brand identity, banners, icons, social images |
| `design-system` | Three-layer design tokens (primitive → semantic → component), component specs |
| `brand` | Brand voice, visual identity, messaging frameworks, asset management |
| `banner-design` | Banners for social, ads, web heroes, and print |
| `slides` | HTML presentations with Chart.js and design tokens |

## Usage

Claude Code discovers these automatically from `.claude/skills/`. They activate on
relevant design work, or you can invoke one by name.

The bundled scripts are self-contained — they use only Node builtins and the Python
standard library, so there is nothing to install. Script paths inside each `SKILL.md`
are relative to that skill's own directory; run them with the working directory at the
project root:

```bash
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "restaurant menu"
```

## Updating

Re-copy `.claude/skills/` from the upstream repo, then delete any `__pycache__/`,
`*.pyc`, and `.coverage` files it carries (upstream ships a stray coverage database).
