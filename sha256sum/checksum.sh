set -euo pipefail
CI_DEBUG="${CI_DEBUG:-}"
if [ -n "${CI_DEBUG}" ]; then
  set -x
fi
CONTENT="${CONTENT:-}"
FILES="${FILES:-}"
GITHUB_OUTPUT="${GITHUB_OUTPUT:-"/dev/null"}"
HASH=""

function add_hash() {
  HASH="${HASH}${1}"
}

if [ -n "${CONTENT}" ]; then
  add_hash "$(echo -n "${CONTENT}" | sha256sum | cut -f1 -d' ' | xargs)"
fi

#fragile, be careful
COMMENT_PATTERN="^ *#"
if [ -n "${FILES}" ]; then
  while IFS= read -r line || [[ -n $line ]]; do
    if [ -z "${line}" ] || [[ $line =~ $COMMENT_PATTERN ]]; then
      continue
    fi
    if [ ! -f "${line}" ]; then
      echo "::error::${line} not found"
      exit 2
    fi
    add_hash "$(sha256sum "${line}" | cut -f1 -d' ' | xargs)"
  done < <(printf '%s' "${FILES}")
fi


HASH_LEN=$(echo -n "${HASH}" | wc -c | xargs)
if [ "${HASH_LEN}" != "64" ]; then
  HASH="$(echo -n "${HASH}" | sha256sum | cut -f1 -d' ' | xargs)"
fi

echo "sha256sum=${HASH}" | tee -a "${GITHUB_OUTPUT}"
