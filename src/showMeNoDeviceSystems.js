"use strict"


//here we pair down the imp elsewhere to print us a set of embedded systems in mess
//its important to note that this is only possible atm because there is still a standalone
//mess executable you can ask to --listdevices. The mess team say that there won't be
//this standalone exe in the future. If that comes to pass, they need a 'isMess' key
const 
    fs            = require(`fs`)
  , readline      = require('readline')
  , XmlStream     = require(`xml-stream`)
  , R             = require(`Ramda`)

const 
    mameXMLInPath    = `inputs/mess.xml`
  , stream           = fs.createReadStream(mameXMLInPath)
  , xml              = new XmlStream(stream)
  , spaceIsSeparator = ` `
  , oneWord = 1

//program flow
makeSystems(function(systems){
  R.pipe(
     mungeCompanyAndSystemNames
   , printEfind
  )(systems)
})


function makeSystems(callback){
  const systems = []
  
  xml.collect('device')
  xml.on(`updateElement: machine`, function(machine) {
    if ( 
         !machine.device 
      && machine.$.isdevice === `no` 
      && machine.$.isbios === `no` 
      && machine.$.ismechanical === `no`
      && machine.$.runnable === `yes`
      && !machine.input.$.coins
      //&& machine.driver.$.status === `good` //I think this is some kind of intersection of the some or all of the below
      && machine.driver.$.emulation === `good`
      //&& machine.driver.$.color === `good`
      //&& machine.driver.$.sound === `good`
      //&& machine.driver.$.graphic === `good` 
    ) {
      const node = {}
      node.company = machine.manufacturer
      node.system = machine.description 
      node.call = machine.$.name
      node.cloneof = machine.$.cloneof
      node.softlist = machine.softwarelist
      node.device = machine.device
      systems.push(node)
    }
  })

  xml.on(`end`, function(){
    callback(systems)
  })

}

function mungeCompanyAndSystemNames(systems){
   //These are the main replacement functions to munge MESS' company name and system name
  const compRep = (oldCompany, newCompany) => R.map( 
    obj => R.assoc(`company`, obj.company.replace(oldCompany, newCompany), obj) 
  )

  //we match the company too when replacing the systeem name
  const systRep = (thisCompany, oldsystem, newsystem) => R.map( 
    obj => R.assoc(`system`, (obj.company.match(thisCompany) && obj.system.match(oldsystem))? 
      newsystem : obj.system, obj
    )
  )

 //transforms  
  const mungedSystems = R.pipe(

      compRep(/(<unknown>|<generic>)/, ``)
      //system specific (btw replace accepts regex or string by default (i'm trying to show what's intended), but match matches only regex
    , systRep(`Acorn`, /BBC/, `BBC`), systRep(`Acorn`, /Electron/, `Atom`)
    , compRep(`Hegener & Glaser Muenchen`, `Hegener & Glaser`)
    , compRep(`John L.Weinrich`, `Weinrich`)
    , compRep(`JAKKS Pacific Inc / HotGen Ltd `, `JAKKS / Hotgen`)
    , compRep(`Commodore Business Machines`, `Commodore`)
    , compRep(`Elector Electronics`, `Elektor`)
    , compRep(`APF Electronics Inc.`, `APF`)
    , compRep(`VEB Elektronik`, `VEB`)
    , compRep(`San Bergmans & Izabella Malcolm`, `Bergmans & Malcolm`)
    )(systems)

  return mungedSystems
}

function printEfind(systems){

 const mameEfindTemplate = ({topLine, systemType, callToMake, info}) =>
    (`[MAME ${topLine}]
Exe Name=mame64.exe
Config Name=mame
System=${systemType} 
HomePage=${info}
param=${callToMake}
isWin32=1
CmdLine=1
ShellEx=0
Verify=0
ShortExe=0
DisWinKey=1
DisScrSvr=1
Compression=2E7A69703D300D0A2E7261723D300D0A2E6163653D300D0A2E377A3D300D0A
`)

  const retroarchEfindTemplate = ({topLine, systemType, callToMake, info}) =>
    (`[Retroarch ${topLine} (MAME)]
Exe Name=retroarch.exe
Config Name=retroarch
System=${systemType} 
HomePage=${info}
param=-L cores\\mame_libretro.dll " ${callToMake.replace(/"/g, '\\"')}"
isWin32=1
CmdLine=1
ShellEx=0
Verify=0
ShortExe=0
DisWinKey=1
DisScrSvr=1
Compression=2E7A69703D300D0A2E7261723D300D0A2E6163653D300D0A2E377A3D300D0A
`)


  const systemToPrint = obj => R.map(obj => {
    const emulatorName = obj.company? `${obj.company} ${obj.system}`: `${obj.system}`
    const params = {
        topLine    : emulatorName
      , systemType : `MESS Embedded Games`
      , callToMake : `${obj.call}` 
      , info       : obj.cloneof? `clone of ${obj.cloneof}` : `http://mameworld.info` 
    }
     
    mameDevices.push(mameEfindTemplate(params))
    retroarchDevices.push(retroarchEfindTemplate(params))
  }, systems)
   
  const mameDevices = [] //this is an accumlator, we need to reduce....
  const retroarchDevices = [] //this is an accumlator, we need to reduce....
  
  const efinderToPrint = systemToPrint(systems)
 
  const joinedMameDevices = mameDevices.join(`\n`)
  const joinedRetroarchDevices = retroarchDevices.join(`\n`)
  fs.writeFileSync(`outputs/MESS_MAME_embedded.ini`, joinedMameDevices, `latin1`) //utf8 isn't possible at this time
  fs.writeFileSync(`outputs/MESS_RetroArch_embedded.ini`, joinedRetroarchDevices, `latin1`) //utf8 isn't possible at this time
  fs.writeFileSync(`outputs/MESSembedded.json`, JSON.stringify(systems, null, '\t')) 
 

}


