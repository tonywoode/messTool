"use strict"

/* here we pair down the imp elsewhere to print us a set of embedded systems in mess
 * its important to note that this is only possible atm because there is still a standalone
 * mess executable you can ask to --listdevices. The mess team say that there won't be
 * this standalone exe in the future. If that comes to pass, they need a 'isMess' key. 
 * This class uses the mecahanics of the other classes in this module, but has a far
 * narrower scope, its an afterthought */
const 
    fs            = require('fs')
  , XmlStream     = require('xml-stream')
  , R             = require('ramda')

const makeSystems = require('./src/embeddedSystems/readMameXML.js')
const mungeCompanyAndSystemNames = require('./src/embeddedSystems/mungeCompanyAndSystemNames.js')
const removeBoringSystems = require('./src/embeddedSystems/removeBoringSystems.js')
const printRomdata = require('./src/embeddedSystems/printRomdata.js')

const 
    mameXMLInPath    = `inputs/mess.xml`
  , stream           = fs.createReadStream(mameXMLInPath)
  , xml              = new XmlStream(stream)

//program flow
makeSystems( xml, systems => {
  R.pipe(
     mungeCompanyAndSystemNames
   , removeBoringSystems
   , printRomdata
  )(systems)
})

