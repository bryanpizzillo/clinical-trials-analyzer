/* 
    Aggregate2CSV commander component to take an Aggregate Query and turn it into a CSV file.
 */
'use strict';

const XLSX = require('xlsx');

/**
 * Represents a workbook for Aggregations
 * (This is actually kind of generic, so it *could* be used for other purposes)
 * 
 * @class AggregateWorkBook
 */
class AggregateWorkBook {

    /**
     * Creates an instance of AggregateWorkBook.
     * 
     * 
     * @memberOf AggregateWorkBook
     */
    constructor() {
        this.SheetNames = [];
        this.Sheets = {};
        this.SheetsInfo = {};

    }

    /**
     * Adds a sheet to this AggregateWorkBook
     * 
     * @param {any} sheetName The name of the sheet to add.
     * 
     * @memberOf AggregateWorkBook
     */
    addSheet(sheetName) {
        var sheet = {};
	    this.SheetNames.push(sheetName);
	    this.Sheets[sheetName] = sheet;
        // This will hold internal state information 
        this.SheetsInfo[sheetName] = {
            hasData: false,
            hasHeaders: true,
            numCols: 0,
            numRows: 0
        };

        //Initialize the range to an empty sheet.
        sheet['!ref'] = XLSX.utils.encode_range({
            s: { //First Cell in the range
                c: 0, 
                r: 0
            }, 
            e: { //Last Cell in the range
                c: 0, 
                r: 0
            }
	    }); 
    }

    /**
     * Adds a header row to the sheet with supplied column names.
     * (Note: only call this before modifying data, and only call it once)
     * 
     * @param {any} sheetName The name of the sheet to manipulate
     * @param {any} headersArr An array of column names
     * 
     * @memberOf AggregateWorkBook
     */
    addHeadersRow(sheetName, headersArr) {
        let sheet = this.Sheets[sheetName];

        if (sheet === false) {
            throw new Error(`Sheetname, ${sheetName}, cannot be found.`);
        }

        //TODO: Update this at some point to support this. 
        if (this.SheetsInfo.hasHeaders || this.SheetsInfo.hasData) {
            throw new Error("Implementation does not support modifying headers after data or headers have been added.");
        }

        for (let head_col=0; head_col < headersArr.length; head_col++) {
            var cell_addr = XLSX.utils.encode_cell({c:head_col,r:0});

            sheet[cell_addr] = {
                v: headersArr[head_col],
                t: 's'
            }
        }

        //Since this is the first row in the sheet, we know how many total columns
        this.SheetsInfo[sheetName].numCols = headersArr.length;
        this.SheetsInfo[sheetName].numRows++;
        this.SheetsInfo[sheetName].hasHeaders = true;

        this._updateSheetRange(sheetName);
    }

    /**
     * Adds a row of data to the sheet with the name sheetName
     * 
     * @param {any} sheetName The name of the sheet to modify
     * @param {any} row An array of the data cells for this row
     * 
     * @memberOf AggregateWorkBook
     */
    addRowToSheet(sheetName, row) {
        let sheet = this.Sheets[sheetName];

        if (sheet === false) {
            throw new Error(`Sheetname, ${sheetName}, cannot be found.`);
        }
        
        let hasCells = (
            this.SheetsInfo[sheetName].hasHeaders !== false ||
            this.SheetsInfo[sheetName].hasData !== false 
        ); 
        
        let currRowNum =  hasCells ? this.SheetsInfo[sheetName].numRows : 0;

        for (let field_col = 0; field_col < row.length; field_col++) {
            let cellID = XLSX.utils.encode_cell({
                    c: field_col, 
                    r: currRowNum
            });

            sheet[cellID] = {
                v: row[field_col],
                s: 's' //Should try other types in the future
            }
        }

        this.SheetsInfo[sheetName].numRows++;
        this.SheetsInfo[sheetName].hasData = true;

        this._updateSheetRange(sheetName);
    }

    /**
     * Writes this workbook out to a file.
     * 
     * @param {any} fileName
     * @param {any} done
     * 
     * @memberOf AggregateWorkBook
     */
    write(fileName, done) {
      	try {
		    XLSX.writeFile(this, fileName);
            done(false);
	    } catch (ex) {
		    done(ex);		
	    }
    }

    /**
     * INTERNAL: Updates the range of a given sheet based on its current state.
     * 
     * @param {any} sheetName The name of the sheet to update
     * 
     * @memberOf AggregateWorkBook
     */
    _updateSheetRange(sheetName) {

        let sheet = this.Sheets[sheetName];

        if (sheet === false) {
            throw new Error(`Sheetname, ${sheetName}, cannot be found.`);
        }

        //Initialize the range to an empty sheet.
        sheet['!ref'] = XLSX.utils.encode_range({
            s: { //First Cell in the range
                c: 0, 
                r: 0
            }, 
            e: { //Last Cell in the range
                c: this.SheetsInfo[sheetName].numCols, 
                r: this.SheetsInfo[sheetName].numRows
            }
	    });   
    }
}

//This exposes the command for use by autocmd.
module.exports = AggregateWorkBook;
