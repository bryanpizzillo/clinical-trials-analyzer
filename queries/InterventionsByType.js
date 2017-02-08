/* 
    Aggregate2CSV commander component to take an Aggregate Query and turn it into a CSV file.
 */
'use strict';

const BaseAggQuery = require('../lib/BaseAggQuery');
const async = require('async');
const elasticsearch = require('elasticsearch');
const _ = require('lodash');
const AggregateWorkBook = require('../lib/AggregateWorkBook');

class InterventionsByType extends BaseAggQuery {    

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
        return require('./json/Interventions_ByType.json');
    }

    /**
     * Extracts the interventions information from an aggregate
     * and "returns" an Array of type,name pairs using the done callback
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

                interventions.push([code, currType, name_bucket.key]);
            })
        });

        done(false, interventions);
    }
    
    /**
     * Generates a workbook from a list of interventions and
     * "returns" the workbook using the done callback
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
            'Viewable Count',
            'All Count'
        ]);        

        interventions.forEach((row) => {
            wb.addRowToSheet('Interventions', row);
        });

        done(false, wb);
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
        
        //If we do not have aggregations, then exit.
        if (!(es_results || es_results.aggregations && _.keys(es_results.aggregations).length > 0)) {
            callback(new Error("There was no interventions aggregate."), false );
        }

        var interventionsAgg = es_results.aggregations['interventions'];        

        //Extract
        async.waterfall([            
            (next) => { this._extractInterventions(interventionsAgg, next) },
            //Parrallel Add trials
            (res, next) => {
                async.map(
                    res,
                    this._addTrialCountsToRow.bind(this),
                    next
                )
            },
            (res, next) => { this._generateWorkbook(res, next) }
        ], callback);
    }

    /**
     * Adds the count of All trials, and a count of only the viewable trials
     * to the input row.
     * 
     * @param {any} row An array of [ C Code, Term Type, and Term Name ]
     * @param {any} done A callback when finished. (err, results)
     * 
     * @memberOf InterventionsByType
     */
    _addTrialCountsToRow(row, done) {

        let newRow = row.slice();

        async.waterfall([
            (next) => { this._getViewableTrialCount(row[1], row[2], next) },
            (res, next) => { 
                //set viewable count
                newRow.push(res);
                next(false,false)
            },
            (res, next) => { this._getAllTrialCount(row[1], row[2], next) },
            (res, next) => { 
                //set all count
                newRow.push(res);                
                next(false, newRow)
            },            
        ],
        done
        ); 
    }

    /**
     * Gets a count of the number of viewable trials for this named intervention of 
     * a given type.
     * 
     * NOTE: Type probably does not matter, but since we are building this sheet
     * based on the interventions, we should be as specific as possible with the counts.
     * 
     * @param {any} type The type of intervention
     * @param {any} name The name of the intervention
     * @param {any} done A completion callback (err, result)
     * 
     * @memberOf InterventionsByType
     */
    _getViewableTrialCount(type, name, done) {
        this.client.count(
            {
                index: this.index,
                body: {
                    size: 0,
                    filter: {
                        bool: {
                            must: this._getNestedTypeNameFilter(type, name),
                            should: this._getViewAbleTrialsFilterArray()
                        }
                    }
                }
            },
            (err, response) => {
                if (err) {
                    done(err);
                }

                done(false, response.count);                
            }
        )
    }

    /**
     * Gets a count of the number of all trials for this named intervention of 
     * a given type.
     * 
     * NOTE: Type probably does not matter, but since we are building this sheet
     * based on the interventions, we should be as specific as possible with the counts.
     * 
     * @param {any} type The type of intervention
     * @param {any} name The name of the intervention
     * @param {any} done A completion callback (err, result)
     * 
     * @memberOf InterventionsByType
     */
    _getAllTrialCount(type, name, done) {
        this.client.count(
            {
                index: this.index,
                body: {
                    size: 0,
                    filter: {
                        bool: {
                            must: this._getNestedTypeNameFilter(type, name)
                        }
                    }
                }
            },
            (err, response) => {
                if (err) {
                    done(err);
                }

                done(false, response.count);                
            }
        )
    }

    /**
     * Gets the ES filter for handling the type/name filtering.
     * 
     * @param {any} type The type of intervention
     * @param {any} name The name of the intervention
     * @returns
     * 
     * @memberOf InterventionsByType
     */
    _getNestedTypeNameFilter(type, name) {
        return {
            "nested" : {
                "path" : "arms.interventions",
                "score_mode" : "avg",
                "filter" : {
                    "bool" : {
                        "must" : [
                            { "term" : {"arms.interventions.intervention_type" : type } },
                            { "term" : {"arms.interventions.intervention_name" : name } }
                        ]
                    }
                }
            }
        };
    }
  
}

//This exposes the command for use by autocmd.
module.exports = InterventionsByType;
