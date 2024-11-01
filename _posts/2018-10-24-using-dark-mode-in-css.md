---
layout: post
title: Using dark mode in CSS
tags: ['programming']
highlight: true
---

MacOS Mojave has been recently released with the Dark Mode.

The option allows you to enable dark interface through all the system, which is very useful while working in the evenings and nights. Native apps are able to take advantage of the mode by following [the interface guidelines](https://developer.apple.com/documentation/uikit/appearance_customization/supporting_dark_mode_in_your_interface).

What about web apps? The good news is: Safari 12.1, Chrome 73 and Firefox 67 support Dark Mode! The CSS itself is very simple:

```css
/* Text and background color for light mode */
body {
  color: #333;
}

/* Text and background color for dark mode */
@media (prefers-color-scheme: dark) {
  body {
    color: #ddd;
    background-color: #222;
  }
}
```

The `prefers-color-scheme` query supports three values: `dark`, `light`, and `no-preference`.

To use it in JS, `window.matchMedia('(prefers-color-scheme: dark)')` would do the trick. No polyfills are required, the CSS/JS code would be skipped if your browser doesn't support it.

For the demo, open this site in Safari, Chrome or Firefox with MacOS Dark Mode enabled. iOS would probably also get a dark mode in the next major update.

<video loop autoplay muted playsinline style="width: 100%">
  <source src="/media/posts/using-dark-mode-in-css/dark-mode-demo.mp4" type="video/mp4">
  <source src="/media/posts/using-dark-mode-in-css/dark-mode-demo.mov" type="video/quicktime">
</video>
