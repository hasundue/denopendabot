<div align="center">

![denopendabot-simple-320](https://user-images.githubusercontent.com/309723/198542926-bc43533c-63cd-4595-b7d3-6c7b4ade9bfb.png)

</div>

# denopendabot

<!-- deno-fmt-ignore-start -->

![CI](https://github.com/hasundue/denopendabot/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/hasundue/denopendabot/branch/main/graph/badge.svg)](https://codecov.io/gh/hasundue/denopendabot)
![denoland/deno](https://img.shields.io/badge/Deno-v1.29.4-informational?logo=deno) <!-- @denopendabot denoland/deno -->

<!-- deno-fmt-ignore-end -->

**Denopendabot** is a GitHub App, GitHub Action, and Deno module to keep the
dependencies of your Deno projects up-to-date.

Obviously inspired by [Dependabot](https://github.com/features/security/), and
making up for their missing support for Deno. Written in Deno, and running on
Deno Deploy.

> **Warning**\
> Still under development. Many bugs might remain. Any breaking changes may be
> introduced on each Feature release.

## :magic_wand: Features

### Update Deno modules

<!-- @denopendabot ignore-start -->

```typescript
import $ from "https://deno.land/x/dax@0.14.0/mod.ts";
```

```diff
- import $ from "https://deno.land/x/dax@0.14.0/mod.ts";
+ import $ from "https://deno.land/x/dax@0.15.0/mod.ts";
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

```diff
-   deno-version: v1.26.0 # @denopendabot denoland/deno
+   deno-version: v1.26.1 # @denopendabot denoland/deno
```

<!-- @denopendabot ignore-end -->

Denopendabot can also update release versions of GitHub repositories, specified
by comments of `@denopendabot {owner}/{repo}`.

### Create pull requests

- Commits are created for each updated module/repository individually
- Each run of Denopendabot creates only one pull request

See [the example pull requests](https://github.com/hasundue/denopendabot/pulls).

## :rocket: Getting started

### GitHub App

The easiest way to use Denopendabot is to install the
[GitHub App](https://github.com/apps/denopendabot). After installation,
Denopendabot will send a pull request to create
[`denopendabot.yml`](./app/denopendabot.yml) in `.github/workflows` if it finds
your repository to be a Deno project. Merge it to get ready, or create the file
by yourself.

> **Warning**\
> Denopendabot requires write access to your workflows, which technically
> enables the bot to perform script injection on your repository. Install the
> app only if you are sure that it is reliable.

### GitHub Action

If you don't want to send repository contents to the app, you can use our
[GitHub Action](https://github.com/marketplace/actions/denopendabot) to run
Denopendabot locally inside the GitHub Actions environment.

The action needs a GitHub access token authorized to run workflows.
`secrets.GITHUB_TOKEN` is used by default and it works fine in most cases.

If you want to update workflow files (`.github/workflows/*.yml`), it also needs
a private access token with the `workflow` scope. In the examples below, we
assume the token is added in repository secrets as `GH_TOKEN`.

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
      - uses: hasundue/denopendabot@0.15.0 # @denopendabot hasundue/denopendabot
        with:
          user-token: ${{ secrets.GH_TOKEN }} # needed for updating workflows
```

See [action.yml](./action.yml) for other options.

## :handshake: Contributing

Star the repository, and use Denopendabot for your project! Feel free to make an
issue when you find any problem.

Pull requests for bug-fix, testing, or documentation are always welcome.

If you want to create a pull request for feature addition or refactoring, it is
recommended to make an issue first, since we don't necessarily like the changes.
