"use strict"

const fs             = require('fs')
const readline       = require('readline')
const R              = require('ramda')
const XmlStream      = require(`xml-stream`)
const makeSystems    = require('./src/datAndEfind/readMameXML.js')
const cleanSoftlists = require('./src/datAndEfind/cleanSoftlists.js')
const cleanDevices   = require('./src/datAndEfind/cleanDevices.js')
const mungeCompanyAndSytemsNames = require('./src/datAndEfind/mungeCompanyAndSystemNames.js')
const mungeCompanyForType  = require('./src/datAndEfind/mungeCompanyForType.js')
const makeFinalSystemTypes = require('./src/datAndEfind/makeFinalSystemType.js')
const removeBoringSystems  = require('./src/datAndEfind/removeBoringSystems.js')
const print                = require('./src/datAndEfind/print.js')
const printSysdatAndJson   = require('./src/datAndEfind/printSysdatAndJson.js')


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
makeSystems( xml, systems => {

  R.pipe(
     cleanSoftlists
  ,  cleanDevices
  ,  mungeCompanyAndSytemsNames
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


