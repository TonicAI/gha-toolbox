# Ephemeral Databases

This action is used to create or destroy a database on a Tonic Ephemeral deployment.

A Tonic Ephemeral host must be provided, alongside a valid API key in order to authenticate with the server.

API keys for a user can be made in the UI of Tonic Ephemeral on the settings page.

# Usage

<!-- start usage -->
```yaml
- uses: tonicai/gha-toolbox/ephemeral/database@main
  with:
    # Hostname of the Tonic Ephemeral deployment
    host: https://ephemeral.tonic.ai

    # The api key for the chosen user on the specified deployment
    key: <api-key>

    # The name of the database to either create or destroy
    name: my-ephemeral-database
    
    # Whether to create a database named <name> or to destroy the database named <name>
    # Possible values: [ 'create-if-not-exists' | 'delete-if-exists' ]
    mode: create-if-not-exists

    # The configuration to give the database, when in create mode
    # See ephemeral documentation for more details
    configuration: |
      baseImageId: 626ba666-82d7-4466-b885-cdd731834157
      resourceGroupId: 53ef99c8-06ea-4480-a6aa-f4aeabdc6ead
      storageSizeInGigabytes: 5
      volumeReference: example.com/ephemeral-volumes:postgres
      configurationFile: |
        max_connections = 300
        shared_buffers = 80MB
```
<!-- end usage -->

# Modes

- [Create a database](#Create-a-database)
- [Destroy a database](#Destroy-a-database)
- [Destroy multiple databases](#Destroy-multiple-databases)

## Create database

When the mode is specified as `create-if-not-exists` the action will first query the Ephemeral user's databases for a database with the given input `name`.  If a database with a matching name is not found, the action will create and await the initialization of a database with the given input `configuration`.

The database can be created from a snapshot in order to pre-populate it with data, or it can be created as an empty database. 

```yaml
- uses: tonicai/gha-toolbox/ephemeral/database@main 
  with:
    host: https://ephemeral.tonic.ai

    key: <api-key>

    name: my-ephemeral-database    

    mode: create-if-not-exists

    configuration: |
      baseImageId: 626ba666-82d7-4466-b885-cdd731834157
      resourceGroupId: 53ef99c8-06ea-4480-a6aa-f4aeabdc6ead
      storageSizeInGigabytes: 5
      volumeSnapshotId: 2334f1ad-82dd-9013-ab45-dae6cdb15590
      configurationFile: |
        max_connections = 300
        shared_buffers = 80MB
```

## Destroy a database
When the mode is specified as `destroy-if-exists` the action will first query the Ephemeral user's databases for a database with the given input `name`.  If exactly one database with a matching name is found, this action will make a request to delete it.

```yaml
- uses: tonicai/gha-toolbox/ephemeral/database@main 
  with:
    host: https://ephemeral.tonic.ai

    key: <api-key> 

    name: my-ephemeral-database    

    mode: destroy-if-exists
```

## Destroy multiple databases
When the mode is specified as `destroy-if-exists` the action will first query the Ephemeral user's databases for a database with the given input `name`.  If exactly one database with a matching name is found, this action will make a request to delete it.

```yaml
- uses: tonicai/gha-toolbox/ephemeral/database@main 
  with:
    host: https://ephemeral.tonic.ai

    key: <api-key> 

    name: |
      my-ephemeral-database1
      my-ephemeral-database2    
      my-ephemeral-database3

    mode: destroy-many
```

# License

TODO

