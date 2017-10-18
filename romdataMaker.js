"use strict"

const fs              = require('fs')
const XmlStream       = require('xml-stream')
const R               = require('ramda')
const mkdirp          = require('mkdirp')

const callSheet       = require('./src/romdataMaker/callsheet.js')
const filterSoftlists = require('./src/romdataMaker/filterSoftlists.js')

const hashDir         = `inputs/hash/`
  , outputDir         = `outputs/`
  , systemsJsonFile   = fs.readFileSync(`${outputDir}systems.json`)
  , systems           = JSON.parse(systemsJsonFile)
  //TODO - you can append the DTD at the top of the file if it isn't being read correctly

  //decide what we want to print to console
  , logGames          = false
  , logChoices        = false
  , logRegions        = false
  , logExclusions     = false
  , logPrinter        = false

//program flow at list level
R.pipe(
    callSheet(logExclusions)
  , filterSoftlists(hashDir)
  , chooseDefaultEmus
  , makeSoftlists 
)(systems)

//program flow at emu level
function makeSoftlists(emuSystems) {
  R.map(emu => {
        const softlistParams = makeParams(emu)
        makeASoftlist(softlistParams.xml, softlist => {
          const cleanedSoftlist = cleanSoftlist(softlist)
          printARomdata(cleanedSoftlist, softlistParams)
        })
      }, emuSystems)
}

/* We need to say 'before you write, check if you've already written a softlist with an emu
 *  that had a higher rating. if so don't write. We can achieve this by writing a `written` key in the object
 *  but that's not good enough we can't just have a bool because we need to know what the previous rating was for the softlist
 *  so we need to store an object structure liks "a2600" : "80" to know that for each softlist) */
function chooseDefaultEmus(softlistEmus) {
 
  //TODO: this whole function is very impure, yet isn't using anything outside what's passed in....
  const softlistRatings = {}, defaultEmus = {}, logDecisions = {}, rejectedEmus = []
  
  const decideWhetherToMakeMeOne = R.map( emu => {

    //rate the current object we're on against an accumulated value
    const decide = (rating, accum) => rating > accum? (
        defaultEmus[emu.name]          = emu
      , softlistRatings[emu.name]      = emu.rating
      , logDecisions[emu.emulatorName] = `accepted for ${emu.name} as its rating is: ${rating} and the accumulator is ${accum}`
    ) 
    : (
        logDecisions[emu.emulatorName] = `rejected for ${emu.name} as its rating is: ${rating} and the accumulator is ${accum}` 
      , rejectedEmus.push(emu)
    )
    //if the emu has a rating for the softlist it runs, compare it against the total, if it doesn't set it as the default
    softlistRatings[emu.name]? 
      decide(emu.rating, softlistRatings[emu.name]) : (
          defaultEmus[emu.name] = emu
        , softlistRatings[emu.name] = emu.rating
      )
    
  }, softlistEmus)

/* add regional variant defaults - for each defaultEmu, check if it matches a regional regex
 * a problem we now have is some machines encode useful info Atari 2600 (NTSC) where some encode none Casio MX-10 (MSX1)
 * i think all those that do have a FILTER key...nope, turns out the filter key can't be relied on, atari 400 doen't have it
 * but clearly has a (NTSC) variant, let's just parse the emu or display name for (NTSC)a */
  const regionality = R.map(defaultEmu => { 
    const regionals = []
    const matchme = defaultEmu.emulatorName.match(/\(.*\)|only/) //actually this list is pretty good as it is ( it should contain all regions instead of that kleene)
      if (matchme) {
        if (logChoices) console.log(`${defaultEmu.emulatorName} is a match`)
        //if it does, then look back in the rejected emus for those named the same except for the ()
        const nesRegex       = defaultEmu.emulatorName.replace(/ \/ Famicom /, ``)
        const snesRegex      = nesRegex.replace(/ \/ Super Famicom /, ``)
        const megadriveRegex = snesRegex.replace(/Genesis/, `Mega Drive`)
        const regex1         = megadriveRegex.replace(/PAL|NTSC only/, ``)
        
        const regex = new RegExp(regex1.replace(/\(.*\)/, `(.*)`))//only relace first occurance
        if (logChoices) console.log(regex)
        R.map(rejected => rejected.emulatorName.match(regex)? (
          logChoices? console.log(`---->>>> matches ${rejected.emulatorName}`) : ''
            //add them to a key "regions", but filter by softlist name otherwise Atari 800 (NTSC) -SOFTLIST a800 matches Atari 800 (PAL) -SOFTLIST a800_flop
          , defaultEmu.name === rejected.name ? (  
                regionals.push(rejected.emulatorName) 
              , logChoices? console.log(regionals) : ''
          ): null
        )
        : null, rejectedEmus)
        if (regionals[0]) {
            //add the original emu name to the list here, it does help the picker logic later, even though NTSC is generally the default
            regionals.push(defaultEmu.emulatorName)
            //put the list in the default emulators object
          , defaultEmu.regions = regionals 
        }
        return defaultEmu
      }
  }, defaultEmus)

  return defaultEmus //note this now keyed by softlist name, but it functions just the same.
}


