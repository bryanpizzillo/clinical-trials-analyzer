'use strict';

const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const _ = require('lodash');

/**
 * Class representing a mapping of NCI Thesaurus to PDQ
 * 
 * @class NciPdqMap
 */
class NciPdqMap {

    /**
     * Creates an instance of NciPdqMap.
     * NOTE: This loads the map, so try not to do this too many times.
     * 
     * @memberOf NciPdqMap
     */
    constructor() {

        this.pdqToNCIt = {};
        this.ncitToPdq = {};

        try {
            this._loadMap();
        } catch(err) {
            console.log(err);
        }

    }

    /**
     * Loads the map file calling done callback when finished.
     * 
     * @param {any} done
     * 
     * @memberOf NciPdqMap
     */
    _loadMap(done) {

        // This is soooo ineffecient, but I don't want to make the constructor
        // async, and all the junk that comes with it.  Which would really require
        // me to duplicate a bunch of code and other stupidity.
        
        let input = fs.readFileSync(__dirname + '/../data/PDQ_TO_NCI_MAP.csv');
        let records = parse(input, {});

        let currThis = this;

        records.forEach((record) => {
            //0 is PDQ ID
            //8 is NCIt code
            let pdqID = record[0];
            let ncitCode = record[8];

            if (!(currThis.ncitToPdq[ncitCode.toLowerCase()])) {
                currThis.ncitToPdq[ncitCode.toLowerCase()] = [];
            }
            if (!(currThis.pdqToNCIt[pdqID.toLowerCase()])) {
                currThis.pdqToNCIt[pdqID.toLowerCase()] = [];
            }

            //So there are a number of PDQ and NCIt terms that are 
            //one to many.  So we will treat them as arrays. 
            currThis.ncitToPdq[ncitCode.toLowerCase()].push(pdqID);
            currThis.pdqToNCIt[pdqID.toLowerCase()].push(ncitCode);
        });
    }

    /**
     * Gets the PDQ ID from a NCIt C Code
     * 
     * @param {any} ccode The NCI Thesaurus Code.
     * 
     * @memberOf NciPdqMap
     */
    getPdqIDByCCode(ccode) {

        let lowerCode = ccode.toLowerCase();
        if (this.ncitToPdq[lowerCode]) {
            return this.ncitToPdq[lowerCode];
        } else {
            return false;
        }        
    }
}

module.exports = NciPdqMap;