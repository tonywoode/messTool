'use strict'

const fs             = require('fs')
const R              = require('ramda')
const XmlStream      = require('xml-stream')
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
}                    = require('./src/datAndEfind')

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