function makeParams(emulator) {
  
  const //I like forward slashes in system type. System doesn't...
      systemType              = emulator.systemType?
          emulator.systemType.replace(/\//g, `-`) 
        : console.log(`TYPE PROBLEM: ${emulator.displayMachine} doesn't have a system type to use as a potential folder name`) 
      //I like forward slashes in system names. System doesn't...and bloody apple again
      //(The apple specifics are only needed if the machine name is in any way going to be part of the filepath, so a temporary mesaure)
    , displayMachine1         = emulator.displayMachine.replace(/\/\/\//g, `III`)
    , displayMachine2         = displayMachine1.replace(/\/\//g, `II`)
    , displayMachine          = displayMachine2.replace(/\//g, `-`)
    , name1                   = emulator.name.replace(/\/\/\//g, `III`)
    , name2                   = name1.replace(/\/\//g, `II`)

    , name                    = name2.replace(/\//g, `-`)

    , thisEmulator            = emulator
    , stream                  = fs.createReadStream(`${hashDir}${name}.xml`)
    , xml                     = new XmlStream(stream)
    , mameOutRootDir          = `${outputDir}mame_softlists/`
    , mameOutTypePath         = `${mameOutRootDir}/${systemType}`
    , mameOutNamePath         = `${mameOutTypePath}/${name}` //to print out all systems you'd do ${displayMachine}/${name}`/
    , mameOutFullPath         = `${mameOutNamePath}/romdata.dat`
    , retroarchOutRootDir     = `${outputDir}retroarch_softlists/`
    , retroarchOutTypePath    = `${retroarchOutRootDir}/${systemType}`
    , retroarchOutNamePath    = `${retroarchOutTypePath}/${name}` //to print out all systems you'd do ${displayMachine}/${name}`/
    , retroarchOutFullPath    = `${retroarchOutNamePath}/romdata.dat`
       
  return  ({ 
      systemType, name, thisEmulator, stream, xml, mameOutRootDir, mameOutTypePath, mameOutNamePath
    , mameOutFullPath, retroarchOutRootDir, retroarchOutTypePath, retroarchOutNamePath, retroarchOutFullPath
  })

}  


function makeASoftlist(xml, callback) {

  const softlist = []

  xml.collect(`info`)
  xml.collect(`sharedfeat`)
  xml.collect(`feature`)
  xml.on(`updateElement: software`, software => {
    if (
          software.$.supported !== `no` 
      //these crap the list out after the dollar. perhaps path length + key may not exist...
      //the softlist i'm testing with atm doesn't use these
   // &&  software.part.dataarea.rom.$.status  !== `baddump`
   // &&  software.part.dataarea.rom.$.status  !== `nodump`
   // &&  software.part.diskarea.disk.$.status !== `baddump`
   // &&  software.part.diskarea.disk.$.status !== `nodump`
    ) {
      const node = {}
      node.call          = software.$.name
      node.cloneof       = software.$.cloneof
      node.name          = software.description
      node.year          = software.year
      node.company       = software.publisher
      node.info          = software.info
      node.sharedfeature = software.sharedfeat
      node.feature       = software.part.feature
      node.loadsWith     = software.part.$.interface //reserved js word
      softlist.push(node)
    }
  })
  xml.on(`end`, () => {
    // console.log(JSON.stringify(softlist, null, '\t')); process.exit()
    callback(softlist)
  })

}


/* I don't like working with a messy tree, lots of $ and needless repetition...With softlists it tuned
 *   out that we have three identically keyed objects, so a generic function will clean them all up
 */
function cleanSoftlist(softlist) {
  //I removed destructuring elsewhere but here the object isn't going to grow
  const cleanPairs = key  => 
    R.map( ({ $ }) => 
     ( ({ name:$.name, value:$.value }) )
    , key )
  
  //if the softlist contains some subobject named 'key', clear up that subobject, as the thing we scraped wasn't nice
  const replaceIfKey = (key, list) => R.map(obj => obj[key]? 
    obj[key] = R.assoc(key, cleanPairs(obj[key]), obj) : obj
  , list )

  //TODO: good case for pipe, but the function takes the whole softlist
  const replacedFeature    = replaceIfKey(`feature`, softlist)
  const replacedInfo       = replaceIfKey(`info`, replacedFeature)
  const replacedSharedFeat = replaceIfKey(`sharedFeat`, replacedInfo)

  return replacedSharedFeat
}

 
function printARomdata(softlist, softlistParams) {
  //don't make a dat or folder if all of the games for a softlist aren't supported
  if (!softlist.length) { 
    if (logExclusions) console.log(
      `INFO: Not printing soflist for ${softlistParams.name} because there are no working games`
    )
    return softlist
  }
  if (logPrinter) console.log(`INFO: printing softlist for ${softlistParams.name}`)
  const romdataHeader = `ROM DataFile Version : 1.1`
  const path = `./qp.exe` //we don't need a path for softlist romdatas, they don't use it, we just need to point to a valid file
  const mameRomdataLine = ({name, MAMEName, parentName, path, emu, company, year, comment}) => ( 
      `${name}¬${MAMEName}¬${parentName}¬¬${path}¬MAME ${emu}`
    + `¬${company}¬${year}¬¬¬¬¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬`
  )

  const retroarchRomdataLine = ({name, MAMEName, parentName, path, emu, company, year, comment}) => ( 
      `${name}¬${MAMEName}¬${parentName}¬¬${path}¬Retroarch ${emu} (MAME)`
    + `¬${company}¬${year}¬¬¬¬¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬` 
  )
  /*  1)  Display name, 2) _MAMEName, 3) _ParentName, 4) _ZipName, //Used Internally to store which file inside a zip file is the ROM
   *  5) _rom path //the path to the rom, 6) _emulator,7) _Company, 8) _Year, 9) _GameType, 10) _MultiPlayer, 11)  _Language
   * 12)  _Parameters : String, 13)  _Comment, 14)  _ParamMode : TROMParametersMode; //type of parameter mode
   * 15)  _Rating, 16)  _NumPlay, 17)  IPS start, 18)  IPS end, 19)  _DefaultGoodMerge : String; //The user selected default GoodMerge ROM */

  //for a system, takes the simple and homomorphic arrays of feature, info and sharedFeat and turns them into an array of comments to be printed
  const createComment = (commentCandidates) => {
    const comments = []  
    R.map(commentCandidate => {
      if (commentCandidate) { 
        R.map( item => {
          const nonJapItem = item.value.replace(/[^\x00-\x7F]/g, "")
          comments.push(`${item.name}:${nonJapItem}`)  
        }, commentCandidate) 
      }
    }, commentCandidates)
      
    return comments
  }
 
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


  const setRegionalEmu = (gameName, emuName, emuRegionalNames) => {

    //choose emu on a game-by-game basis
    const gameCountry = whichCountryIsThisGameFor(gameName) 
    let chosenEmulator = emuName //if it all goes wrong return default
    gameCountry? (
      emuRegionalNames? (
       logGames? console.log(`${gameName} is ${gameCountry} so use one of ${emuRegionalNames}`) : ''
        , chosenEmulator = chooseRegionalEmu(gameCountry, emuRegionalNames, gameName)
      ): logGames? console.log(`${gameName} only has one emu so use default ${emuName}`) : ''
    ) : logGames? console.log(`${gameName} doesnt need a regional emu, use default ${emuName}`) : ''
  
  return chosenEmulator
  
  }


  const chooseRegionalEmu = (gameCountry, emuRegionalNames, useTheDefaultEmulator) => {
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
    const emusTaggedByRegion = tagEmuRegion(emusTaggedByCountry)
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
    const emusTaggedByStandard = tagEmuStandard(emusTaggedByRegion)
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
  const tagEmuRegion = emusTaggedByCountry => {
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
  const tagEmuStandard = emusTaggedByRegion => {
    const node = {}
    const keys = R.keys(emusTaggedByRegion) //we encoded the region info as key, so get that out to compare
    R.map(emuRegion => {
      const tagStandard = whichStandardIsThisRegionFor(emuRegion) 
      if (tagStandard) node[tagStandard] = emusTaggedByRegion[emuRegion] //this time we have to look back at the region key in the passed in array and pick out its emulator
    }, keys)
    if (logRegions) console.log(`      ++++ Made a standard keyed emu list ${JSON.stringify(node)}`)
    
    return node
   
  }


  //sets the variables for a line of romdata entry for later injection into a romdata printer
  const applyRomdata = (obj, platform)  => R.map( obj => {

    const emuWithRegionSet = setRegionalEmu(obj.name, softlistParams.thisEmulator.emulatorName, softlistParams.thisEmulator.regions)

    const romParams = {
        name        : obj.name.replace(/[^\x00-\x7F]/g, "") //remove japanese
      , MAMEName    : obj.call
      , parentName  : obj.cloneof?  obj.cloneof : ``
      , path
      , emu         : emuWithRegionSet //we can't just use the default emu as many system's games are region locked. Hence all the regional code!
      , company     : obj.company.replace(/[^\x00-\x7F]/g, "")
      , year        : obj.year
      , comment     : createComment({ //need to loop through all three of feaures, info and shared feat to make comments, see the DTD    
          feature   : obj.feature
        , info      : obj.info
        , sharedFeat: obj.sharedFeat
      })
      
    }

    if (platform === `mame`) return mameRomdataLine(romParams)
    if (platform === `retroarch`) return retroarchRomdataLine(romParams)
    return console.error(`unsupported platform: ${platform}`)
  }, softlist)

  const mameRomdata             = applyRomdata(softlist,  `mame`)
  const retroarchRomdata        = applyRomdata(softlist,  `retroarch`)
  const mameRomdataToPrint      = R.prepend(romdataHeader, mameRomdata) 
  const retroarchRomdataToPrint = R.prepend(romdataHeader, retroarchRomdata) 

  mkdirp.sync(softlistParams.mameOutNamePath)
  mkdirp.sync(softlistParams.retroarchOutNamePath)
  
  /* I already did work to enable MAME icons in QuickPlay, so just print this folder config with each dat
   *   there are 2 systems which don't have icons in the set i want, so just write an icon file for everything */
  const iconTemplate = iconName => `[GoodMerge]
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
ChkLargeIcons=0
Directory=F:\\MAME\\EXTRAs\\icons

[BkGround]
ChkBk=0
TxtBKPath=

[Icon]
ChkIcon=1
CmbIcon=${iconName}.ico
`

  const machineMameName = softlistParams.thisEmulator.call
  fs.writeFileSync(`${softlistParams.mameOutNamePath}/folders.ini`,      iconTemplate(machineMameName))
  fs.writeFileSync(`${softlistParams.mameOutTypePath}/folders.ini`,      iconTemplate(machineMameName)) //last wins is fine
  fs.writeFileSync(`${softlistParams.mameOutRootDir}/folders.ini`,       iconTemplate(`Mess`)) //last wins is fine
  fs.writeFileSync(`${softlistParams.retroarchOutNamePath}/folders.ini`, iconTemplate(machineMameName))
  fs.writeFileSync(`${softlistParams.retroarchOutTypePath}/folders.ini`, iconTemplate(machineMameName)) //last wins is fine
  fs.writeFileSync(`${softlistParams.retroarchOutRootDir}/folders.ini`,  iconTemplate(`RetroArch`)) //last wins is fine
  //now print the romdata itself
  fs.writeFileSync(softlistParams.mameOutFullPath,      mameRomdataToPrint.join(`\n`),      `latin1`) //utf8 isn't possible at this time
  fs.writeFileSync(softlistParams.retroarchOutFullPath, retroarchRomdataToPrint.join(`\n`), `latin1`) //utf8 isn't possible at this time
  
  return softlist

}
