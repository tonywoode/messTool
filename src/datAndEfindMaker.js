"use strict"

const 
    fs            = require(`fs`)
  , readline      = require('readline')
  , XmlStream     = require(`xml-stream`)
  , R             = require(`ramda`)

const 
    datInPath        = `inputs/systems.dat`
  , mameXMLInPath    = `inputs/mame.xml`
  , stream           = fs.createReadStream(mameXMLInPath)
  , xml              = new XmlStream(stream)
  , mameIniOutPath   = `outputs/Mess_Mame.ini`
  , rarchIniOutPath  = `outputs/Mess_Retroarch.ini`
  , datOutPath       = `outputs/systems.dat`
  , jsonOutPath      = `outputs/systems.json`
  , spaceIsSeparator = ` `
  , oneWord          = 1

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
makeSystems( systems => {

  R.pipe(
     cleanSoftlists
  ,  cleanDevices
  ,  mungeCompanyAndSytemsNames
  ,  mungeCompanyForType
  ,  makeFinalSystemTypes
  ,  removeBoringSystems
  ,  print
  )(systems)

})


function mockSystems(callback) {
  const 
      input   = fs.readFileSync(`inputs/systems.json`)
   ,  systems = JSON.parse(input)
  
  callback(systems, callback)
}

//Parse the mame xml pulling out the fields we need but only from systems which actually work
function makeSystems(callback) {
  const systems = []
  
  //xml stream 'collects' these meaning it deals with repeating xml keys rather than overwriting each time
  xml.collect('device')
  xml.collect('softwarelist')
  xml.collect(`extension`) //turns out xml stream is just regexing these keys, so this is deeply-nested
  console.log(`Reading a very large xml file, patience...`) 
  xml.on(`updateElement: machine`, machine => {
    if ( //machine.softwarelist // we used to do this when doing retroarch, but it turned out life wasn't that simple after all....
         machine.device //this helps to narrow down on MESS machines vs Arcade games (lack of coin slots isn't quite enough, but this isn't enough either as many arcade machines had dvd drives)
      && machine.$.isdevice         === `no` //see the mame.exe (internal)  DTD which defaults to no: <!ATTLIST machine isdevice (yes|no) "no"> TODO: some home consoles didn't have devices...
      && machine.$.isbios           === `no` 
      && machine.$.ismechanical     === `no`
      && machine.$.runnable         === `yes`
      && !machine.input.$.coins
      //&& machine.driver.$.status  === `good` //I think this is some kind of intersection of the some or all of the below
      && machine.driver.$.emulation === `good`
      //&& machine.driver.$.color   === `good`
      //&& machine.driver.$.sound   === `good`
      //&& machine.driver.$.graphic === `good` //you want nes? don't turn this on....
    ) {
      const node    = {}
      node.company  = machine.manufacturer
      node.system   = machine.description 
      node.call     = machine.$.name
      node.cloneof  = machine.$.cloneof
      node.softlist = machine.softwarelist
      node.device   = machine.device
      systems.push(node)
    }
  })

  xml.on(`end`, () => {
    //fs.writeFileSync(`inputs/systems.json`, JSON.stringify(systems, null, `\t`)); process.exit()
    callback(systems)
  })

}


//I don't like working with a messy tree, lots of $ and needless repetition...
function cleanSoftlists(systems) {

  //I removed the destructuring elsewhere but here the object isn't going to grow
  const flattenSoftlist = softlist  => 
    R.map( ({ $ }) => 
     ( ({ name:$.name, status:$.status, filter:$.filter }) )
    , softlist )

  //if the system has a softlist, clear up its object: the thing we scraped wasn't nice
  const replaceIfSoftlist = R.map(obj => obj.softlist? 
    obj.softlist = R.assoc(`softlist`, flattenSoftlist(obj.softlist), obj) : obj
  , systems )

  return replaceIfSoftlist
}

