class AirBasix {

    readonly _airtableApiKey: string;
    readonly _airtableBaseId: string;
    readonly _wixAirtableStore: string;
    readonly _airtableRootDb: string;

    
    constructor(airtableKey:string, airtableBase:string, wixCollectionStore:string, airtableRootDb:string) {
        this._airtableApiKey = airtableKey;       
    }
}