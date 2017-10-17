'use strict'

const R              = require('ramda')

/* Many systems aren't of interest since they're never going to have enjoyable games
 *  it was easiest to specify the fully munged system types (that's why i'm removing these as a last step) */
module.exports = systems => {

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


