# AirBasix

AirBasix synchronizes airtable bases to wix collections with the help of wix cron jobs. In order to use this you need to add AirBasix to the backend section of Wix and add the Airtable Api Node module. If you want to perform the updates automatically you also need to create a wix cron job that repeats as often as you want and executes the exported manual sync function. 


## Dependencies and Requirements
### API Access

* Airtable API 
* Wix-data API

### Keys

* Airtable API Key
* Airtable Base ID

### Packages

* Airtable JS [npm package link]('https://www.npmjs.com/package/airtable')

## Suggestions

Airtable suggests using a separate account for implementing API access, and granting that account the minimum required access. For our purposes I suggest you create an account dedicated to this synchronization and only grant it read-only access to any data you want to sync. 

## Use Example

First, you need to update the following keys based on your accounts and API data from airtable.

```js
const airtableApiKey = 'keySomeKey'; // the key from your read-only airtable account
const airtableBaseId = 'baseSomeBase'; // The Base ID found in your api docs
const wixAirtableStore = 'AWixCollection'; // The collection to hold the data
const airtableRootDb = 'AnAirtableViewName'; // The view/table in airtable

```

After that just run the following command 

```js
ManualUpdate();
```