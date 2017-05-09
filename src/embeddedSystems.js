"use strict"


//here we pair down the imp elsewhere to print us a set of embedded systems in mess
//its important to note that this is only possible atm because there is still a standalone
//mess executable you can ask to --listdevices. The mess team say that there won't be
//this standalone exe in the future. If that comes to pass, they need a 'isMess' key
const 
    fs            = require(`fs`)
  , XmlStream     = require(`xml-stream`)
  , R             = require(`Ramda`)
  , mkdirp        = require('mkdirp')

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
   , removeBoringSystems
   , printARomdata
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

  //the first two of these regexs are unique to this script. That's because, to describe a generic 
  //'space invaders' hardware,  it seems you have no option but to get company name in there
  const systemsAugmented = R.pipe(
      R.map(obj => R.assoc(`system`, obj.system.replace(
          new RegExp(`\\W\\(` + obj.company.split(spaceIsSeparator, oneWord) + `\\)`, `i`), ``
        ), obj //`Casio Game (Casio)` -> `Casio Game` 
      ))
    , R.map(obj => R.assoc(`system`, obj.system.replace(
          new RegExp(obj.company.split(spaceIsSeparator, oneWord) + `\\W` + `\\s`, `i`), ``
        ), obj  //`Casio Game (Casio, v12)` -> `Casio Game`
      )) 
    , R.map(obj => R.assoc(`system`, obj.system.replace(
          new RegExp(obj.company.split(spaceIsSeparator, oneWord) + `\\W`, `i`), ``
        ), obj // `Casio Casio Mk3` ->`Casio Mk3g`
      )) 
  )(systems)



  const compRep = (oldCompany, newCompany) => R.map( 
    obj => R.assoc(`company`, obj.company.replace(oldCompany, newCompany), obj) 
  )

  const systRep = (thisCompany, oldsystem, newsystem) => R.map( 
    obj => R.assoc(`system`, (obj.company.match(thisCompany) && obj.system.match(oldsystem))? 
      newsystem : obj.system, obj
    )
  )

 //transforms  
  const mungedSystems = R.pipe(

      compRep(/(<unknown>|<generic>)/, ``)
    , systRep(`Acorn`, /BBC/, `BBC`), systRep(`Acorn`, /Electron/, `Atom`)
    , compRep(`Hegener & Glaser Muenchen`, `Hegener & Glaser`)
    , compRep(`John L. Weinrich`, `Weinrich`)
    , compRep(`JAKKS Pacific Inc / HotGen Ltd`, `JAKKS / Hotgen`)
    , compRep(`Commodore Business Machines`, `Commodore`)
    , compRep(`Elector Electronics`, `Elektor`)
    , compRep(`APF Electronics Inc.`, `APF`)
    , compRep(`VEB Elektronik`, `VEB`)
    , compRep(`San Bergmans & Izabella Malcolm`, `Bergmans & Malcolm`)
    )(systemsAugmented)

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
 
return systems
}

