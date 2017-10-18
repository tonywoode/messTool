"use strict"

const fs                   = require('fs')
const R                    = require('ramda')

const callSheet            = require('./src/romdataMaker/callsheet.js')
const filterSoftlists      = require('./src/romdataMaker/filterSoftlists.js')
const chooseDefaultEmus    = require('./src/romdataMaker/chooseDefaultEmus.js')
const makeParams           = require('./src/romdataMaker/makeSoftlists/makeParams.js')
const readSoftlistXML      = require('./src/romdataMaker/makeSoftlists/readSoftlistXML.js')
const cleanSoftlist        = require('./src/romdataMaker/makeSoftlists/cleanSoftlist.js')
const {setRegionalEmu}     = require('./src/romdataMaker/makeSoftlists/setRegionalEmu.js')
const printSoftlistRomdata = require('./src/romdataMaker/makeSoftlists/printSoftlistRomdata.js')

const hashDir           = `inputs/hash/`
  , outputDir           = `outputs/`
  , systemsJsonFile     = fs.readFileSync(`${outputDir}systems.json`)
  , systems             = JSON.parse(systemsJsonFile)
  //TODO - you can append the DTD at the top of the file if it isn't being read correctly

  //decide what we want to print to console
  , logGames          = false
  , logChoices        = false
  , logRegions        = false
  , logExclusions     = false
  , logPrinter        = false

//program flow at list level
R.pipe(
    callSheet(logExclusions)
  , filterSoftlists(hashDir)
  , chooseDefaultEmus(logChoices)
  , makeSoftlists 
)(systems)

//program flow at emu level
function makeSoftlists(emuSystems) {
  R.map(emu => {
        const softlistParams = makeParams(hashDir, outputDir, emu)
        readSoftlistXML(softlistParams.xml, softlist => {
          const cleanedSoftlist = cleanSoftlist(softlist)
          printSoftlistRomdata(logGames, logExclusions, logRegions, logPrinter, softlistParams, setRegionalEmu, cleanedSoftlist)
        })
      }, emuSystems)
}