function cleanDevices(systems) {
  //not all devices have media, so we must check for null. Time to introduce maybe
  const flattenExtensions = extensions => {
    if (extensions) return R.map(extension => extension.$.name, extensions)
    return null
  }

  //note applySpec is currying in the device object without. You might want to key these by 'name' - see applySpec doc
  const template = R.applySpec({
    type       : R.path(['$', 'type']),
    tag        : R.path(['$', 'tag']),
    name       : R.path(['instance', '$', 'name']),
    briefname  : R.path(['instance', '$', 'briefname']),
    extensions : R.pipe(R.prop('extension'), flattenExtensions )
  })

  //Note that we fundamentally scrape the MAME xml for things that have devices so we don't need to check if they have a device element again
  //systems list -> system object -> device in object - nested looping into the devices key of one of the system objects
  const replaceDevice = R.map(
    obj => R.assoc(`device`, R.map(
      template, obj.device) //(you can always replace device => template(device) with just template)
    , obj)
  , systems)

  const removeUninterestingDevices = R.map(
    obj => R.assoc(`device`, R.filter(
      device => 
           device.type !== "printer" 
        && device.type !== "midiout" 
        && device.type !== "midiin" 
        && device.type !== "serial"
      , obj.device)
    , obj)
  , replaceDevice)
  
  return removeUninterestingDevices 

}


/* we have multiple needs for company name:
 *  1) we'll track what mame calls it - Sinclair Research Systems Ltd
 *  2) to display something as part of the name for each system - Sinclair ZX Spectrum 48k plus
 *  3) to inlcude (or not) in the system type - MSX */
