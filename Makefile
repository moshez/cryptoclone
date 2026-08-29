.PHONY: corpus pipeline-test app-test e2e

# The 60-200 window is wider than the 60-120 default: Fry's standalone
# aphorisms mostly run long, and the uniqueness check rejects heavily at
# short lengths.
corpus:
	python3 -m pipeline.cli corpus --max-len 200

pipeline-test:
	python3 -m pytest pipeline/tests -q

app-test:
	cd app && npm test

e2e:
	cd app && npm run build
	cd e2e && npm test