function removeBoringSystems(systems){

  const boringSystems =[
     `3Com Palm III`, `A.S.E.L. Amico 2000`, `APF Mathemagician`, `BeeHive DM3270`, `Bergmans & Malcolm Sitcom`, `California Computer Systems CCS Model 2810 CPU card`
    , `Chaos 2`, `Chunichi ND-80Z`, `CM-1800`, `Commodore LCD (Prototype)`, `DAG Z80 Trainer`, `Digital Microsystems ZSBC-3`, `Digital Research Computers ZRT-80`
    , `Dr. Dieter Scheuschner SLC-1`, `E&L Instruments Inc MMD-1`, `E&L Instruments Inc MMD-2`, `Eckhard Schiller VCS-80`, `Electronics Australia EA Car Computer`
    , `Elektor Electronics Junior Computer`, `Elektor Electronics SC/MP`, `Frank Cringle & MESSDEV ZEXALL Z80 instruction set exerciser (modified for MESS)`
    , `Heath Inc Heathkit ET-3400`, `Hegener & Glaser Mephisto Alimera 68020`, `Hegener & Glaser Mephisto Alimera 68000`, `Hegener & Glaser Mephisto Berlin Pro 68020`
    , `Hegener & Glaser Mephisto Berlin Pro London Upgrade V5.00`, `Hegener & Glaser Mephisto Genius030 London Upgrade V5.00`, `Hegener & Glaser Mephisto Genius030 V4.00`
    , `Hegener & Glaser Mephisto Genius030 V4.01`, `Hegener & Glaser Mephisto Genius030 V4.01OC`, `Hegener & Glaser Mephisto London 68020 32 Bit`, `Hegener & Glaser Mephisto Lyon 68000`
    , `Hegener & Glaser Mephisto Lyon 68020`, `Hegener & Glaser Mephisto Milano Schachcomputer`, `Hegener & Glaser Mephisto Polgar Schachcomputer`, `Hegener & Glaser Mephisto Vancouver 68000`
    , `Hegener & Glaser Mephisto Vancouver 68020`, `Henry Colford P.I.M.P.S.`, `HENRY Prot I v19 (REV.1)`, `Hewlett Packard HP38G`, `Hewlett Packard HP48G`, `Hewlett Packard HP48G+`
    , `Hewlett Packard HP48S`, `Hewlett Packard HP49G`
  ]

  const isItBoring = name => { 
    return boringSystems.includes(name) 
  }
  const name = obj.company? `${obj.company} ${obj.system}`: `${obj.system}`
  const systemsWithGames = R.reject(obj => isItBoring(name), systems)

  return systemsWithGames
}


function printARomdata(systems) {
  const romdataHeader = `ROM DataFile Version : 1.1`
  const path = `./qp.exe` 
  const mameRomdataLine = ({name, MAMEName, parentName, path, emu, company, year, comment}) =>
    ( `${name}¬${MAMEName}¬${parentName}¬¬${path}¬MAME ${emu}¬${company}¬${year}¬¬¬¬${MAMEName}¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬` )

  const retroarchRomdataLine = ({name, MAMEName, parentName, path, emu, company, year, comment}) =>
    ( `${name}¬${MAMEName}¬${parentName}¬¬${path}¬Retroarch ${emu} (MAME)¬${company}¬${year}¬¬¬¬${MAMEName}¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬` )
  /*  1)  Display name, 2) _MAMEName, 3) _ParentName, 4) _ZipName, //Used Internally to store which file inside a zip file is the ROM
   *  5) _rom path //the path to the rom, 6) _emulator,7) _Company, 8) _Year, 9) _GameType, 10) _MultiPlayer, 11)  _Language
   * 12)  _Parameters : String, 13)  _Comment, 14)  _ParamMode : TROMParametersMode; //type of parameter mode
   * 15)  _Rating, 16)  _NumPlay, 17)  IPS start, 18)  IPS end, 19)  _DefaultGoodMerge : String; //The user selected default GoodMerge ROM */

  const applyRomdata = platform => R.map( obj => {
        const romParams = {
        name : obj.company? `${obj.company} ${obj.system}`: `${obj.system}`
      , MAMEName : obj.call
      , parentName : obj.cloneof?  obj.cloneof : ``
      , path : path
      , emu : `MESS`
      , company : obj.company
      , year : `unknown`
      , comment : obj.cloneof? `clone of ${obj.cloneof}` : `` 
    }

    if (platform==="mame") return mameRomdataLine(romParams)
    if (platform==="retroarch") return retroarchRomdataLine(romParams)

  }, systems)

  const mameRomdata = applyRomdata("mame")
  const retroarchRomdata = applyRomdata("retroarch")
  const mameRomdataToPrint = R.prepend(romdataHeader, mameRomdata) 
  const retroarchRomdataToPrint = R.prepend(romdataHeader, retroarchRomdata) 
  const mameOut = `outputs/mame_embedded/`
  const retroarchOut = `outputs/retroarch_embedded/`
  mkdirp.sync(mameOut)
  mkdirp.sync(retroarchOut)
  fs.writeFileSync(mameOut + `romdata.dat`, mameRomdataToPrint.join(`\n`), `latin1`) //utf8 isn't possible at this time
  fs.writeFileSync(retroarchOut + `romdata.dat`, retroarchRomdataToPrint.join(`\n`), `latin1`) //utf8 isn't possible at this time
  
  return systems

}
