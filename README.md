# :robot: denopendabot

<!-- deno-fmt-ignore-start -->

![CI](https://github.com/hasundue/denopendabot/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/hasundue/denopendabot/branch/main/graph/badge.svg?token=7BS432RAXB)](https://codecov.io/gh/hasundue/denopendabot)
![denoland/deno](https://img.shields.io/badge/Deno-v1.26.1-informational?logo=deno) <!-- @denopendabot denoland/deno -->

<!-- deno-fmt-ignore-end -->

`denopendabot` keeps your Deno projects up-to-date.

> **Warning**\
> Still under development. Many bugs might remain. Any breaking changes may be
> introduced on each update.

## :rocket: Features

### Update Deno modules automatically

<!-- denopendabot-ignore-start -->

```typescript
import { assert } from "https://deno.land/std@0.159.0/testing/mod.ts";
```

```sh
💡 deno.land/std@0.158.0/testing/mod.ts => 0.159.0
```

Denopendabot takes advantage of the core engine of
[udd](https://github.com/hayd/deno-udd), which is one of the most widely used
module update libraries for Deno and supports
[many registry domains](https://github.com/hayd/deno-udd#supported-domains).

### Update any SemVer

```yaml
- uses: denoland/setup-deno@v1
  with:
    deno-version: v1.26.1 # @denopendabot denoland/deno
```

```sh
💡 denoland/deno@v1.26.0 => v1.26.1
```

Denopendabot update any SemVer in the code specified by a comment of
`@denopendabot {owner}/{repo}`.

### Commits and pull requests

- Commits are created for each updated module/repository individually
- Each run of Denopendabot creates only one pull request

See
[an example pull request](https://github.com/hasundue/denomantic-release/pull/4/commits).

### GitHub App

WIP

## :bulb: Usage

### GitHub Action

You need a private access token with a `workflow` scope to update workflow
definitions (`./github/workflows/*.yml`).

In the examples below, we assume the token is added in repository secrets as
`GH_TOKEN`.

#### Predefined workflow (recommended)

```yaml
name: Denopendabot
on:
  schedule:
    - cron: "1 0 * * *" # modify to your convinient time
jobs:
  update:
    name: Update
    runs-on: ubuntu-latest
    steps:
      - uses: hasundue/denopendabot@0.3.0
        with:
          token: ${{ secrets.GH_TOKEN }}
```

See [action.yml](./action.yml) for other options.

#### Manual configuration

```yaml
name: Denopendabot
on:
  schedule:
    - cron: "1 0 * * *" # modify to your convinient time
jobs:
  update:
    name: Update
    runs-on: ubuntu-latest
    steps:
      - name: Setup Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v1.26.1 # @denopendabot denoland/deno
      - name: Run Denopendabot
        run: >
          deno run -q --allow-env --allow-net
          https://deno.land/x/denopendabot@0.4.3/main.ts
          ${{ github.repository }}
          --token ${{ secrets.GH_TOKEN }}
```

<!-- denopendabot-ignore-end -->

### GitHub App

WIP
