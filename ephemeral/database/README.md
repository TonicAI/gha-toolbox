# Ephemeral Databases

This action is used to create or destroy a database on a Tonic Ephemeral deployment.

A Tonic Ephemeral host must be provided, alongside a valid API key in order to authenticate with the server.  API keys for a user can be made in the UI of Tonic Ephemeral on the settings page.

# Usage

<!-- start usage -->
```yaml
- uses: tonicai/ephemeral-database
  with:

    # Hostname of the Tonic Ephemeral deployment
    host: 'https://ephemeral.tonic.ai'

    # The api key for the chosen user on the specified deployment
    key: '<your-api-key-here>'

    # The name of the database to either create or destroy
    name: 'My Ephemeral Database'
    
    # Whether to create a database named <name> or to destroy the database named <name>
    # Can be either: create-if-not-exists | delete-if-exists
    mode: 'create-if-not-exists'

    # The configuration to give the database, when in create mode
    configuration: 'TODO: yaml' 
```
<!-- end usage -->

# Modes

- [Create database](#Create-database)
- [Destroy database](#Destroy-database)

## Create database

When the mode is specified as `create-if-not-exists` the action will first query the Ephemeral user's databases for a database with the given input `name`.  If a database with a matching name is not found, the action will create and await the initialization of a database with the given input `configuration`.

### Configuration
The database can be created from a snapshot in order to pre-populate it with data, or it can be created as an empty database. 

```yaml
- uses: tonicai/ephemeral-database 
  with:
    host: 'https://ephemeral.tonic.ai'

    key: '<your-api-key-here>'

    name: 'My Ephemeral Database'
    
    mode: 'create-if-not-exists'

    configuration: 'TODO: yaml' 
```

## Destroy Database
When the mode is specified as `destroy-if-exists` the action will first query the Ephemeral user's databases for a database with the given input `name`.  If exactly one database with a matching name is found, this action will make a request to delete it.

```yaml
- uses: tonicai/ephemeral-database 
  with:
    host: 'https://ephemeral.tonic.ai'

    key: '<your-api-key-here>'

    name: 'My Ephemeral Database'
    
    mode: 'destroy-if-exists'
```

# License

TODO

