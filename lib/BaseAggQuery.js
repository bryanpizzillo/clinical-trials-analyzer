/* 
    Aggregate2CSV commander component to take an Aggregate Query and turn it into a CSV file.
 */
'use strict';

const async = require('async');
const elasticsearch = require('elasticsearch');

class BaseAggQuery {

    constructor(es_index, es_client, outputFile) {        
        this.index = es_index;
        this.client = es_client;

        this.outputFile = outputFile;

        this.query = this._loadQuery();
    }
    
    _loadQuery() {
        throw Error("BaseAggQuery: _loadQuery not implemented!");
    }

    /**
     * Runs the Elasticsearch query
     * 
     * @param {any} callback A completion callback
     * 
     * @memberOf AggregateReporter
     */
    _runQuery(callback) {
        console.log("Running Query")

        this.client.search({
            index: this.index,
            body: this.query
        },
        (err, resp, _respcode) => {
            //if _respcode != 200, make error.
            callback(err, resp);
        });
    }

    /**
     * Flattens the aggregates into a "table" 
     * 
     * MUST BE IMPLEMENTED BY INHERITING CLASS
     * 
     * @param {any} es_results Elasticsearch results from a query - with 1 aggregate
     * @param {any} callback A completion callback passing error and an AggregateWorkBook
     * 
     * @memberOf BaseAggQuery
     */
    _processAggregates(res, done) {
        done(new Error("BaseAggQuery: _processAggregates must be implemented!"), false);        
    }

    /**
     * Handles the saving of the generated workbook 
     * 
     * @param {any} res
     * @param {any} done
     * 
     * @memberOf BaseAggQuery
     */
    _outputWorkbook(aggWorkbook, done) {
        aggWorkbook.write(this.outputFile, done);
    }

    /**
     * Runs the command.  
     *  
     * 
     * @param {any} done A callback to be called when completed.
     * 
     * @memberOf AggregateReporter
     */
    run(done) {        
        console.log("Beginning Run");

        async.waterfall([
            (next) => this._runQuery(next),
            (res, next) => this._processAggregates(res, next),
            (res, next) => this._outputWorkbook(res, next)
        ],
        done
        );        
    }

}

//This exposes the command for use by autocmd.
module.exports = BaseAggQuery;
