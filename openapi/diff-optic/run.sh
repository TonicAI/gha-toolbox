#!/bin/bash
set -xe

echo "🔍 Checking for API breaking changes..."

npm install -g @useoptic/optic

if ! optic \
    diff \
    "${OPENAPI_URI_ORIGINAL}" \
    "${OPENAPI_URI_UPDATED}" \
    --standard "${GITHUB_WORKSPACE}/.optic/optic.yml" \
    --severity error 2>/dev/null; then
    echo "❌ Breaking API changes detected!"
    BREAKING_CHANGES=true
else
    echo "✅ No breaking API changes"
fi

echo ""
echo "=================================================================="

if [ "$BREAKING_CHANGES" = true ]; then
    echo "❌ API BREAKING CHANGES DETECTED!"
    echo ""
    echo "🚨 This PR contains potentially breaking changes:"
    echo "   • .NET assembly API changes, or"
    echo "   • HTTP endpoint route changes, or"
    echo "   • Removed HTTP endpoints"
    echo ""
    echo "If these changes are intentional:"
    echo "1. 📈 Update version numbers appropriately"
    echo "2. 📝 Document breaking changes in your PR description"
    echo "3. 🤔 Consider the impact on existing API consumers"
    echo "4. 📧 Notify teams that depend on these APIs"
    echo ""
    exit 1
else
    echo "✅ API COMPATIBILITY CHECK PASSED!"
    echo "No breaking changes detected in HTTP endpoints."
fi
