'use strict'

const fs             = require('fs')
const R              = require('ramda')
const XmlStream      = require('xml-stream')
const program        = require('commander')

//cmd-line options as parsed by commander
program
    .option('--output-dir [path]')
    .option(`--scan`)
    .option(`--softlists`)
    .option(`--embedded`)
    .option(`--dev`)
    .parse(process.argv)


if (!process.argv.slice(2).length) {
  console.log( 
`MESSTOOL USAGE: 
'QPNode-mess --scan' makes a mess Json, an efind set and a systems dat
'QPNode-mess --softlists' makes a softlist set
'QPNode-mess --embedded' makes the embedded mess romdata for mame
`)
  process.exit()
}

//JSON, DAT AND EFIND MAKER
const scan = () => {
  const {
      readMameXML
    , cleanSoftlists
    , cleanDevices
    , mungeCompanyAndSystemNames
    , mungeCompanyForType
    , makeFinalSystemTypes
    , removeBoringSystems
    , print
    , printSysdatAndJson
  }                    = require('./datAndEfind')
  
  const 
      datInPath        = `inputs/systems.dat`
    , datInStream      = fs.createReadStream(datInPath)
    , mameXMLInPath    = `inputs/mame.xml`
    , stream           = fs.createReadStream(mameXMLInPath)
    , xml              = new XmlStream(stream)
    , mameIniOutPath   = `outputs/Mess_Mame.ini`
    , rarchIniOutPath  = `outputs/Mess_Retroarch.ini`
    , datOutPath       = `outputs/systems.dat`
    , jsonOutPath      = `outputs/systems.json`
  
  //set simple console logging
  const
      logIni  = false
    , logDat  = false
    , logJSON = false
  
  //program flow
  readMameXML( xml, systems => {
  
    R.pipe(
       cleanSoftlists
    ,  cleanDevices
    ,  mungeCompanyAndSystemNames
    ,  mungeCompanyForType
    ,  makeFinalSystemTypes
    ,  removeBoringSystems
    ,  print(mameIniOutPath, rarchIniOutPath, logIni)
    ,  printSysdatAndJson(logDat, logJSON, datInStream, datOutPath, jsonOutPath)
    )(systems)
  
  })
  
  
  function mockSystems(jsonOutPath, callback) {
    const input   = fs.readFileSync(jsonOutPath)
        , systems = JSON.parse(input)
    
    callback(systems, callback)
  }

}


//ROMDATA MAKER
const softlists = () => {
  const {
      callSheet
    , filterSoftlists
    , chooseDefaultEmus
    , makeParams
    , readSoftlistXML
    , cleanSoftlist
    , setRegionalEmu
    , printSoftlistRomdata
  }                   = require('./softlists')
  
  const hashDir       = `inputs/hash/`
    , outputDir       = `outputs/`
    , systemsJsonFile = fs.readFileSync(`${outputDir}systems.json`)
    , systems         = JSON.parse(systemsJsonFile)
    //TODO - you can append the DTD at the top of the file if it isn't being read correctly
  
    //decide what we want to print to console
    , logGames        = false
    , logChoices      = false
    , logRegions      = false
    , logExclusions   = false
    , logPrinter      = false
  
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

}


//EMBEDDED SYSTEMS
/* here we pair down the imp elsewhere to print us a set of embedded systems in mess
 * its important to note that this is only possible atm because there is still a standalone
 * mess executable you can ask to --listdevices. The mess team say that there won't be
 * this standalone exe in the future. If that comes to pass, they need a 'isMess' key. 
 * This class uses the mecahanics of the other classes in this module, but has a far
 * narrower scope, its an afterthought */

const embedded = () => {
  const {
      readMameXMLembedded
    , mungeCompanyAndSystemNamesEmbedded
    , removeBoringSystemsEmbedded
    , printRomdata 
  }                 = require('./embeddedSystems')
  
  const 
      mameXMLInPathEmbedded = `inputs/mess.xml`
    , streamEmbedded        = fs.createReadStream(mameXMLInPathEmbedded)
    , xmlEmbedded           = new XmlStream(streamEmbedded)
  
  //program flow
  readMameXMLembedded( xmlEmbedded, systems => {
    R.pipe(
       mungeCompanyAndSystemNamesEmbedded
     , removeBoringSystemsEmbedded
     , printRomdata
    )(systems)
  })

}


program.scan      && scan()
program.softlists && softlists()
program.embedded  && embedded()
