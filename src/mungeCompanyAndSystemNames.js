'use strict'

const R              = require('ramda')

/* we have multiple needs for company name:
 *  1) we'll track what mame calls it - Sinclair Research Systems Ltd
 *  2) to display something as part of the name for each system - Sinclair ZX Spectrum 48k plus
 *  3) to inlcude (or not) in the system type - MSX */

module.exports = systems => {

  const spaceIsSeparator = ` `
  const  oneWord          = 1
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

