/* 
    Aggregate2CSV commander component to take an Aggregate Query and turn it into a CSV file.
 */
'use strict';

const InterventionsByType = require('./InterventionsByType');
const NciPdqMap = require('../lib/NciPdqMap');


const async = require('async');
const elasticsearch = require('elasticsearch');
const _ = require('lodash');
const AggregateWorkBook = require('../lib/AggregateWorkBook');

/**
 * Gets a report of the interventions (name&type) contained in all trials,
 * along with the number of all the trials with that intervention, and the
 * number of view-able trials with that intervention. Additionally, the report
 * also adds the PDQID of the Intervention, if it exists in the NCI Metathesaurus
 * PDQ->NCIt mapping file.
 * 
 * 
 * @class InterventionsByTypeWithPDQ
 * @extends {InterventionsByType}
 */
class InterventionsByTypeWithPDQ extends InterventionsByType {    

    /**
     * Creates an instance of ViewableInterventionsByType.
     * 
     * @param {any} es_index The name of the index to query
     * @param {any} es_client A valid elasticsearch client 
     * @param {any} outputFile The output file to save the results to
     * 
     * @memberOf ViewableInterventionsByType
     */
    constructor(es_index, es_client, outputFile) {
        super(es_index, es_client, outputFile);

        this.NCIMap = new NciPdqMap();
    }

    //inhert _loadQuery

    /**
     * Extracts the interventions information from an aggregate
     * and "returns" an Array of type,name pairs using the done callback
     * 
     * Overridden to inject PDQID to sheet
     * 
     * @param {any} interventionsAgg
     * @param {any} done
     * 
     * @memberOf InterventionsByType
     */
    _extractInterventions(interventionsAgg, done) {
        var interventions = [];

        interventionsAgg["arms.interventions.intervention_type"].buckets.forEach((type_bucket) => {
            //This should be something like "drug"
            let currType = type_bucket.key;

            type_bucket["arms.interventions.intervention_name"].buckets.forEach((name_bucket) => {

                let code = "UNK";

                if ( name_bucket["arms.interventions.intervention_code"] ) {
                    code = name_bucket["arms.interventions.intervention_code"].buckets[0].key;
                }

                let pdqID = false;

                if (code != "UNK") {
                    pdqID = this.NCIMap.getPdqIDByCCode(code);
                }

                let pdqString = "";
                if (pdqID !== false ){
                    if ( pdqID.length == 1 ) {
                        pdqString = pdqID[0];
                    } else {
                        pdqString = pdqID.join(',');
                    }
                } 

                interventions.push([code, currType, name_bucket.key, pdqID]);
            })
        });

        done(false, interventions);
    }

    /**
     * Generates a workbook from a list of interventions and
     * "returns" the workbook using the done callback
     * 
     * Overridden to add PDQID column to headers
     * 
     * @param {any} interventions
     * @param {any} done
     * 
     * @memberOf InterventionsByType
     */
    _generateWorkbook(interventions, done) {

        let wb = new AggregateWorkBook();
        wb.addSheet('Interventions');

        wb.addHeadersRow('Interventions', [            
            'arms.interventions.intervention_code',
            'arms.interventions.intervention_type',
            'arms.interventions.intervention_name',
            'PDQID',
            'Viewable Count',
            'All Count'
        ]);        

        interventions.forEach((row) => {
            wb.addRowToSheet('Interventions', row);
        });

        done(false, wb);
    }
}

//This exposes the command for use by autocmd.
module.exports = InterventionsByTypeWithPDQ;
