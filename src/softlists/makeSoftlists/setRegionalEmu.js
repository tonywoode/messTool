'use strict'

const R = require('ramda')

/* Because we often need the right regional machine for a game,  
 * MAME usually considers NTSC as the default, so we do too 
 * The logic for Euro and PAL are converse - Euro wants to come before all of its regions else one of those will get chosen at random? If there's no
 * Euro machine THEN look for regions. PAL however is always trumped by any region, its the last check */
const whichCountryIsThisGameFor = R.cond([

    // first the master regions, for there is no point specialising further if we find these
    [ game => /\([^)]*World.*\)/.test(game),      country => `World` ] //that's a good case for the default
  , [ game => /\([^)]*USA.*\)/.test(game),        country => `US` ] //(Eur, USA - we should say USA wins so this goes up top), checked US[^A]
  , [ game => /\([^)]*Euro.*\)/.test(game),       country => `European` ] //if Euro is a region theres no point customising further, checked 'Eur'
  , [ game => /\([^)]*Asia.*\)/.test(game),       country => `Asiatic` ] 
  , [ game => /\([^)]*Arab.*\)/.test(game),       country => `Arabian` ] 
  
    //then the sub regions
  , [ game => /\([^)]*UK.*\)/.test(game),         country => `UK` ] 
  , [ game => /\([^)]*Fra|French.*\)/.test(game), country => `French` ] 
  , [ game => /\([^)]*Spa.*\)/.test(game),        country => `Spanish` ] //checked 'Esp' 
  , [ game => /\([^)]*Ita.*\)/.test(game),        country => `Italian` ] 
  , [ game => /\([^)]*Ger.*\)/.test(game),        country => `German` ] //checked 'Deu' 
  , [ game => /\([^)]*Swe.*\)/.test(game),        country => `Swedish` ] 
  , [ game => /\([^)]*Pol.*\)/.test(game),        country => `Polish` ]
  , [ game => /\([^)]*Fin.*\)/.test(game),        country => `Finish` ]
  , [ game => /\([^)]*Den.*\)/.test(game),        country => `Danish` ]
  , [ game => /\([^)]*Hun.*\)/.test(game),        country => `Hungarian` ]
  , [ game => /\([^)]*Nor.*\)/.test(game),        country => `Norweigian` ]
  , [ game => /\([^)]*Ned.*\)/.test(game),        country => `Netherlandic` ] 
  
  , [ game => /\([^)]*Jpn|Japan.*\)/.test(game),  country => `Japanese` ] //Vampire Killer (Euro) ~ Akumajou Dracula (Jpn)
  , [ game => /\([^)]*Kor.*\)/.test(game),        country => `Korean` ]
  , [ game => /\([^)]*Tw.*\)/.test(game),         country => `Taiwanese` ]
  
  , [ game => /\([^)]*Aus.*\)/.test(game),        country => `Australian` ]
  , [ game => /\([^)]*Bra.*\)/.test(game),        country => `Brazilian` ]
  
    //lasty these are the fallback
  , [ game => /\([^)]*NTSC.*\)/.test(game),       country => `NTSC` ]
  , [ game => /\([^)]*PAL.*\)/.test(game),        country => `PAL` ]

])

//the regex here is slightly different beceuase we don't care about brackets: we want to catch 'NTSC only'
// we need to return a function, hence the tag "country"
const whichCountryIsThisEmuFor = R.cond([
    [ emu => /US|USA|America/.test(emu),  country => `US` ]
  , [ emu => /Europe/.test(emu),          country => `European` ]
  , [ emu => /Arabic/.test(emu),          country => `Arabian` ]
  
  , [ emu => /Japan/.test(emu),           country => `Japanese` ]
  , [ emu => /Sweden/.test(emu),          country => `Swedish` ]
  , [ emu => /Germany/.test(emu),         country => `German` ]
  , [ emu => /UK/.test(emu),              country => `UK` ]
  , [ emu => /Spaini|Spanish/.test(emu),  country => `Spanish` ]
  , [ emu => /Greece/.test(emu),          country => `Greek` ]
  , [ emu => /Italy/.test(emu),           country => `Italian` ]
  , [ emu => /Korea/.test(emu),           country => `Korean` ]
  , [ emu => /Brazil/.test(emu),          country => `Brazilian` ]
  , [ emu => /Denmark/.test(emu),         country => `Danish` ]
  , [ emu => /Poland/.test(emu),          country => `Polish` ]
  , [ emu => /Estonian/.test(emu),        country => `Estonian` ]
  , [ emu => /Russian/.test(emu),         country => `Russian` ]
 
  , [ emu => /PAL/.test(emu),             country => `PAL` ]
  , [ emu => /NTSC/.test(emu),            country => `NTSC` ]

])

const whichRegionIsThisCountryFor = R.cond([
    [ country => country.match(/^US|World$/), region => `US` ] //MESS implies NTSC/US as default, so we do too 
  , [ country => country === `Arabian`,       region => `Arabian` ] //regrettable
  , [ country => country === `PAL`,           region => `PAL` ] //regrettable
  , [ country => country === `NTSC`,          region => `NTSC` ] //regrettable
  , [ country => country === `Brazilian`,     region => `Brazilian` ] //regrettable
  , [ country => country === `Australian`,    region => `Australian` ] //regrettable
  , [ country => country.match(
      /^(Danish|European|Finish|French|German|Greek|Italian|Hungarian|Norweigian|Netherlandic|Polish|Swedish|Spanish|UK)$/
    ), region => `European` ]
  , [ country => country.match(/^(Asiatic|Korean|Japanese|Taiwanese)$/), region => `Asiatic` ]
])

