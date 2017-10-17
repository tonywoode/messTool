"use strict"

const fs             = require('fs')
const readline       = require('readline')
const R              = require('ramda')
const XmlStream      = require(`xml-stream`)
const makeSystems    = require('./src/readMameXML.js')
const cleanSoftlists = require('./src/cleanSoftlists.js')
const cleanDevices   = require('./src/cleanDevices.js')
const mungeCompanyAndSytemsNames = require('./src/mungeCompanyAndSystemNames.js')
const mungeCompanyForType = require('./src/mungeCompanyForType.js')
const makeFinalSystemTypes = require('./src/makeFinalSystemType.js')
const removeBoringSystems = require('./src/removeBoringSystems.js')
const print = require('./src/print.js')



const 
    datInPath        = `inputs/systems.dat`
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

/* get the existing list of QuickPlay's system types into an array
 * (we are amending an existing list, not replacing it. MAME doesn't
 * cover modern consoles for instance */
const currentTypeList = []
const rl = readline.createInterface({ input: fs.createReadStream(datInPath) })
rl.on( 'line', (line) => currentTypeList.push(line) )

//program flow
makeSystems(  xml, systems => {

  R.pipe(
     cleanSoftlists
  ,  cleanDevices
  ,  mungeCompanyAndSytemsNames
  ,  mungeCompanyForType
  ,  makeFinalSystemTypes
  ,  removeBoringSystems
  ,  print(mameIniOutPath, rarchIniOutPath, logIni, madeDat)
  )(systems)

})


function mockSystems(callback) {
  const input   = fs.readFileSync(`inputs/systems.json`)
      , systems = JSON.parse(input)
  
  callback(systems, callback)
}


/* Now the ini is out, print out a systems list and the json that the softlist maker will use */
function madeDat(systems) {

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
  //})

  //print out the json we made, romdatamaker.js uses it
  const pretty = JSON.stringify(systems, null, `\t`)
  console.log(`Printing systems JSON to ${jsonOutPath}`)
  if (logJSON) console.log(pretty)
  fs.writeFileSync(jsonOutPath, pretty)
  console.log(`done`)
  process.exit()
}

