'use strict'

const R = require('ramda')
//read the json for softlists and make a list of those xmls to find. Need to grab emu name also and pass it all the way down our pipeline
module.exports = logExclusions => systems => {
  const isSoftlist = obj => !!obj.softlist //filter by softlist

  /* looking at the softlist, there are some that don't have any games. Doesn't mean to say they might not one day,
   * but its unlikely. Some games may exist though (that's why we remove them here but keep them as emulators)
   * Don't process further. Don't make a softlist for them */
  const softlistsWithNoGames = [   
      `abc800`, `abc806`, `abc80_cass`, `abc80_flop`, `ampro`, `atom`, `bw12`, `bw2`, `cbm2_cart` 
    , `cbm2_flop`, `cbm8096_flop`, `cbm8296_flop`, `comx35_flop`, `ht68k`, `kayproii`, `lisa`, `mac_hdd`
    , `mac_flop`, `mc1502_flop`, `mikro80`, `nimbus`, `p500_flop`, `pc1640`, `pc8201`, `pencil2` 
    , `px4_cart`, `ql_cart`, `ql_cass`, `rx78`, `trs80m2`, `trsm100`, `vip` 
  ]

  const isThisSoftlistBoring = (list, machine) => {
    if (softlistsWithNoGames.includes(list.name)) { 
      if (logExclusions) console.log(`INFO: Removing  ${list.name} from ${machine} because there are no games in the list`) 
      return softlistsWithNoGames.includes(list.name)
    }   
    return false
  }
 
  //take out of the softlist key, those softlists in the exclusion list above
  const removeNonGames = obj => R.assoc(`softlist`, 
    R.reject(
      softlist => isThisSoftlistBoring(softlist, obj.displayMachine)
    , obj.softlist)
  , obj)


  //make a softlist subset of json, just those values we need. We'll add to it then
  const filtered = R.pipe(
      R.filter(isSoftlist)
    , R.map(removeNonGames)
    , R.map(obj => ({
        displayMachine: obj.displayMachine
      , systemType    : obj.systemType
      , softlist      : obj.softlist
      , device        : obj.device
      , call          : obj.call
      , cloneof       : obj.cloneof
    }) )
  )(systems) 

 
  //all we need from the device subobject is the shortnames
  const replaceDevice = R.map(
    obj => R.assoc(`device`, R.map(
      obj => obj.briefname, obj.device) 
    , obj)
  , filtered)

  //convert that structure into one keyed by softlist (atm the machine is the organisational unit)
  const softlistKeyed = R.map(
    obj => R.map(
      softlist => ({
         emulatorName  : softlist.emulatorName
       , displayMachine: obj.displayMachine
       , systemType    : obj.systemType
       , name          : softlist.name
       , status        : softlist.status
       , filter        : softlist.filter
       , device        : obj.device
       , call          : obj.call
       , cloneof       : obj.cloneof

      })
    , obj.softlist)
  , replaceDevice)

  //problem: softlist params are still array-ed to each machine: flatten the lot (rely on 'displayMachine' to link)
  const flattenedSoftlistEmus = R.unnest(softlistKeyed)
  
  return flattenedSoftlistEmus
}


