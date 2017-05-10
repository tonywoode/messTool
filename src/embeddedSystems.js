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
    , `Hewlett Packard HP48S`, `Hewlett Packard HP49G`, `HP 64000`, `Ideal Electronic Detective`, `Intel iPB`, `Intel MCS BASIC 31`, `Intel MCS BASIC 52`, `Intel SDK-85`, `Intel SDK-86`
    , `Intelbras TI630 telephone`, `JT Hyan Savia 84`, `Kosmos Astro`, `Kun-Szabo Marton Homebrew Z80 Computer`, `Manfred Kramer Kramer MC`, `Microsystems International Ltd MOD-8`
    , `Mikrolab KR580IK80`, `Mr Takafumi Aihara Babbage-2nd`, `Nippon Electronic Company TK-80`, `Nippon Electronic Company TK-85`, `Ocean-240 Test Rom`, `Omnibyte OB68K1A`
    , `PEL Varazdin Galeb`, `Philips P2000M`, `Philips P2000T`, `Practice-z80`, `SacState 8008`, `SCCH LLC-2`, `Science of Cambridge MK-14`, `Seattle Computer SCP-300F`
    , `SEL Z80 Trainer`, `Sharp Pocket Computer 1250`, `Sharp Pocket Computer 1251`, `Sharp Pocket Computer 1255`, `Sharp Pocket Computer 1350`, `Sharp Pocket Computer 1401`
    , `Sharp Pocket Computer 1402`, `Southwest Technical Products Corporation SWTPC 6800`, `Synertek Systems Corp. SYM-1/SY-VIM-1`, `T400 uController project T410 test suite`
    , `T400 uController project T420 test suite`, `Talking Electronics magazine TEC-1`, `Tandy Radio Shack TRS-80 Pocket Computer PC-3`, `Tecnbras Dot Matrix Display (70x7 pixels)`
    , `Tesla PMI-80`, `Tesla SAPI-1 ZPS 1`, `Tesla SAPI-1 ZPS 2`, `Texas Instruments Little Professor (1976 version)`, `Texas Instruments Little Professor (1978 version)`
    , `Texas Instruments SR-16`, `Texas Instruments SR-16 II`, `Texas Instruments TI Business Analyst-I`, `Texas Instruments TI Programmer`, `Texas Instruments TI-1000`
    , `Texas Instruments TI-1270`, `Texas Instruments TI-30`, `Texas Instruments TI-73`, `Texas Instruments TI-81`, `Texas Instruments TI-81 v2.0`, `Texas Instruments TI-82`
    , `Texas Instruments TI-83`, `Texas Instruments TI-83 Plus`, `Texas Instruments TI-83 Plus Silver Edition`, `Texas Instruments TI-84 Plus`, `Texas Instruments TI-84 Plus Silver Edition`
    , `Texas Instruments TI-89`, `Texas Instruments TI-89 Titanium`, `Texas Instruments TI-92`, `Texas Instruments TI-92 Plus`, `Texas Instruments Voyage 200 PLT`, `Texas Instruments Wiz-A-Tron`
    , `U.S. Robotics Palm Pilot Personal`, `U.S. Robotics Palm Pilot Pro`, `U.S. Robotics Pilot 1000`, `U.S. Robotics Pilot 5000`, `VEB Gera MC-80.21/22`, `VEB Mikroelektronik Erfurt Schachcomputer SC2`
    , `Weinrich 4004 Nixie Clock`, `Wichit Sirichote 68k Single Board Computer`, `Z80 dev board`
  ]

  const isItBoring = obj => { 
    const name = obj.company? `${obj.company} ${obj.system}`: `${obj.system}`
    return boringSystems.includes(name) 
  }
  const systemsWithGames = R.reject(obj => isItBoring(obj), systems)

  return systemsWithGames
}


function printARomdata(systems) {
  const romdataHeader = `ROM DataFile Version : 1.1`
  const path = `./qp.exe` 
  const mameRomdataLine = ({name, MAMEName, parentName, path, company, year, comment}) =>
    ( `${name}¬${MAMEName}¬${parentName}¬¬${path}¬Mame64 Win32¬${company}¬${year}¬¬¬¬¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬` )

  //this is the correct invocation for retroarch but it doesn't work, even with softlist automedia off and bios anable on
  // retroarch_debug shows it even finds the game, but then decides: 'Error: unknown option: sfach'
  const retroarchRomdataLine = ({name, MAMEName, parentName, path, company, year, comment}) =>
    ( `${name}¬${MAMEName}¬${parentName}¬¬${path}¬Retroarch Frontend¬${company}¬${year}¬¬¬¬-L cores\\mame_libretro.dll " ${MAMEName.replace(/"/g, '\\"')}"¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬` )
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
  const mameSoftRoot = `outputs/mame_softlists/`
  const mameOut = `${mameSoftRoot}/MESS Embedded Systems/`
  //const retroarchOut = `outputs/retroarch_embedded/` - not working in retroarch at this time
  mkdirp.sync(mameOut)
  //mkdirp.sync(retroarchOut)

  const iconTemplate = `[GoodMerge]
GoodMergeExclamationRoms=0
GoodMergeCompat=0
pref1=(U) 
pref2=(E) 
pref3=(J) 

[Mirror]
ChkMirror=0
TxtDir=
LstFilter=2A2E7A69700D0A2A2E7261720D0A2A2E6163650D0A2A2E377A0D0A

[RealIcon]
ChkRealIcons=1
ChkLargeIcons=1
Directory=F:\\MAME\\EXTRAs\\icons

[BkGround]
ChkBk=0
TxtBKPath=

[Icon]
ChkIcon=1
CmbIcon=mess.ico
`

  fs.writeFileSync(mameOut + `folders.ini`, iconTemplate)
  fs.writeFileSync(mameOut + `romdata.dat`, mameRomdataToPrint.join(`\n`), `latin1`) //utf8 isn't possible at this time
  //fs.writeFileSync(retroarchOut + `romdata.dat`, retroarchRomdataToPrint.join(`\n`), `latin1`) //not working in retroarch
  
  return systems

}
