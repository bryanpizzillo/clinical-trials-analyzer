'use strict';

const fs = require('fs');
const parse = require('csv-parse');

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

        this._loadMap((err) => {
            if (err) {
                throw err;
            } else {
                return;
            }            
        })
    }

    /**
     * Loads the map file calling done callback when finished.
     * 
     * @param {any} done
     * 
     * @memberOf NciPdqMap
     */
    _loadMap(done) {

        var parser = parse();

        parser.on('readable', () => {
            let record = false;

            while(record = parser.read()) {

                //0 is PDQ ID
                //8 is NCIt code
                let pdqID = record[0];
                let ncitCode = record[8];

                this.ncitToPdq[ncitCode] = pdqID;
                this.pdqToNCIt[pdqID] = ncitCode;
            }
        });

        parser.on('error', (err) => {
            done(err);
        });

        parser.on('finish', function() {
            done(false);
        });

        //Write
        var input = fs.createReadStream(__dirname + '/../data/PDQ_TO_NCI_MAP.csv');
        input.pipe(parser);
    }

    /**
     * Gets the PDQ ID from a NCIt C Code
     * 
     * @param {any} ccode The NCI Thesaurus Code.
     * 
     * @memberOf NciPdqMap
     */
    getPdqIDByCCode(ccode) {
        if (this.ncitToPdq[ccode]) {
            return this.ncitToPdq[ccode];
        } else {
            return false;
        }        
    }
}

module.exports = NciPdqMap;