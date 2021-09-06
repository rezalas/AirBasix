/*
 * If you're not sure how this all works, the following three keys are the 
 * most important things you need to change. Please note, for security purposes
 * make a secondary airtable account and grant it read-only access to your airtable
 * base, then use the API key for that user here. That way if it becomes compromised
 * 1) your data source remains uncorrupted and 2) you can easily change the key or
 * restrict the account from having access.
 */
const airtableApiKey = ''; // the per-user key from your read-only airtable account
const airtableBaseId = ''; // the ID of the base - you can find this in your api docs

/*
 * The name of the collection we intend to store our synchronized data in.
 * NOTE: This collection is going to be code-managed, and thus SHOULD NOT
 * BE USED FOR OTHER ENTRIES. Data not in the airtable source WILL be deleted
 * from the wix collection at every synchronization.
 */
const wixAirtableStore = 'Places'; 
/*
 * The name of the view we want to use (typically your default table name). If you don't want to use
 * the default view, change this to the view name of your choice.
 */
const airtableRootDb = 'Places'; 

const Airtable = require('airtable'); 
const baseApi = new Airtable({apiKey: airtableApiKey}).base(airtableBaseId);
const wixDataOpts = { 'suppressAuth' : true };
import wixData from 'wix-data';

// This is universal to all wix collections, and will likely break everything if you
// change it. 
// ex: const wixIdName = '_id';
const wixIdName = '_id';

/*
 * The following are field detection assumptions made based on my own needs. You may
 * need to change some of these based on your own assumptions of how things should 
 * be organized in airtables.
 */
// atid is an arbitrary airtable Id field for tracking purposes.
const wixAirtableIdName = 'atid';
const airtableTagsSubstring = 'tags';
const shadowTagFieldSuffix = 'shadow';
const generateShadowTagFields = true; // if you don't want shadow fields for using tags in dataset processing, set to false
const airtableAddressSubstring = 'address';
/*
 * If you need to use maps on your wix site based on airtable address data, you'll need to add a secondary field in airtable
 * that contains the geocode info for each address. This can be created by using the Maps App in Airtable. 
 */
const airtableGeocodeFieldName = 'geocode';
/**
 * Begins the process of synchronizing an airtables db and views with a wix collection.
 * This is the main entry point for a backend-only synchronizing module.
 * PLEASE NOTE: Due to the sensitive nature of the processes involved, you should not
 * run this on a front-end. This is a backend only module.
 */
export async function ManualUpdate() {
	await SyncViews();
	console.log("completed update");
}

/**
 * Processes views provided in the views constant, relative to the configured base api.
 * If the same Id is present in multiple airtable views the duplicates are skipped.
 */
async function SyncViews() {
	var presentIds = [];
	let noErrorsFound = true;

	/* For the chosen view, iterate over all the pages contained in that view and collect
     * that record data for use below.	
     */
	let atrecords = await baseApi(airtableRootDb)
		.select({pageSize: 100})
		.all();
		
	atrecords.forEach(function(atrecord) { 
		var currId = atrecord.id;
		if(presentIds.indexOf(currId) >= 0) {
			return; // skip IDs we've already processed if dupes are found. 
		}
		
		presentIds.push(currId);
		wixData.query(wixAirtableStore)		    
			.eq(wixAirtableIdName, currId) 
			.find()
			.then(function(wixrecords) {
				if(wixrecords.items.length > 0) {
					UpdateRecord(atrecord, wixrecords.items[0]);
				} else {
					InsertRecord(atrecord);
				}
			}).catch((error) => {
                noErrorsFound = false;
				LogError(error.message, error.code);
		});
		
	});
	console.log(`Updated ${presentIds.length} records.`);
	// clean up missing records if no errors were found in processing.
    if(noErrorsFound)
	    await RemoveMissingRecords(presentIds);

}

/**
 * Process error handling centrally for this module.
 * @param {string} errorMsg - The message describing the error received.
 * @param {string} code - The error code received, usually from the API. 
 */
function LogError (errorMsg, code) {
	console.log(`Error code ${code}: ${errorMsg}`);
}

/**
 * Inserts a new Airtable entry into the wix collection.
 * @param {object} atRecord - Airtable Record object.
 */
function InsertRecord(atRecord) {
	var wixItem = wixItem || {
		[wixAirtableIdName] : atRecord.id,
		'createdTime': atRecord.createdTime
	};
	
	wixItem = CopyAirtableFieldsToWixRecord(atRecord.fields, wixItem);
	UpdateWix(wixItem);
}

/**
 * Update the record data for a given entry existing in the wix collection.
 * @param {object} atRecord - Airtable Record object.
 * @param {object} wixRecord - Wix record object.
 */
function UpdateRecord(atRecord, wixRecord) {
	var wixItem = wixRecord || {
		[wixIdName] : wixItem._id,
		[wixAirtableIdName] : atRecord.id,
		'createdTime': atRecord.createdTime
	};

	wixItem = CopyAirtableFieldsToWixRecord(atRecord.fields, wixItem);
	UpdateWix(wixItem);
}

