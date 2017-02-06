/* 
    Aggregate2CSV commander component to take an Aggregate Query and turn it into a CSV file.
 */
'use strict';

const BaseAggQuery = require('../lib/BaseAggQuery');
const async = require('async');
const elasticsearch = require('elasticsearch');
const _ = require('lodash');
const AggregateWorkBook = require('../lib/AggregateWorkBook');

class ViewableInterventionsByType extends BaseAggQuery {    

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
    }

    /**
     * INTERNAL: Loads the Interventions by Type query
     * 
     * @returns
     * 
     * @memberOf ViewableInterventionsByType
     */
    _loadQuery() {
        return require('./json/View-able_Interventions_ByType.json');
    }

    /**
     * Flattens the aggregates into a "table" 
     * 
     * @param {any} es_results Elasticsearch results from a query - with 1 aggregate
     * @param {any} callback A completion callback passing error and an AggregateWorkBook
     * 
     * @memberOf ViewableInterventionsByType
     */
    _processAggregates(es_results, callback) {
        console.log("Processing Aggregates");
        
        let wb = new AggregateWorkBook();
        wb.addSheet('Interventions');

        wb.addHeadersRow('Interventions', [
            'arms.interventions.intervention_type',
            'arms.interventions.intervention_name',
            'count'
        ]);
        
        if (es_results && es_results.aggregations && _.keys(es_results.aggregations).length > 0) {

            var interventionsAgg = es_results.aggregations['interventions'];            

            interventionsAgg["arms.interventions.intervention_type"].buckets.forEach((type_bucket) => {
                //This should be something like "drug"
                let currType = type_bucket.key;

                type_bucket["arms.interventions.intervention_name"].buckets.forEach((name_bucket) => {
                    wb.addRowToSheet('Interventions', [
                        currType,
                        name_bucket.key,
                        name_bucket.doc_count // NOTE: Count of Intervention Instances, not trials.
                    ])
                })

            });
            
            
        } else {
            callback(new Error("There was no interventions aggregate."), false );
        }
        
        callback(null, wb);
    }


}

//This exposes the command for use by autocmd.
module.exports = ViewableInterventionsByType;
