# wakapi-sync-skill

[![ClawHub](https://img.shields.io/badge/ClawHub-wakapi--sync--skill-blue)](https://clawhub.ai/skills/wakapi-sync-skill)
[![ClawHub version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fclawhub.ai%2Fapi%2Fv1%2Fskills%2Fwakapi-sync-skill&query=%24.skill.tags.latest&label=clawhub&prefix=v&color=blue)](https://clawhub.ai/skills/wakapi-sync-skill)
[![ClawHub downloads](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fclawhub.ai%2Fapi%2Fv1%2Fskills%2Fwakapi-sync-skill&query=%24.skill.stats.downloads&label=clawhub%20downloads&color=blue)](https://clawhub.ai/skills/wakapi-sync-skill)
[![GitHub stars](https://img.shields.io/github/stars/cosformula/wakapi-sync-skill?style=flat&logo=github)](https://github.com/cosformula/wakapi-sync-skill)
[![License](https://img.shields.io/github/license/cosformula/wakapi-sync-skill)](./LICENSE)
[![Publish to ClawHub](https://github.com/cosformula/wakapi-sync-skill/actions/workflows/clawhub-publish.yml/badge.svg)](https://github.com/cosformula/wakapi-sync-skill/actions/workflows/clawhub-publish.yml)

Daily Wakapi (WakaTime-compatible) summary → local CSV files.

## Quick start

```bash
# required
export WAKAPI_URL="https://wakapi.example.com"
export WAKAPI_API_KEY="..."
export WAKAPI_OUT_DIR="$HOME/wakapi"

node scripts/wakapi-daily-summary.mjs
```

Outputs:
- `daily-total.csv`
- `daily-top-projects.csv`
- `daily-top-languages.csv`

See `SKILL.md` for full docs.
