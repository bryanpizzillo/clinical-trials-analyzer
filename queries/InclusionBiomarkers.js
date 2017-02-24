/* 
    Aggregate2CSV commander component to take an Aggregate Query and turn it into a CSV file.
 */
'use strict';

const BaseAggQuery = require('../lib/BaseAggQuery');
const async = require('async');
const elasticsearch = require('elasticsearch');
const _ = require('lodash');
const AggregateWorkBook = require('../lib/AggregateWorkBook');

/**
 * Gets a report of the inclusion biomarkers contained in all trials,
 * along with the number of all the trials with those biomarkers, and the
 * number of view-able trials with those biomarkers.
 * 
 * @class InclusionBiomarkers
 * @extends {BaseAggQuery}
 */
class InclusionBiomarkers extends BaseAggQuery {    

    /**
     * Creates an instance of InclusionBiomarkers.
     * 
     * @param {any} es_index The name of the index to query
     * @param {any} es_client A valid elasticsearch client 
     * @param {any} outputFile The output file to save the results to
     * 
     * @memberOf InclusionBiomarkers
     */
    constructor(es_index, es_client, outputFile) {
        super(es_index, es_client, outputFile);
    }

    /**
     * INTERNAL: Loads the Biomarkers by Type query
     * 
     * @returns
     * 
     * @memberOf InclusionBiomarkers
     */
    _loadQuery() {
        return require('./json/InclusionBiomarkers.json');
    }

    /**
     * Extracts the biomarker information from an aggregate
     * and "returns" an Array of type,name pairs using the done callback
     * 
     * @param {any} agg
     * @param {any} done
     * 
     * @memberOf InclusionBiomarkers
     */
    _extractBiomarkers(agg, done) {
        var biomarkers = [];

        agg["biomarkers.nci_thesaurus_concept_id"].buckets.forEach((bio_bucket) => {
            //Start at the id level.
            //This should be something like "C12345"
            let ncitid = bio_bucket.key;

            //Move to the name level
            //This should be something like "her2/neu negative"
            //Note this assumes only one name per ID, which should be valid, but it
            //is an assumption that should hold true
            bio_bucket = bio_bucket["biomarkers.name"].buckets[0];
            let bioName = bio_bucket.key;

            if (bio_bucket["biomarkers.assay_purpose"].buckets.length < 1) {
                return; //Skip this item as it is not for inclusion criteria
            }

            let purpose_counts = 0;

            bio_bucket["biomarkers.assay_purpose"].buckets.forEach((purpose_bucket) => {

                purpose_counts += purpose_bucket["doc_count"];                
            })

            biomarkers.push([ncitid, bioName, purpose_counts]);
        });

        done(false, biomarkers);
    }
    
    /**
     * Generates a workbook from a list of interventions and
     * "returns" the workbook using the done callback
     * 
     * @param {any} interventions
     * @param {any} done
     * 
     * @memberOf InclusionBiomarkers
     */
    _generateWorkbook(interventions, done) {

        let wb = new AggregateWorkBook();
        wb.addSheet('Biomarkers');

        wb.addHeadersRow('Biomarkers', [
            'biomarkers.nci_thesaurus_concept_id',
            'biomarkers.name',
            'Instance Count across All Trials',
            'Viewable Trial Count',
            'All Trial Count'
        ]);        

        interventions.forEach((row) => {
            wb.addRowToSheet('Biomarkers', row);
        });

        done(false, wb);
    }

    /**
     * Flattens the aggregates into a "table" 
     * 
     * @param {any} es_results Elasticsearch results from a query - with 1 aggregate
     * @param {any} callback A completion callback passing error and an AggregateWorkBook
     * 
     * @memberOf InclusionBiomarkers
     */
    _processAggregates(es_results, callback) {
        console.log("Processing Aggregates");
        
        //If we do not have aggregations, then exit.
        if (!(es_results || es_results.aggregations && _.keys(es_results.aggregations).length > 0)) {
            callback(new Error("There was no interventions aggregate."), false );
        }

        var agg = es_results.aggregations['biomarkers'];        

        //Extract
        async.waterfall([            
            (next) => { this._extractBiomarkers(agg, next) },
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
     * @memberOf InclusionBiomarkers
     */
    _addTrialCountsToRow(row, done) {

        let newRow = row.slice();

        async.waterfall([
            (next) => { this._getViewableTrialCount(row[0], next) },
            (res, next) => { 
                //set viewable count
                newRow.push(res);
                next(false,false)
            },
            (res, next) => { this._getAllTrialCount(row[0], next) },
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
     * @memberOf InclusionBiomarkers
     */
    _getViewableTrialCount(nciid, done) {
        this.client.count(
            {
                index: this.index,
                body: {
                    size: 0,
                    filter: {
                        bool: {
                            must: this._getNestedBiomarkerIDFilter(nciid),
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
     * @memberOf InclusionBiomarkers
     */
    _getAllTrialCount(nciid, done) {
        this.client.count(
            {
                index: this.index,
                body: {
                    size: 0,
                    filter: {
                        bool: {
                            must: this._getNestedBiomarkerIDFilter(nciid)
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
     * @memberOf InclusionBiomarkers
     */
    _getNestedBiomarkerIDFilter(id, name) {
        return {
            "nested" : {
                "path" : "biomarkers",
                "score_mode" : "avg",
                "filter" : {
                    "bool" : {
                        "must" : [
                            { "term" : {"biomarkers.nci_thesaurus_concept_id" : id } }
                        ]
                    }
                }
            }
        };
    }
  
}

//This exposes the command for use by autocmd.
module.exports = InclusionBiomarkers;
