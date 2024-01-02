---
layout: post
title: 'How to save 32TB of traffic every week with one NPM package'
tags: ['programming']
highlight: true
---

[Chokidar](https://github.com/paulmillr/chokidar) is a fast open-source file watcher for node.js. You give it a bunch of files, it watches them for changes and notifies you every time an old file is edited; or a new file is created.

I’ve created it in 2012, to mitigate differences between node file watching APIs such as `fs.watch` and `fs.watchFile`.  In 2013, we’ve found a great way to improve MacOS experience by adding [FSEvents](https://en.wikipedia.org/wiki/FSEvents) support.

Since then, the package gained huge popularity. Build tools and all sorts of apps added Chokidar as their dependency. One of the most prominent examples of this is [Microsoft Visual Studio Code](https://code.visualstudio.com), a cross-platform source code editor.

- [**11,707,948 NPM downloads**](https://www.npmjs.com/package/chokidar) every week. VS Code downloads are excluded from NPM, folks are getting it through its homepage.
- [2,421,435 GitHub repositories](https://github.com/paulmillr/chokidar/network/dependents) depend on Chokidar
- [4,483 NPM packages](https://www.npmjs.com/package/chokidar) depend on Chokidar

## Goals for v3: improve performance & UX
Chokidar 1 supported any node starting from 0.8. For version 3, we’ve decided to bump the requirement to node 8.x, which allowed to simplify architecture a lot. 8.x is the oldest node supported by node-core today, so this makes sense.

The main goal with v3 was to improve CPU + RAM usage and to reduce the number of dependencies.

1. Switching [node-fsevents](https://github.com/fsevents/fsevents) to [N-API](https://nodejs.org/api/n-api.html), a new API for building native addons. In v2, we’ve been using node-gyp, which is buggy, sloppy, and produced useless errors while compiling.
2. Rewriting [readdirp](https://github.com/paulmillr/readdirp) — another module of ours — to a stream API. Allowed to reduce memory consumption by a factor of 5 in some cases. By the way, Node 10+ allows using brand new `for-await`  syntax for streams — totally great developer UX.
3. To handle globs, we’ve rewritten [picomatch](https://github.com/micromatch/picomatch) and [braces](https://github.com/micromatch/braces) to use its own parsers instead of [3-rd party dep](https://github.com/here-be/snapdragon). This allowed to drop dependency count significantly.
4. For the remaining dependencies, we’ve walked through every package and removed all non-essential code from their NPM bundles. Which included tests, various fixtures. `package.json#files` field helped to accomplish this — you simply specify files which need to be included there.

## Every dependency is a potential security vulnerability
There is a sad trend in JS community to create packages that consume lots of dependencies. Django, a huge web-framework written in Python, uses only three deps right now. As a comparison, nest.js uses 41 dependency!

I want to emphasize that every dependency is a potential security vulnerability. Consider three cases:

1. Reputable developer giving project rights to a rogue developer in a good faith [(happened before)](https://medium.com/intrinsic/compromised-npm-package-event-stream-d47d08605502).
2. Reputable developer getting hacked and having a bad package published.
3. Rogue developer creating new project, waiting for it to become popular and pushing a bad version after that [(happened before)](https://blog.npmjs.org/post/185397814280/plot-to-steal-cryptocurrency-foiled-by-the-npm).

With Chokidar 3, we were able to cut down a number of dependencies **from 201 to just 15!** All dependencies which are maintained by folks that are not affiliated with chokidar have been removed.

To mitigate issue #2, Chokidar is also doing code signing right now. We’re using PGP keys to sign important commits & git tags.

## Numbers
Let’s compare `npm install` on a clean machine for v2 and v3:

Chokidar v2:

- Installation time: 7.753 sec
- Consumes 3.195mb of traffic (3.03mb down, 165kb up) and makes 46 network connections
- Creates 201 packages from 130 contributors and audits 2113 packages
- `node_modules` file count: 1,251 (484 *.js)
- `node_modules` size: 8.3Mb

Chokidar v3:

- Installation time: 1.575 sec **(4.9x faster)**
- Consumes 352Kb of traffic **(9x less)** (329kb down, 23kb up) and makes 16 network connections
- Creates 15 packages **(13x less)** from 20 contributors and audits 19 packages
- `node_modules` file count: 79 (26 *.js) **(15.8x less)**
- `node_modules` size: 496Kb **(16.7x less)**

In an ideal case, if every machine would have its caches clean, and NPM cleans them from time to time, using v3 would save us:

```python
downloads = 11707948
per_pkg_bytes = 3350200 - 360448
terabyte = 1024 ** 4
round(downloads * per_pkg_bytes / terabyte, 2)
# => 31.84
```

**32 Tb (2<sup>45</sup> bytes) of traffic is now going to be potentially saved every week!**

## In the end
It would be great if more software reduced its resource usage. We could improve user experience to so many people.

I look at you, a 103Mb iOS application.

At you, a web app with 950 NPM dependencies.

At you, an electron app with 1.2Gb RAM usage at startup.

And of course at you, a web page with 15 ad trackers.

Let’s work together on making our software swift, small & secure!

Thanks to [Philipp Dunkel](https://github.com/pipobscure), [Jon Schlinkert](https://github.com/jonschlinkert) and everyone else involved in releasing v3 out.

My next step is to create a set of highly auditable 0-dep cryptographic libraries for JS. I call it **noble-crypto** and the first packages are already out! Check it: [noble-ed25519](https://github.com/paulmillr/noble-ed25519) & [noble-secp256k1](https://github.com/paulmillr/noble-secp256k1).
