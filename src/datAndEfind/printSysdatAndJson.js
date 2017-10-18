'use strict'

const fs             = require('fs')
const readline       = require('readline')
const R              = require('ramda')

/* Now the ini is out, print out a systems list and the json that the softlist maker will use */
module.exports = (logDat, logJSON, datInStream, datOutPath, jsonOutPath) => systems => {

  /* get the existing list of QuickPlay's system types into an array
   * (we are amending an existing list, not replacing it. MAME doesn't
   * cover modern consoles for instance */
  const currentTypeList = []
  const rl = readline.createInterface({ input: datInStream})
  rl.on( 'line', (line) => currentTypeList.push(line) )
  rl.on( 'close', () => { //todo: promisify

    const lister =  R.pipe(
        R.map( ({ systemType }) => (`${systemType}`) )
      , R.uniq
    )(systems)
  
    const ordered = lister.sort( (a, b) => a.localeCompare(b) )
  
    //make the union dat of the old quickplay and the new systems dat
    const unionDat        = R.union(currentTypeList, ordered)
    const orderedUnionDat = unionDat.sort( (a, b) => a.localeCompare(b) )
    const joinedUnionDat  = orderedUnionDat.join(`\n`) 
   
    console.log(`Printing systems dat to ${datOutPath}`)
    if (logDat) console.log(joinedUnionDat)
    fs.writeFileSync(datOutPath, joinedUnionDat, `latin1`)  //utf8 isn't possible at this time
  
    //print out the json we made, romdatamaker.js uses it
    const pretty = JSON.stringify(systems, null, `\t`)
    console.log(`Printing systems JSON to ${jsonOutPath}`)
    if (logJSON) console.log(pretty)
    fs.writeFileSync(jsonOutPath, pretty)
    console.log(`done`)
    process.exit()
  })
}
