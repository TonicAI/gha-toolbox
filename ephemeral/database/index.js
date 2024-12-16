const core = require("@actions/core");
const yaml = require("yaml");
const axios = require("axios");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const connectionInformation = database => {
  if (database.status !== 'Running') {
    throw new Error(`Database ${database.name} is not running, cannot get connection information`);
  }

  return {
    databaseEntityId: database.databaseEntityId,
    status: database.status,
    host: `${database.kubernetesServiceName}.${database.kubernetesNamespace}`,
    port: database.port,
    databaseName: database.databaseName,
    user: database.databaseUserName,
    password: database.databasePassword,
  }
};

class EphemeralClient {
  constructor(http) {
    this.http = http;
  }

  async byName(name) {
    const resp = await this.http.get(`?filters[0].key=name&filters[0].value=${name}`);

    switch (resp.data.totalRecords) {
      case 0:
        return {exists: false}
      case 1:
        return {exists: true, ...resp.data.records[0]}
      default:
        throw new Error(`Expected 0 or 1 databases named ${name} but got ${resp.data.totalRecords}`);
    }
  }

  async get(database) {
    const resp = await this.http.get(`${database.databaseEntityId}`);
    return resp.data;
  }

  async create(configuration) {
    const resp = await this.http.post('', configuration);

    return {
      databaseEntityId: resp.data
    };
  }

  async waitForStart(database) {
    let remainingAttempts = 60;

    while (database.status !== 'Running') {
      remainingAttempts--;
      if (remainingAttempts < 0) {
        throw new Error("Timed out waiting for database to start");
      }
      core.info(`Database ${database.name || database.databaseEntityId} is status ${database.status || 'Unknown'}, waiting...`);
      await sleep(3000);
      database = await this.get(database);
    }

    core.info(`Database ${database.name || database.databaseEntityId} is running`);
    return database;
  }

  async destroy(database) {
    await this.http.delete(`${database.databaseEntityId}`)
  }
}

async function runDestroy(client, name) {
  core.info(`Destroying database ${name}`);
  const database = await client.byName(name);
  if (!database.exists) {
    core.info("Database does not exist, finished");
    return;
  }
  await client.destroy(database);
  core.info("Destroyed database");
}

async function runCreate(client, name) {
  core.info(`Creating database ${name}`);
  let database = await client.byName(name);

  if (!database.exists) {
    core.info(`Database does not exist, creating`);
    const configuration = yaml.parse(core.getInput("configuration", {required: true}));
    configuration.name = name;
    database = await client.create(configuration);
  } else {
    core.info("Database exists already");
  }

  core.info(`Getting connection information`);
  database = await client.waitForStart(database);
  const connection = connectionInformation(database);

  core.setOutput("json", JSON.stringify(database));
  core.setOutput("host", connection.host);
  core.setOutput("port", connection.port);
  core.setOutput("username", connection.username);
  core.setOutput("password", connection.password);
  core.setOutput("database", connection.databaseName);
}

async function main() {
  const host = core.getInput("host", {required: true});
  const key = core.getInput("key", {required: true});
  const name = core.getInput("name", {required: true});
  const mode = core.getInput("mode", {required: true}).toLowerCase();

  const http = axios.create({
    baseURL: `${host}/api/database`,
    headers: {
      'Authorization': `ApiKey ${key}`
    }
  });

  const client = new EphemeralClient(http);

  switch (mode) {
    case "create-if-not-exists":
      await runCreate(client, name);
      break;
    case "destroy-if-exists":
      await runDestroy(client, name);
      break;
    case "destroy-many":
      const names = name.split("\n");
      for (const thisName of names) {
        await runDestroy(client, thisName).catch(error => {
          core.setFailed(`Failed to delete ${thisName}\n${error.message}`);
          if (error instanceof Error && error.stack) {
            core.debug(error.stack);
          }
        });
      }
      break;
    default:
      throw new Error(`Unknown mode ${mode}`);
  }
}

main().catch((error) => {
  core.setFailed(error.message);
  if (error instanceof Error && error.stack) {
    core.debug(error.stack);
  }
});
