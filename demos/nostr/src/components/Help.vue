<script setup lang="ts">
  import { onBeforeUpdate, onMounted, ref } from 'vue'

  const props = defineProps<{
    showPrivacy: number
  }>()

  const privacyEl = ref<null | HTMLElement>(null)

  onMounted(() => {
    if (privacyEl.value && props.showPrivacy) {
      privacyEl.value.scrollIntoView()
    }
  })

  onBeforeUpdate(() => {
    if (privacyEl.value && props.showPrivacy) {
      privacyEl.value.scrollIntoView()
    }
  })
</script>

<template>
  <h3>Slightly Private App</h3>
  <p>
    <a href="https://nostr.com">nostr</a> is public, censorship-resistant social network.
    It's simple:

    <ol>
      <li>Select a relay from the list, or specify a <a href="https://nostr.watch/" target="_blank">custom URL</a></li>
      <li><em>Optionally</em>, set your private key, to create new messages</li>
    </ol>
  </p>

  <p>
    Traditional social networks can suppress certain posts or users.
    In nostr, every message is signed by user's <em>private key</em>
    and broadcasted to <em>relays</em>.
    <strong>Messages are tamper-resistant</strong>: no one can edit them,
    or the signature will become invalid.
    <strong>Users can't be blocked</strong>: even if a relay blocks someone, it's always
    possible to switch to a different one, or create up a personal relay.
  </p>

  <p>
    The app is available at <a href="http://nostr.spa">nostr.spa</a>. You can:
    <ul>
      <li><em>Connect</em> and see relay's global feed.</li>
      <li><em>Post</em> new messages to the relay.</li>
      <li><em>Broadcast</em> a pre-signed message. No need to enter a private key.</li>
      <li><em>Search</em> information about a user or an event.</li>
    </ul>
  </p>

  <p>
    <h3 id="#privacy" ref="privacyEl">Privacy policy</h3>
    <ul>
      <li>No tracking from our end</li>
      <li>Private keys are not sent anywhere. They are stored in RAM of your device</li>
      <li>Relay will see your ip+browser after you click <em>Connect</em> button</li>
      <li>GitHub will see ip+browser of anyone who's using the app, because it's hosted on GitHub Pages. They won't see any nostr-specific interactions you will make</li>
      <li><em>Show avatars</em> feature will leak your ip+browser to random people on the internet. Since there are no centralized servers in nostr, every user can specify their own URL for avatar hosting. Meaning, users can control the hosting webservers and see logs</li>
      <li><em>Remember me</em> feature will write private key you've entered to browser's Local Storage, which is usually stored on your device's disk</li>
      <li>VPN or TOR usage is advised, <em>as with any nostr client</em>, to prevent ip leakage</li>
    </ul>
  </p>

  <h3>Open source</h3>
  <p>
    The lightweight nostr client is built to showcase <a href="/noble/">noble</a> cryptography.
    Signing is done using
    <a target="_blank" href="https://github.com/paulmillr/noble-curves">noble-curves</a>, while <a target="_blank" href="https://github.com/paulmillr/scure-base">scure-base</a> is used for bech32,
    <a target="_blank" href="https://github.com/nbd-wtf/nostr-tools">nostr-tools</a> are used
    for general nostr utilities and Vue.js is utilized for UI.
    Check out <a target="_blank" href="https://github.com/paulmillr/paulmillr.github.io">the source code</a>. You are welcome to host the client on your personal website.
  </p>
</template>