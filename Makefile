build-for-ipfs:
	bundle exec jekyll build
	cd _site && npx all-relative
