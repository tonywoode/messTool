'use strict'

const fs    = require('fs')
const R     = require('ramda')
const Leven = require('levenshtein')

module.exports = hashDir => softlistEmus => {

  /* Sometimes a softlist exists for a device that isn't supported in the version of mess e.g.: in mess 0.163, 
   *  a2600 doesn't have a cass, but there exists a cass softlist, which will silently fail if called. 
   *   So, try and get the device from the softlist name and check. Considerations:
   *     1) There's no point in looking in a softlist xml for devices it's about, unless you want to try and parse the free text 'name' field
   *     2) Some softlist names don't have a postfix, but we're assuming we don't 'need' the device name 
   *       (we can, we think, always call 'nes smb' and we never need to 'nes -cart smb'. TODO: This needs confirming)
   *     3) some postfixes are not about the device - we've got _a1000, _workbench, _hardware
   *       (with a bit of luck most of these are unsupported or not games anyway, we'll need to make a list) */ 
  const addDeviceType = R.pipe(
      //grab the device or declare there is none specified
      R.map( obj => (R.assoc(`deviceTypeFromName`, obj.name.split(`_`)[1]? obj.name.split(`_`)[1] : `no_postfix`, obj)))
      //get system type from softlist name, needed immediately and later
    , R.map( obj => (R.assoc(`systemTypeFromName`, obj.name.split(`_`)[0], obj)))

      //FM7's disk softlist breaks the  rule and is called 'disk'. They are just floppy images, they work fine
    , R.map( obj => (obj.deviceTypeFromName === `disk`? obj.deviceTypeFromName = `flop`: obj.deviceTypeFromName, obj))
      //ditto epson_cpm, some of which really are games
    , R.map( obj => (obj.deviceTypeFromName === `cpm`? obj.deviceTypeFromName  = `flop`: obj.deviceTypeFromName, obj))
      //ditto for Timex Sinclair TS-2068
    , R.map( obj => (obj.deviceTypeFromName === `dock`? obj.deviceTypeFromName = `cart`: obj.deviceTypeFromName, obj))
      //i note some lists called hdd and some softlists called 'hard1`, `hard2`, guess for later (there are no matches atm)
    , R.map( obj => (obj.deviceTypeFromName === `hdd`? obj.deviceTypeFromName  = `hard`: obj.deviceTypeFromName, obj))
      // I suspect all the nes softlist will run on all systems, essentially its postfixes aren't about mess `devices`
      // Note that the same isn't true for Famicom, as there seems to be a genuine problem that Famicoms don't have cass or flops
    , R.map( obj => (obj.systemTypeFromName === `nes`? obj.deviceTypeFromName  = `no_postfix` : obj.deviceTypeFromName, obj))
      //I suspect the same is true of the superfamicom devices bspack and strom, these aren't device names in the same way as flop or cass
    , R.map( obj => (obj.systemTypeFromName === `snes`? obj.deviceTypeFromName = `no_postfix` : obj.deviceTypeFromName, obj))
  )(softlistEmus)

  
  //return a list of devices without the number in their briefname, so we can tell if the machine for a 'cart' softlist actually has a working 'cart' device
  const supportedDevices = deviceList => R.map(
    device => R.head(device.split(/[0-9].*/))
  , deviceList)

  //make a k-v in the object to tell us if the softlist we've made can actually run. If the softlist has no postfix, we assume it will run
  // (an example is a2600.xml as the softlist name, which if you read the text description says its for 'cart')
  const deviceExists = R.map( obj => (
        R.assoc(`doesSoftlistExist`, obj.deviceTypeFromName === `no_postfix`? 
          true : R.contains(obj.deviceTypeFromName, supportedDevices(obj.device)), obj)
  ), addDeviceType)

  //make exception or remove those softlists that say that the softlist device doesn't actually exist
  const alertProblemDevices = R.map( 
    obj => obj.doesSoftlistExist? obj : console.log(
        `DEVICE PROBLEM: ${obj.displayMachine} has a softlist called ${obj.name} but doesn't have a ${obj.deviceTypeFromName}`
      )
  , deviceExists)
  
  // now remove them
  const removedProblemDevices = R.filter( obj => obj.doesSoftlistExist === true, deviceExists)

  //make a k-v telling us if list exists on disk - is the softlist found in the softlist directory
  const softlistFileExists = R.map( obj => (
      R.assoc(`doesSoftlistFileExist`, fs.existsSync(`${hashDir}${obj.name}.xml`), obj)
    )
  , removedProblemDevices)

  //alert those that dont exist
  const alertNonExistentSoftlistFile = R.map( 
    obj => obj.doesSoftlistFileExist === true? 
      obj : console.log(
        `FILE PROBLEM: ${obj.displayMachine} has a softlist called ${obj.name} but there's no file called "${hashDir}${obj.name}.xml`
      )
    , softlistFileExists)
 
  //remove softlists with no softlist file in hashes dir
  const removedNonExistingLists = R.filter( obj => obj.doesSoftlistFileExist === true, softlistFileExists)

 
  /* The best match for many softlists will that the call for the machine matches the prefix of the softlist - a2600
   * There is then some utility to be gained for similarity in substrings. So rate the similarity */ 

  //get the edit distance of every softlist system to the softlist prefix
  const getDistance = (call, namePrefix) => {
    const l = new Leven(call, namePrefix)
    let round = 0
    if (l.distance === 0) round =  40
    if (l.distance === 1) round =  30
    if (l.distance === 2) round =  15
    if (l.distance === 3) round =  10
    if (l.distance === 4) round =   5
    if (l.distance === 5) round = -10
    if (l.distance === 6) round = -25
    if (l.distance === 7) round = -30
    if (l.distance >= 8)  round = -40
 
    return round
  }

  // two things at once - we start a rating for each object at 50, but then use the Levenshtein distance to immediately make it useful
  const addedRatings =  R.map( 
    obj => (R.assoc(`rating`, 50 + getDistance(obj.call, obj.systemTypeFromName), obj)), removedNonExistingLists
  )

  //now any emu that is a clone gets reduced in rating by 40 (problem here is we lose accuracy if there are clone trees, i'm not sure if there are)
    const deRateClones = R.map( obj => obj.cloneof? ( 
      obj.rating -= 90
      , obj
    ): obj, addedRatings)
  
  return deRateClones

}
