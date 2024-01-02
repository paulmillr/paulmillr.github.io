# GH pages and IPFS site

`noble/demo-ecc` contains React app that allows to calculate ECC keys with Noble.

### GH Pages

Simply commit and push changes

### IPFS

1. `npm install -g all-relative` to install node.js deps
2. `bundle install` to install jekyll with Ruby 3
3. `make` to build the website
4. Upload `_site` directory to IPFS. Pin it via your node, or via [Pinata](https://app.pinata.cloud/pinmanager)
5. Copy `CID`

Optional: [link the domain to DNS and ENS](https://docs.ipfs.io/how-to/websites-on-ipfs/link-a-domain/#domain-name-service-dns)