const whichStandardIsThisRegionFor = R.cond([
    [ country => country.match(/^(NTSC|US|Asiatic)$/), standard => `NTSC` ] //that first NTSC VERY regrettable
  , [ country => country.match(/^(PAL|European|Arabian|Brazilian|Australian)$/), standard => `PAL` ]
])


const setRegionalEmu = (logGames, logRegions, gameName, emuName, emuRegionalNames) => {

  //choose emu on a game-by-game basis
  const gameCountry = whichCountryIsThisGameFor(gameName) 
  let chosenEmulator = emuName //if it all goes wrong return default
  gameCountry? (
    emuRegionalNames? (
     logGames? console.log(`${gameName} is ${gameCountry} so use one of ${emuRegionalNames}`) : ''
      , chosenEmulator = chooseRegionalEmu(logRegions, gameCountry, emuRegionalNames, gameName)
    ): logGames? console.log(`${gameName} only has one emu so use default ${emuName}`) : ''
  ) : logGames? console.log(`${gameName} doesnt need a regional emu, use default ${emuName}`) : ''

return chosenEmulator

}


const chooseRegionalEmu = (logRegions, gameCountry, emuRegionalNames, useTheDefaultEmulator) => {
  //first get my region names for each of the regional emus
  const emusTaggedByCountry = tagEmuCountry(emuRegionalNames)
  const emuCountries =  R.keys(emusTaggedByCountry) 
  //so now we have the basics of a decision node: LHS=region code RHS=region code choices
  if (logRegions) console.log(`  -> Matching ${gameCountry}, possible emus are ${JSON.stringify(emuCountries)}` )
 

  //first: do we find a match?
  const foundInCountry = R.indexOf(gameCountry, emuCountries) !== -1? gameCountry : null
  if (foundInCountry) {
    const foundEmu = emusTaggedByCountry[foundInCountry]
    if (logRegions) console.log(`    ---->country match: ${foundInCountry} matches ${foundEmu}`)
    return foundEmu
  }
  
  //then: do we have a regional match for a country?
  //we need to transform the country emu list into one keyed by region now
  const emusTaggedByRegion = tagEmuRegion(logRegions, emusTaggedByCountry)
  const emuRegions = R.keys(emusTaggedByRegion)
  const gameRegion = whichRegionIsThisCountryFor(gameCountry)
  if (logRegions) console.log(`and the game's region for that country comes out as ${gameRegion}`)
  //match gameRegion against emuRegions
  const foundInRegion = R.indexOf(gameRegion, emuRegions) !== -1? gameRegion : null
  if (foundInRegion) {
    const foundEmu = emusTaggedByRegion[foundInRegion]
    if (logRegions) console.log(`    ---->region match: ${foundInRegion} matches ${foundEmu}`)
    return foundEmu
  }

  //then: fallback to PAL/NTSC - all region/countries need this setting
  //again that emu list to standard now
  const emusTaggedByStandard = tagEmuStandard(logRegions, emusTaggedByRegion)
  const emuStandards = R.keys(emusTaggedByStandard)
  const gameStandard = whichStandardIsThisRegionFor(gameRegion)
  //match gameStandard against emuRegions
  const foundInStandard = R.indexOf(gameStandard, emuStandards) !== -1? gameStandard : null
  if (foundInStandard) {
    const foundEmu = emusTaggedByStandard[foundInStandard]
    if (logRegions) console.log(`    ---->standard match: ${foundInStandard} matches ${foundEmu}`)
    return foundEmu
  }
  
  //lastly give up and choose default
  if (logRegions) console.log(`I found nothing`)
  return useTheDefaultEmulator
}

//key by country name - consider here that we just want one PAL or NTSC emu to run, c64_cart and coco 3 have >1 of these each, so for now last wins
const tagEmuCountry = emuRegionalNames => {
  const node = {}
  R.map(emuName => {
    const tagCountry = whichCountryIsThisEmuFor(emuName)
    if (tagCountry) node[tagCountry] = emuName //we didn't ensure we always had a country in the regional emus, apple2's ROM003 derivatives are giving us a couple of undef
  }, emuRegionalNames)
    
  return node
 
}

//since we need to compare like for like, when we transform a games country into a region, we must do the same with the emu's country
const tagEmuRegion = (logRegions, emusTaggedByCountry) => {
  const node = {}
  const keys = R.keys(emusTaggedByCountry) //we encoded the country info as key, so get that out to compare
  R.map(emuCountry => {
    const tagRegion = whichRegionIsThisCountryFor(emuCountry) 
    if (tagRegion) node[tagRegion] = emusTaggedByCountry[emuCountry] //this time we have to look back at the country key in the passed in array and pick out its emulator
  }, keys)
  if (logRegions) console.log(`     ++++ Made a region keyed emu list ${JSON.stringify(node)}`)
  
  return node
 
}

//and again...sigh
const tagEmuStandard = (logRegions, emusTaggedByRegion) => {
  const node = {}
  const keys = R.keys(emusTaggedByRegion) //we encoded the region info as key, so get that out to compare
  R.map(emuRegion => {
    const tagStandard = whichStandardIsThisRegionFor(emuRegion) 
    if (tagStandard) node[tagStandard] = emusTaggedByRegion[emuRegion] //this time we have to look back at the region key in the passed in array and pick out its emulator
  }, keys)
  if (logRegions) console.log(`      ++++ Made a standard keyed emu list ${JSON.stringify(node)}`)
  
  return node
 
}

module.exports = setRegionalEmu
