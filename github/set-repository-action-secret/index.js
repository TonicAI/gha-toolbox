const core = require("@actions/core");
const github = require("@actions/github");
const sodium = require('sodium-native');

async function run() {
    const token = core.getInput("repo-token", { required: true });
    const client = new github.getOctokit(token);

    const repository = core.getInput("repository");
    const owner = core.getInput("owner");
    const secret = core.getInput("secret-name", { required: true });
    const value = core.getInput("secret-value", { required: true });

    const { data: {key: publicKey, key_id: keyId} } = await client.rest.actions.getRepoPublicKey({repo: repository, owner });
    if (publicKey) {
      const key = Buffer.from(publicKey, 'base64');
      const message = Buffer.from(value);
      const ciphertext = Buffer.alloc(message.length + sodium.crypto_box_SEALBYTES);

      sodium.crypto_box_seal(ciphertext, message, key);
      const encryptedToken = ciphertext.toString('base64');

      await client.rest.actions.createOrUpdateRepoSecret({
        repo: repository,
        owner,
        secret_name: secret,
        encrypted_value: encryptedToken,
        key_id: keyId,
      });
    } else {
      core.error('Failed to fetch the public key. Unable to update secret');
    }
}

run().catch((error) => {
    core.setFailed(error.message);
    if (error instanceof Error && error.stack) {
        core.debug(error.stack);
    }
});
