/* 
    Aggregate2CSV commander component to take an Aggregate Query and turn it into a CSV file.
 */
'use strict';

//This exposes the command for use by autocmd.
module.exports = Aggregate2CSV;


// Load any required modules
const elasticsearch = require('elasticsearch');
const path = require('path');

const colors = require('colors');


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
        this.outputfile = config.outputfile;
        this.client = new elasticsearch.Client(
            {
                host: config.server + ":" + config.port,
                log: 'info', //Logging level for ES.
                apiVersion: "2.3"
            }
        );



        let queryClassPath = path.join(__dirname, '..', 'queries', config.query);
        queryClassPath = path.normalize(queryClassPath);

        try{ 
            //This should load something that extends BaseAggQuery
            let queryClass = require(queryClassPath);
            
            this.query = new queryClass(this.index, this.client, this.outputfile);
        } catch (err) {
            throw new Error(`Error loading query: ${queryClassPath}`);            
        }
        
        
    }


    run(done) {        
        this.query.run(done);
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
            '-i --index <index>',
            'The index to use',
            'no_index'
        )        
        .option(
            '-o --output <output>',
            'The output file, otherwise console will be used',
            'no_output'
        )        

        .command('aggregate2csv <query>')
        .version('0.0.0')
        .description(' \
            IGNORE THIS: Returns a list of indexes used by an alias.  Returns 0 if successful (even if there are no indexes), \
            returns -1 if the alias does not exist, and non-zero if errors occurred. \
        ')
        .action((query, cmd) => {

            if (
                (!cmd.parent.server || cmd.parent.server == "" ) ||
                (!cmd.parent.port || cmd.parent.port == "" ) || 
                (!cmd.parent.index || cmd.parent.index == "" )
            ) {
                console.error(colors.red('Invalid server, port or index'));
                program.help();
            }

            if (cmd.parent.index == "no_index") {
                console.error(colors.red('You must specify an ES index!'));
                program.help();
            }

            if (cmd.parent.output == "no_output") {
                console.error(colors.red('You must specify an output file!'));
                program.help();
            }

            //Add Verbose Check
            if (cmd.parent.verbose) {
                console.log("Output Path: " + cmd.parent.output);
                console.log("Server: " + cmd.parent.server);
                console.log("Port: " + cmd.parent.port);
                console.log("Index: " + cmd.parent.index);
                console.log("Query Name: " + query);      
            }

            var commandInstance = false;

            try {
                commandInstance = new AggregateReporter( {
                    "server"     : cmd.parent.server, 
                    "port"       : cmd.parent.port, 
                    "query"      : query, 
                    "index"      : cmd.parent.index,
                    "outputfile" : cmd.parent.output
                });
            } catch (err) {
                console.error(colors.red("Could not create instance of reporter:"));
                console.error(colors.red(`\t${err.message}`));
                console.error(colors.red("Exiting..."));
                process.exit(1);
            }

            try {
                commandInstance.run((err, res) => {
                    if (err) {
                        throw err;
                    }

                    //Handle whatever with res.

                    //Exit
                    console.log("Finished.  Exiting...")
                    process.exit(0);
                });
            } catch (err) {
                console.error(colors.red(err.message));
                console.error(colors.red("Errors occurred.  Exiting"));
                process.exit(1);
            }
        });
        
}