function mungeCompanyAndSytemsNames(systems) {


  const systemsAugmented = R.pipe(

      //create+populate 2 new properties for munging
      R.map(obj => R.assoc(`mungedCompany`, obj.company, obj))
   ,  R.map(obj => R.assoc(`mungedSystem`,  obj.system,  obj))
      //take company from system name if they repeat
    , R.map(obj => R.assoc(`mungedSystem`, obj.mungedSystem.replace(
          new RegExp(`${obj.mungedCompany.split(spaceIsSeparator, oneWord)}\\W`, `i`), ``
      ), obj 
    )) 
  )(systems)

  //These are the main replacement functions to munge MESS' company name and system name
  const compRep = (oldCompany, newCompany) => R.map( 
    obj => R.assoc(`mungedCompany`, obj.mungedCompany.replace(oldCompany, newCompany), obj) 
  )

  //we match the company too when replacing the systeem name
  const systRep = (thisCompany, oldsystem, newsystem) => R.map( 
    obj => R.assoc(`mungedSystem`, (obj.mungedCompany.match(thisCompany) && obj.mungedSystem.match(oldsystem))? 
      newsystem : obj.mungedSystem, obj
    )
  )

  //transforms  
  const mungedSystems = R.pipe(

      compRep(/(<unknown>|<generic>)/, ``)
      //system specific (btw replace accepts regex or string by default (i'm trying to show what's intended), but match matches only regex
    , systRep(`Acorn`, /BBC/, `BBC`), systRep(`Acorn`, /Electron/, `Atom`)
    , compRep(/Amstrad .*/, `Amstrad`), systRep(`Amstrad`, /(CPC|GX4000)/, `CPC`), systRep(`Amstrad`, /^PC([0-9]*).*/, `PC`)
    , compRep(`APF Electronics Inc.`, `APF`), systRep(`APF`, `M-1000`, `Imagination Machine`)
    , compRep(/Apple Computer/, `Apple`), systRep(`Apple`, /(Macintosh LC|Macintosh II.*)/, `Macintosh II (68020/68030)`)
    , systRep(`Apple`, /Macintosh (Plus|SE|Classic)/, `Macintosh (6800)`), systRep(`Apple`, /(^II.*|\]\[|\/\/c|\/\/e)/, `II`)
    , systRep(`Apple`, /\/\/\//, `III`)
    , systRep(`Atari`, /(400|^800.*|XE Game System)/, `400/600/800/1200/XE`) //don't match atari 7800
    , compRep(`Bally Manufacturing`, `Bally`)
    , systRep(`Bandai`, `Super Vision 8000`, `Super Vision`) 
    , systRep(`Bondwell Holding`, /.*/, `Bondwell`), compRep(`Bondwell Holding`, ``) //change company after
    , systRep(`Casio`, `PV-1000`, `PV`)
    , systRep(`Central Data`, `CD 2650`, `2650`)
    , compRep(`Commodore Business Machines`, `Commodore`), systRep(`Commodore`, /(B500|P500|B128-80HP)/, `500/600/700`) 
    , systRep(`Commodore`, /PET .*|CBM .*/, `PET/CBM`), systRep(`Commodore`, /\b(64|128)/, `64/128`)
    , systRep(`Commodore`, `VIC-10 / Max Machine / UltiMax`, `Max/Ultimax`), systRep(`Commodore`, `VIC-1001`, `VIC-20`)
      , systRep(`Commodore`, `264`, `+4/C16`) 
    , compRep(`Comx World Operations Ltd`, `COMX`)
    , compRep(`Cybiko Inc`, `Cybiko`)
    , compRep(`Dick Smith Electronics`, `Dick Smith`)
    , compRep(`Digital Equipment Corporation`, `DEC`)
    , compRep(`Dragon Data Ltd`, `Dragon`)
    , systRep(`EACA`, `Colour Genie EG2000`, `Colour Genie`)
    , systRep(`Ei Nis`, `Pecom 32`, `Pecom`) 
    , systRep(`Elektronika`, `BK 0010`, `BK`)
    , systRep(`Emerson`, `Arcadia 2001`, `Arcadia`)
    , systRep(`Epson`, `PX-4`, `PX`)
    , compRep(`Exidy Inc`, `Exidy`)
    , systRep(`Fairchild`, `Channel F II`, `Channel F`)
    , systRep(`Fujitsu`, `FM-7`, `Micro 7`)
    , compRep(`Franklin Computer`, `Franklin`)
    , compRep(`General Consumer Electronics`, `GCE`)
      , systRep(`Hewlett Packard`, /HP48*/, `HP`) 
    , systRep(`Hawthorne Technology`, `TinyGiant HT68k`, `TinyGiant`) 
    , compRep(`Interton Electronic`, `Interton`)
    , systRep(`Intelligent Game`, `Game MPT-03`, `Game`)
      , compRep(`Intelligent Game`, `Intelligent`) //change company after
    , compRep(`Jupiter Cantab`, `Jupiter`)
      , systRep(`Kyosei`, `Kyotronic 85`, `Kyotronic`)
    , systRep(`Joseph Glagla and Dieter Feiler`, /Ravensburger Selbstbaucomputer.*/, `Ravensburger Selbstbaucomputer`)
      , compRep(`Joseph Glagla and Dieter Feiler`, ``) //change company after
    , compRep(`Kontiki Data A/S`, `Kontiki`) //change company after
    , compRep(`Luxor Datorer AB`, `Luxor`), systRep(`Luxor`, /ABC.*/, `ABC`)
    , systRep(`Matra & Hachette`, `Alice 32`, `MC-10`), compRep(`Matra & Hachette`, `Tandy Radio Shack`) //change company after
    , compRep(`Memotech Ltd`, `Memotech`), systRep(`Memotech`, `MTX .*`, `MTX`) 
    , systRep(`Mikroelektronika`, `Pyldin-601`, `Pyldin`)
    , systRep(`Microkey`, `Primo A-32`, `Primo`)
    , systRep(`Myarc`, `Geneve 9640`, `Geneve`)
    , systRep(`Applied Technology`, `Microbee 16 Standard`, `Microbee`)
    , systRep(`Micronique`, `Hector 2HR+`, `Hector`)
    , systRep(`Nascom Microcomputers`, `1|2`, `Nascom`), compRep(`Nascom Microcomputers`, ``) //change company after
    , systRep(`Nintendo`, `Entertainment System / Famicom`, `NES`)
    , systRep(`Nintendo`, `Game Boy Color`, `Game Boy`)
    , systRep(`Nintendo`, `Super Entertainment System / Super Famicom `, `SNES`)
    , systRep(`Nippon Electronic Company`, `PC Engine`, `PC Engine/TurboGrafx-16`)
      , systRep(`Nippon Electronic Company`, `PC-8201A`, `PC Series`), compRep(`Nippon Electronic Company`, `NEC`) //change company after
    , systRep(`Non Linear Systems`, `Kaypro II - 2/83`, `Kaypro`)
    , compRep(`Nuova Elettronica`, `Nuova`)
    , compRep(`Orbit Electronics`, `Orbit`)
    , compRep(`Ormatu Electronics`, `Ormatu`)
    , systRep(``, `PC/AT 486 with CS4031 chipset`, `PC/AT 486`)
    , systRep(`PEL Varazdin`, `Orao 102`, `Orao`)
    , systRep(`Psion`, /Organiser II.*/, `Organiser II`)
    , compRep(`Data Applications International`, `DAI`), systRep(`DAI`, `DAI Personal Computer`, `Personal Computer`)
    , compRep(`Elektronika inzenjering`, ``)
    , systRep(`International Business Machines`, `IBM PC 5150`, `PC`), compRep(`International Business Machines`, `IBM`) //change company after
    , systRep(`Interton`, `Electronic VC 4000`, `VC 4000`)
    , systRep(``, `Orion128`, `Orion`) //note these assume youve transformed <unknown> already
    , systRep(``, `PK8020Korvet`, `Korvet PK`)
    , compRep(`Jungle Soft / KenSingTon / Chintendo / Siatronics`, '')
    , systRep(/Welback Holdings .*/, `Mega Duck / Cougar Boy`, `Mega Duck/Cougar Boy`), compRep(/Welback Holdings .*/, ``) //change company after
    , compRep(`Miles Gordon Technology plc`, `MGT`)
    , compRep(`Processor Technology Corporation`, `PTC`), systRep(`PTC`, `SOL-20`, `Sol`)
    , systRep(``, `Radio86RK`, `Radio-86RK`) //seems MESS made the mistake here...
    , systRep(`Sanyo`, `MBC-55x`, `MBC`), systRep(`Sanyo`, `PHC-25`, `PHC`)
    , systRep(`SNK`, /(Neo-Geo$|Neo-Geo AES)/, `Neo Geo`), systRep(`SNK`, `Neo-Geo CDZ`, `Neo Geo CD`) //wikipedia says MESS is wrong
      , systRep(`SNK`, `NeoGeo Pocket`, `Neo Geo Pocket`) //MESS says MESS is wrong....
    , systRep(`Sega`, `Genesis`, `Genesis/32X`), systRep(`Sega`, `Master System II`, `Master System`)
       , systRep(`Sega`, /(SC-3000|SG-1000)/, `SG-1000/SC-3000/SF-7000`)
    , systRep(`Sharp`, /MZ.*/, `MZ`)
    , compRep(`Sinclair Research Ltd`, `Sinclair`), systRep(`Sinclair`, /ZX Spectrum .*/, `ZX Spectrum`)
    , compRep(`Sony Computer Entertainment`, `Sony`), compRep(`Sony Inc`, `Sony`)
    , systRep(`Sord`, `m.5`, `M5`)
    , systRep(`Spectravideo`, `SVI-318`, `SVI`)
    , systRep(`Tandy Radio Shack`, /(TRS-80 .*|Color Computer)/, `TRS-80 CoCo`)
    , systRep(`Tatung`, `Einstein TC-01`, 'Einstein')
    , systRep(`Telercas Oy`, /Telmac.*/, 'Telmac')
    , systRep(`Texas Instruments`, /TI-99.*/, 'TI-99')
    , systRep(`Texas Instruments`, `TI Avigo 10 PDA`, 'TI Avigo')
    , systRep(`Thomson`, `MO5 NR`, `MO5`), systRep(`Thomson`, /(TO7.*|TO9.*)/, `TO7/TO9`)
    , systRep(`VEB Robotron Electronics Riesa`, `Z1013`, `KC Series`), compRep(`VEB Robotron Electronics Riesa`, `Robotron`)  //company aftre 
    , compRep(`V. I. Lenin`, `Lenin`), systRep(`Lenin`, `PK-01 Lviv`, `Lviv`)
    , systRep(`Video Technology`, /Laser.*/, `Laser Mk1`)
    , compRep(`Visual Technology Inc`, `Visual`)
    , systRep(`Watara`, `Super Vision`, `Supervision`) //again MESS seems to be wrong

    )(systemsAugmented)

  return mungedSystems

}


function mungeCompanyForType(systems) {

  const systemsWithDisplayComp = R.pipe(

      //we need a new field to capture the name to display rather than munge to system type
      R.map(obj => R.assoc(`displayCompany`, obj.mungedCompany, obj))
      //get rid of company name for msx and call it msx
    , R.map(obj => R.assoc(`mungedCompany`, obj.mungedSystem.match(/MSX1/)? ``     : obj.mungedCompany, obj))
    , R.map(obj => R.assoc(`mungedSystem`,  obj.mungedSystem.match(/MSX1/)? `MSX`  : obj.mungedSystem,  obj))
      //MSX2 is similar but we want to keep its name
    , R.map(obj => R.assoc(`mungedCompany`, obj.mungedSystem.match(/MSX2/)? ``     : obj.mungedCompany, obj))
    , R.map(obj => R.assoc(`mungedSystem`,  obj.mungedSystem.match(/MSX2/)? `MSX2` : obj.mungedSystem,  obj))
      //now MSX has gone, every bracketed item is unnecessary
    , R.map(obj => R.assoc(`mungedSystem`,  obj.mungedSystem.replace(/\W\(.*\)/, ``), obj))
  )(systems)

  return systemsWithDisplayComp

}


function makeFinalSystemTypes(systems) {

   //before we replace the clone systems with the system type they are cloned from, we need to get our type property together
  const systemsWithType = R.map(obj => 
    R.assoc(`systemType`, (obj.mungedCompany === `` || obj.mungedSystem === ``)? 
      `${obj.mungedSystem}`:`${obj.mungedCompany} ${obj.mungedSystem}`, obj
    ), systems 
  ) 
  // now our objects have something like the following keys  ({company, system, call, cloneof, mungedCompany, displayCompany, mungedSystem, systemType})

  //a function we'll pass in later that calls the clone system or reports a problem
  const lookupCall = (cloneof, call) =>  {
    const referredSystem = R.find( R.propEq(`call`, cloneof) )(systemsWithType)
    const originalSystem = R.find( R.propEq(`call`, call)    )(systemsWithType)
    
    return referredSystem === undefined ? ( 
        console.log(`PROBLEM: ${call} says its a (working) cloneof ${cloneof} but ${cloneof} is emulated badly. Setting system type to ${originalSystem.systemType}`) 
      , originalSystem.systemType
    ): referredSystem.systemType
  }

  //change the munged system of every machine that has a cloneof property to be the system that points to: should come at the end of munging system names
  const systemsDeCloned = R.map(obj => R.assoc(`systemType`, obj.cloneof? 
    lookupCall(obj.cloneof, obj.call) : obj.systemType, obj), systemsWithType)
  
  return systemsDeCloned

}

/* Many systems aren't of interest since they're never going to have enjoyable games
 *  it was easiest to specify the fully munged system types (that's why i'm removing these as a last step) */
function removeBoringSystems(systems) {

  const boringSystems =[
      `Acorn System 1`, `Acorn System 3`, `Ampro Litte Z80 Board`, `Andrew Donald Booth All Purpose Electronic X-ray Computer`
    , `Apollo DN3500`, `Applix Pty Ltd 1616`, `BBC Bridge Companion`, `BBN BitGraph rev A`, `BGR Computers Excalibur 64`
    , `Bit Corporation Chuang Zao Zhe 50`, `BNPO Bashkiria-2M`, `BP EVM PK8000 Vesta`, `Canon X-07`, `Corvus Systems Concept`
    , `Digital Research Computers Big Board`, `Elwro 800 Junior`, `Frank Heyder Amateurcomputer AC1 Berlin`, `Intel Intellec MDS-II`, `Joachim Czepa C-80` 
    , `Josef Kratochvil BOB-85`, `LCD EPFL Stoppani Dauphin`, `Manchester University Small-Scale Experimental Machine, 'Baby'`, `Michael Bauer Dream 6800` 
    , `Militaerverlag der DDR Ausbaufaehiger Mikrocomputer mit dem U 880`, `MOS Technologies KIM-1`, `Motorola MEK6800D2`, `Mugler/Mathes PC/M`
    , `Multitech Micro Professor 1`, `Multitech Microkit09`, `National JR-100`, `Netronics Explorer/85`, `Nokia Data MikroMikko 1 M6`, `Osborne 1`
    , `Peripheral Technology PT68K2`, `Peripheral Technology PT68K4`, `Pitronics Beta`, `PolyMorphic Systems Poly-88`, `Radio Bulletin Cosmicos`
    , `Research Machines RM-380Z`, `Rockwell AIM 65`, `Sanyo MBC`, `Signetics Instructor 50`, `Signetics PIPBUG`, `Slicer Computers Slicer`
    , `Small Systems Engineering SoftBox`, `SWTPC S/09 Sbug`, `System 99 Users Group SGCPU`, `Talking Electronics magazine TEC-1A with JMON`
    , `Tandy Radio Shack 200`, `Texas Instruments TI-74 BASICALC`, `Texas Instruments TM 990/189 University Board microcomputer`
    , `USSR 15IE-00-013`, `UT-88 mini`, `VEB Mikroelektronik Lerncomputer LC 80`, `VEB Polytechnik Poly-Computer 880`
    , `Video Technology Vtech IT Unlimited`, `Visual 1050`, `Xerox Alto-II`, `Xor Data Science S-100-12`, `Yamaha FB-01`, `ZPA Novy Bor IQ-151`
  ]

  const isItBoring = systemType => { 
    if ( boringSystems.includes(systemType) ) console.log( `removing an emu of type ${systemType} - there will likely never be any games`)
    return boringSystems.includes(systemType) 
  }
  
  const systemsWithGames = R.reject(obj => isItBoring(obj.systemType), systems)

  return systemsWithGames
}


/*
 * A subtltey here is that we want to print the munged COMPANY name (to avoid xx Computer Electronics Holding Ltd AB etc), but we want to largely keep 
 *   MESS' original system name to capture what makes each system different. However there are some considerations that also apply to system munging 
 *   that need re-application, along with some new concerns regarding the output format
 */
function print(systems) {

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

  const efinder = R.pipe(
    
      //take company from system name if they repeat
      R.map( obj => R.assoc(`displaySystem`, obj.displayCompany === ``? 
          obj.system : obj.system.replace(
            new RegExp(`${obj.displayCompany.split(spaceIsSeparator, oneWord)}\\W`, `i`), ``)
          , obj)
      ) 

      //it wasn't very forward thinking to call it the Apple ][ 
    , R.map( obj => R.assoc(`displaySystem`, obj.displaySystem.replace(/\]\[/, `II`), obj) )

    //create the display name for this machine
    , R.map( obj => R.assoc(`displayMachine`, obj.displayCompany === `` ? 
          `${obj.displaySystem}` : `${obj.displayCompany} ${obj.displaySystem}`, obj) )

  )(systems)
 
  //create the vars which will populate each instance of the EfindTemplate, first for each machine's softlist (if they exist)
  //topLine here becomes the Emulator name for softlist generation. Save it back into the object while we have it
  const softlistEfinderToPrint = obj => R.map(softlist => {
    const emulatorName = `${obj.displayMachine} -SOFTLIST ${softlist.name}` 
             + (softlist.filter? ` ${softlist.filter} only` : ``)
    softlist.emulatorName = emulatorName
    const params = {
        topLine    : emulatorName
      , systemType : obj.systemType
      , callToMake : `${obj.call} %ROMMAME%` //for we are running from a generated soflist romdata.dat
      , info       : `http://mameworld.info` //we don't have anything but a url to tell you about with softlists
    }
    mameDevices.push(mameEfindTemplate(params))
    retroarchDevices.push(retroarchEfindTemplate(params))
  }, obj.softlist)
 

   //then for each machine's devices (as with softlists, save the emulator name (don't really need it for anything atm)
  const devicesEfinderToPrint = obj => R.map(device => {
    const emulatorName = `${obj.displayMachine} -${device.name}`
    device.emulatorName = emulatorName
    const params = {
        topLine    : emulatorName
      , systemType : obj.systemType
      , callToMake : `${obj.call} -${device.briefname} "%ROM%"` //this is not about softlists
      , info       : `Supports: ${device.extensions}`
    }
     
    mameDevices.push(mameEfindTemplate(params))
    retroarchDevices.push(retroarchEfindTemplate(params))
  }, obj.device)
   
  const mameDevices      = [] //this is an accumlator, we need to reduce....
  const retroarchDevices = [] //this is an accumlator, we need to reduce....
  
  const efinderToPrint = R.map(obj => (
      obj.softlist?  softlistEfinderToPrint(obj) : ``
    , devicesEfinderToPrint(obj) //don't check if devices exist, wouldn't be a mess game system without >0
  ), efinder)
 
  const joinedMameDevices = mameDevices.join(`\n`)
  const joinedRetroarchDevices = retroarchDevices.join(`\n`)
  console.log(`Printing inis to ${mameIniOutPath} / ${rarchIniOutPath}`)
  if (logIni) console.log(joinedMameDevices)
  if (logIni) console.log(joinedRetroarchDevices)
  fs.writeFileSync(mameIniOutPath,  joinedMameDevices,      `latin1`) //utf8 isn't possible at this time
  fs.writeFileSync(rarchIniOutPath, joinedRetroarchDevices, `latin1`) //utf8 isn't possible at this time
  
  madeDat(efinder) 
  
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

