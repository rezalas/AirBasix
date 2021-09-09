# AirBasix

AirBasix synchronizes airtable bases to wix collections, typically with the help of wix cron jobs. Once you add AirBasix to the package imports in Wix you need to implement a backend script that creates an Airbasix object passing in the required parameters. If you want to perform the updates automatically you also need to create a wix cron job that repeats as often as you want.


## Dependencies and Requirements
### API Access

* Airtable API 
* Wix-data API

### Keys

* Airtable API Key
* Airtable Base ID

### Packages

* Airtable JS

## Suggestions

Airtable suggests using a separate account for implementing API access, and granting that account the minimum required access. For safety purposes I suggest you create an account dedicated to this synchronization and only grant it read-only access to any data you want to sync. 

## Use Example

### Node 

Implementing functionality for the node module is relatively simple. Just create an instance of airbasix with the keys and table data you want, call `manualUpdate()` and wait for it to complete. That's it!

```js
const AirBasix = require('airbasix');

let basix = new AirBasix('airtableKey','airtableBaseId','wixCollectionName','airtableTableOrViewName');
await basix.manualUpdate();
```


### Legacy (non-module JS version)

First, you need to update the following keys based on your accounts and API data from airtable.

```js
const airtableApiKey = 'keySomeKey'; // the key from your read-only airtable account
const airtableBaseId = 'baseSomeBase'; // The Base ID found in your api docs
const wixAirtableStore = 'AWixCollection'; // The collection to hold the data
const airtableRootDb = 'AnAirtableViewName'; // The view/table in airtable

```

After that just run the following command or schedule a wix cronjob to do it for you.

```js
ManualUpdate();
```