/**
 * Copies the fields from airtable to the appropriate wix record entries
 * based on a pre-determined field map.
 * @param {object} atFields - The Fields entry from the Airtable Record.
 * @param {object} wixRecord - The record being sent to wix, preloaded with
 * required ID and timestamp properties.
 * @returns {object} A WixRecord object with the appropriate data entries added.
 */
function CopyAirtableFieldsToWixRecord(atFields, wixRecord) {
	for(var member in atFields) { // automated field processing
		if(typeof(atFields) === 'function')
			continue; // skip over functions, only process data members. 
		
		var data = atFields[member];
		// this camelCases the member name so it fits with the fields used in Wix.
		var toMemberName = member.toLowerCase().replace('/','').replace(/(?:^\w|[A-Z]|\b\w)/g, (word,index) => index == 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g,'');

		if(Array.isArray(atFields[member])) {
			var dt = typeof(data[0]);
			if(dt === "string") {
				// strings should map cleanly across without processing.
				wixRecord[toMemberName] = data;
				
                if(generateShadowTagFields) {
                    // if this is a tags field add a shadow field with concatinated values
                    // so we can use it for filtering, since wix doesn't support filtering 
                    // by tags for some dumb reason.
                    if(member.toLowerCase().indexOf(airtableTagsSubstring) >= 0) {
                        wixRecord[toMemberName + shadowTagFieldSuffix] = data.join(',');
                    }
                }
			}
			else if(dt === 'object') {
				if(data[0].hasOwnProperty('type') && data[0].type.indexOf('image') >= 0) {
					// process as an array of images.
					var images = [];
					data.forEach((image) => images.push({type: 'image', src: image.url}));
					wixRecord[toMemberName] = images;
				}
			}
		}
		else { 
			/* If this is an address place it into an object with the value as "formatted"
             * otherwise check to see if it's a geocode entry for marking map locations.
             */
			if(member.toLowerCase().indexOf(airtableAddressSubstring) >= 0) {
				wixRecord[toMemberName] = { formatted: atFields[member]};
			}
			else if(member.toLowerCase().indexOf(airtableGeocodeFieldName) >= 0) {
				// geocode data in airtable is stored in a base64 string, so we need to 
                // break that out into json and then parse it into an object we can work with.
				var jsonString = new Buffer(atFields[member].split(' ')[1], 'base64').toString();
				var jsonObj = JSON.parse(jsonString);

				var wixObj = {'formatted': jsonObj.o.formattedAddress,
					'location': {
						'latitude': jsonObj.o.lat,
						'longitude': jsonObj.o.lng
					},
					//'subdivision': "OK", // You may need to add these for your purpose, if so look at the geocode entries. 
					//'country': "US"
				};

				wixRecord[toMemberName] = wixObj;
			} else {
				// process as basic strings and numbers, which need no translation.
				wixRecord[toMemberName] = atFields[member];
			}
		}
	}

	return wixRecord;
}

/**
 * Updates the wix collection with the specified entry, either calling insert
 * or update as needed via the wix-data.save function.
 * @param {object} wixItem - The fully formed WixRecord for entry.
 */
function UpdateWix(wixItem) {
	wixData.save(wixAirtableStore, wixItem, wixDataOpts).then((results) => {
		// the item was updated successfully
		console.debug("item " + results._id + " created.");
	}).catch((error) => { LogError(error.message, error.code); });
}

/**
 * Gathers a list of Ids contained in the wix collection that do not match Ids synchronized from
 * Airtable. These Ids likely need to be deleted, thus making that a simpler process.
 * @param {Array} keepids The ids we want to keep in the table, stored as an array of strings
 * @returns An array of wix collection Ids not matching the supplied list (limited to 1,000 Ids)
 */
async function getOrphanIds(keepids) {
	let foundIds = [];
	let records = await wixData.query(wixAirtableStore)
			.limit(1000) // this arbitrary limit is created by Wix. Should their policy change, so can this
			.not(wixData.query(wixAirtableStore).hasSome([wixAirtableIdName], keepids))
			.find(wixDataOpts);
	records.items.forEach(record => foundIds.push(record._id));

	return foundIds; 
}

/**
 * Processes all the Ids on Wix against a supplied list of airtable ids. 
 * Any that don't match what is in airtable are deleted. NOTE: Wix has an artificial limit based
 * on implementation that will only remove up to 1,000 IDs at a time. If you need to remove more,
 * I suggest you expand on this section to enable that process. 
 * @param {string[]} keepids - The list of all valid Ids from airtable.
 */
async function RemoveMissingRecords(keepids) {
	if(keepids == null || keepids == undefined || keepids.length == 0)
		return;
	
	console.log(keepids);
	let removeids = await getOrphanIds(keepids);
	
	if(removeids.length == 0) { // skip out if we're empty.
		console.log(`no orphans found, ending removal.`);
		return;
	}
	console.log(`${removeids.length} orphans found.`);
	
	wixData.bulkRemove(wixAirtableStore, removeids, wixDataOpts)
	.then((results) => {
		if(results.skipped > 0)
		{ console.error('skipped ' + results.skipped + ' items.'); }
		console.log('Removed ' + removeids.length +' orphaned entries.')
	}).catch((error) => {LogError(error.errorMsg, error.code)});

}