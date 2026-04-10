# browse — Headless browser MCP for Claude Code
# Version source: package.json

default:
    @just --list

# Build
build:
    npm run build

# Test
test:
    npm test

# Lint + fix
fix:
    npm run fix

# Type check
check:
    npm run typecheck

# Hash bump — version with git hash suffix, no tag
bump:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{justfile_directory()}}"
    BASE=$(python3 -c "import json; v=json.load(open('package.json'))['version']; print(v.split('-')[0])")
    HASH=$(git rev-parse --short HEAD)
    NEW="${BASE}-${HASH}"
    npm version "${NEW}" --no-git-tag-version --allow-same-version >/dev/null
    echo "Version: ${NEW}"

# Patch bump — bump patch, commit, tag, publish
bump-patch:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{justfile_directory()}}"
    npm version patch -m "Bump version to %s"
    echo "Tagged v$(python3 -c "import json; print(json.load(open('package.json'))['version'])")"

# Minor bump
bump-minor:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{justfile_directory()}}"
    npm version minor -m "Bump version to %s"
    echo "Tagged v$(python3 -c "import json; print(json.load(open('package.json'))['version'])")"

# Major bump
bump-major:
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{justfile_directory()}}"
    npm version major -m "Bump version to %s"
    echo "Tagged v$(python3 -c "import json; print(json.load(open('package.json'))['version'])")"

# Publish to npm
publish: build
    npm publish --access public

# Install globally
install: build
    npm install -g .

# Show current version
version:
    @python3 -c "import json; print(json.load(open('package.json'))['version'])"
