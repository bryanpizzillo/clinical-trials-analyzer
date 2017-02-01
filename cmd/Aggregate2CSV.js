/* 
    Aggregate2CSV commander component to take an Aggregate Query and turn it into a CSV file.
 */
'use strict';

//This exposes the command for use by autocmd.
module.exports = Aggregate2CSV;


// Load any required modules
const elasticsearch = require('elasticsearch');
const path = require('path');
const waterfall = require('async-waterfall');

/**
 * 
 * Class represents the command
 * 
 * @class AggregateReporter
 */
class AggregateReporter {

    /**
     * Creates an instance of AggregateReporter.
     * 
     * @param {any} config
     * 
     * @memberOf AggregateReporter
     */
    constructor(config) {

        this.esIndex = config.index;

        this.client = new elasticsearch.Client(
            {
                host: config.server + ":" + config.port,
                log: 'trace',
                apiVersion: "2.3"
            }
        );        

        var querypath = path.join(__dirname, '..', 'queries', config.query + '.json');
        querypath = path.normalize(querypath);

        try{ 
            this.query = require(querypath);
        } catch (err) {
            console.error(`Error loading query: ${err}`);
            throw err;
        }

        this.outputfile = outputfile;                
    }

    _runQuery() {

    }


    /**
     * Runs the actual command.
     * 
     * 
     * @memberOf AggregateReporter
     */
    run() {

    }
}

/**
 * Returns a list of indexes used by an alias
 * @param {[type]} program an instance of a commander program.
 */
function Aggregate2CSV(program) {



    program
        .option(
            '-s --server <server>',
            'The elasticsearch server to connect to. (default: elasticsearch)',
            'elasticsearch'
        )
        .option(
            '-p --port <port>',
            'The elasticsearch node port to connect to. (default: 9200)',
            function(val, def) {

                var parsed = parseInt(val);

                if (isNaN(parsed)) {
                    console.log("The port must be a valid number");
                    process.exit(100);
                }

                return parsed;
            },
            9200
        )
        .option(
            '-q --query <query>',
            'The query name of the elasticsearch query',
            'no_query'
        )        
        .command('aggregate2csv <outputpath>')
        .version('0.0.0')
        .description(' \
            IGNORE THIS: Returns a list of indexes used by an alias.  Returns 0 if successful (even if there are no indexes), \
            returns -1 if the alias does not exist, and non-zero if errors occurred. \
        ')
        .action((outputfile, cmd) => {

            if (!outputfile || outputfile != "" )


            //Add Verbose Check
            if (cmd.parent.verbose) {
                console.log("Output Path: " + outputfile);
                console.log("Server: " + cmd.server);
                console.log("Port: " + cmd.port);
                console.log("Query Name: " + cmd.query);            
            }

            var commandInstance = AggregateReporter( {
                "server"     : cmd.server, 
                "port"       : cmd.port, 
                "query"        : cmd.query, 
                "outputfile" : outputfile
            });

            commandInstance.run();
        });
        
}
