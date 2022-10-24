# :robot: denopendabot

<!-- deno-fmt-ignore-start -->

![CI](https://github.com/hasundue/denopendabot/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/hasundue/denopendabot/branch/main/graph/badge.svg)](https://codecov.io/gh/hasundue/denopendabot)
![denoland/deno](https://img.shields.io/badge/Deno-v1.26.1-informational?logo=deno) <!-- @denopendabot denoland/deno -->

<!-- deno-fmt-ignore-end -->

`denopendabot` keeps your Deno projects up-to-date.

> **Warning**\
> Still under development. Many bugs might remain. Any breaking changes may be
> introduced on each Feature release.

## :magic_wand: Features

### Update Deno modules

<!-- denopendabot-ignore-start -->

```typescript
import { assert } from "https://deno.land/std@0.158.0/testing/asserts.ts";
```

```sh
💡 deno.land/std 0.158.0 => 0.159.0
```

Denopendabot takes advantage of the core engine of
[udd](https://github.com/hayd/deno-udd), one of the most widely used module
update libraries for Deno, which supports
[many registry domains](https://github.com/hayd/deno-udd#supported-domains).

### Update GitHub repositories

```yaml
- uses: denoland/setup-deno@v1
  with:
    deno-version: v1.26.0 # @denopendabot denoland/deno
```

```sh
💡 denoland/deno v1.26.0 => v1.26.1
```

<!-- denopendabot-ignore-end -->

Denopendabot update any SemVer related to a GitHub repository, specified by a
comment of `@denopendabot {owner}/{repo}`.

### Commits and pull requests

- Commits are created for each updated module/repository individually
- Each run of Denopendabot creates only one pull request

See
[an example pull request](https://github.com/hasundue/denomantic-release/pull/4/commits).

## :bulb: Usage

### GitHub App (experimental)

[Install the App](https://github.com/apps/denopendabot) and create a workflow
file to dispatch `denopendabot-run` events:

```yaml
name: Denopendabot
on:
  workflow_dispatch:
  schedule:
    - cron: "0 0 * * *" # modify to your convenient time
jobs:
  update:
    steps:
      - name: Run
        uses: peter-evans/repository-dispatch@v2
        with:
          event-type: denopendabot-run
          client-payload: '{ "base": "main", "branch": "denopendabot" }' # optional
```

### GitHub Action

Denopendabot needs a GitHub access token authorized to run workflows.
`secrets.GITHUB_TOKEN` is used by default and it works fine in most cases.

If you want to update workflow files (`./github/workflows/*.yml`), it also needs
a private access token with the `workflow` scope. In the examples below, we
assume the token is added in repository secrets as `GH_TOKEN`.

#### Predefined workflow (recommended)

```yaml
name: Denopendabot
on:
  workflow_dispatch:
  schedule:
    - cron: "0 0 * * *" # modify to your convenient time
jobs:
  update:
    name: Update
    runs-on: ubuntu-latest
    steps:
      - uses: hasundue/denopendabot@0.7.0 # @denopendabot hasundue/denopendabot
        with:
          user-token: ${{ secrets.GH_TOKEN }}
```

See [action.yml](./action.yml) for other options.

#### Manual configuration

```yaml
name: Denopendabot
on:
  workflow_dispatch:
  schedule:
    - cron: "0 0 * * *" # modify to your convenient time
jobs:
  update:
    name: Update
    runs-on: ubuntu-latest
    steps:
      - name: Setup Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v1.26.2 # @denopendabot denoland/deno
      - name: Run Denopendabot
        run: >
          deno run -q --allow-env --allow-net
          https://deno.land/x/denopendabot@0.7.0/main.ts
          ${{ github.repository }}
          --token ${{ secrets.GITHUB_TOKEN }}
          --user-token ${{ secrets.GH_TOKEN }}
```
