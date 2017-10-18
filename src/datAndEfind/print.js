'use strict'

const fs             = require('fs')
const R              = require('ramda')

/*
 * A subtltey here is that we want to print the munged COMPANY name (to avoid xx Computer Electronics Holding Ltd AB etc), but we want to largely keep 
 *   MESS' original system name to capture what makes each system different. However there are some considerations that also apply to system munging 
 *   that need re-application, along with some new concerns regarding the output format
 */
module.exports = (mameIniOutPath, rarchIniOutPath, logIni) =>  systems => {

  const spaceIsSeparator = ` `
  const  oneWord          = 1

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
  
  return efinder
  
}
