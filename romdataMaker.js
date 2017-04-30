"use strict"

const 
    fs             = require(`fs`)
  , path           = require(`path`)
  , XmlStream      = require(`xml-stream`)
  , R              = require(`Ramda`)
  , mkdirp         = require('mkdirp')
  , leven          = require(`Levenshtein`)

const
    rootDir        = `inputs/hash/`
  , filesInRoot    = fs.readdirSync(rootDir, 'utf8')

  , systemsJsonFile= fs.readFileSync(`outputs/systems.json`)
  , systems        = JSON.parse(systemsJsonFile)
  //TODO - you can append the DTD at the top of the file if it isn't being read correctly



//program flow at list level
R.pipe(
    callSheet
  , filterSoftlists
  , chooseDefaultEmus
  , makeSoftlists 
)(systems)

//program flow at emu level
function makeSoftlists(emuSystems) {
  R.map(emu => {
        const softlistParams = makeParams(emu)
        makeASoftlist(softlistParams.xml, function(softlist){
          const cleanedSoftlist = cleanSoftlist(softlist)
          printARomdata(cleanedSoftlist, softlistParams)
        })
      }, emuSystems)

}


//read the json for softlists and make a list of those xmls to find. Need to grab emu name also and pass it all the way down our pipeline
function callSheet(systems) {
  //filter by softlist
  const isSoftlist = obj => !!obj.softlist
  
  const filtered = R.pipe (
      R.filter(isSoftlist)
    //make a softlist subset of json, just those values we need. We'll add to it then
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


function filterSoftlists(softlistEmus) {

  /* Sometimes a softlist exists for a device that isn't supported in the version of mess e.g.: in mess 0.163, 
   *  a2600 doesn't have a cass, but there exists a cass softlist, which will silently fail if called. 
   *   So, try and get the device from the softlist name and check. Considerations:
   *     1) There's no point in looking in a softlist xml for devices it's about, unless you want to try and parse the free text 'name' field
   *     2) Some softlist names don't have a postfix, but we're assuming we don't 'need' the device name 
   *       (we can, we think, always call'nes smb' and we never need to 'nes -cart smb'. This needs confirming)
   *     3) some postfixes are not about the device - we've got _a1000, _workbench, _hardware
   *       (with a bit of luck most of these are unsupported or not games anyway, we'll need to make a list) */ 
  const addDeviceType = R.pipe(
      //grab the device or declare there is none specified
      R.map( obj => (R.assoc(`deviceTypeFromName`, obj.name.split(`_`)[1]? obj.name.split(`_`)[1] : `no_postfix`, obj)))
      //while we're at it, get the system type from the softlist name, we need it immediately and later
    , R.map( obj => (R.assoc(`systemTypeFromName`, obj.name.split(`_`)[0], obj)))
      //FM7's disk softlist breaks the  rule and is called 'disk'. They are just floppy images, they work fine
    , R.map( obj => (obj.deviceTypeFromName === `disk`? obj.deviceTypeFromName = `flop`: obj.deviceTypeFromName, obj))
      // I suspect all the nes softlist will run on all systems, essentially its postfixes aren't about mess `devices`
      // Note that the same isn't true for Famicom, as there seems to be a genuine problem that Famicoms don't have cass or flops
    , R.map( obj => (obj.systemTypeFromName === `nes`? obj.deviceTypeFromName = `no_postfix` : obj.deviceTypeFromName, obj))
      //I suspect the same is true of the superfamicom devices bspack and strom, these aren't device names in the same way as flop or cass
    , R.map( obj => (obj.systemTypeFromName === `snes`? obj.deviceTypeFromName = `no_postfix` : obj.deviceTypeFromName, obj))
  )(softlistEmus)

  
  //return a list of devices without the number in their briefname, so we can tell if the machine for a 'cart' softlist actually has a working 'cart' device
  const supportedDevices = deviceList => R.map(
    device => (
      R.head(device.split(/[0-9].*/))
    )
  , deviceList)

  //make a k-v in the object to tell us if the softlist we've made can actually run. If the softlist has no postfix, we assume it will run
  // (an example is a2600.xml as the softlist name, which if you read the text description says its for 'cart')
  const deviceExists = R.map( obj => (
        R.assoc(`doesSoftlistExist`, obj.deviceTypeFromName === `no_postfix`? true : R.contains(obj.deviceTypeFromName, supportedDevices(obj.device)) , obj)
  ), addDeviceType)

  //make exception or remove those softlists that say that the softlist device deosn't actually exist
  const alertProblemDevices = R.map( 
    obj => obj.doesSoftlistExist? obj : console.log(
        `DEVICE PROBLEM: ${obj.displayMachine} has a softlist called ${obj.name} but doesn't have a ${obj.deviceTypeFromName}`
      )
  , deviceExists)//TODO: lost of these are HDD and ROM - how does HDD load, perhaps it isn't a mess 'device'?
  
  // now remove them
  const removedProblemDevices = R.filter( obj => obj.doesSoftlistExist === true, deviceExists)

  //make a k-v telling us if list exists on disk - is the softlist found in the softlist directory
  const softlistFileExists = R.map( obj => (
      R.assoc(`doesSoftlistFileExist`, fs.existsSync("inputs/hash/" + obj.name + ".xml")? true : false , obj)
    )
  , removedProblemDevices)

  //alert those that dont exist
  const alertNonExistentSoftlistFile = R.map( 
    obj => obj.doesSoftlistFileExist==true? 
      obj : console.log(
        `FILE PROBLEM: ${obj.displayMachine} has a softlist called ${obj.name} but there's no file called "inputs/hash/${obj.name}.xml`
      )
    , softlistFileExists)
 
  //remove softlists with no softlist file in hashes dir
  const removedNonExistingLists = R.filter( obj => obj.doesSoftlistFileExist === true, softlistFileExists)

 
  /* The best match for many softlists will that the call for the machine matches the prefix of the softlist - a2600
   * There is then some utility to be gained for similarity in substrings. So rate the similarity */ 

  //get the edit distance of every softlist system to the softlist prefix
  const getDistance = (call,namePrefix) => {
    const l = new leven(call, namePrefix)
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
  const addedRatings =  R.map( obj => (R.assoc(`rating`, 50 + getDistance(obj.call, obj.systemTypeFromName), obj)), removedNonExistingLists)

  //now any emu that is a clone gets reduced in rating by 40 (problem here is we lose accuracy if there are clone trees, i'm not sure if there are)
    const deRateClones = R.map( obj => obj.cloneof? ( 
      obj.rating = obj.rating - 90
      , obj
    ): obj ,addedRatings)
  
  return deRateClones

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
        defaultEmus[emu.name]         = emu
      , softlistRatings[emu.name]     = emu.rating
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

  // add regional variant defaults - for each defaultEmu, check if it matches a regional regex
  // a problem we now have is some machines encode useful info Atari 2600 (NTSC) where some encode none Casio MX-10 (MSX1)
  // i think all those that do have a FILTER key...nope, turns out the filter key can't be relied on, atari 400 doen't have it
  // but clearly has a (NTSC) variant, let's just parse the emu or display name for (NTSC)
  const regionality = R.map(defaultEmu => { 
    const regionals = []
    const matchme = defaultEmu.emulatorName.match(/\(.*\)|only/) //actually this list is pretty good as it is ( it should contain all regions instead of that kleene)
      if (matchme) {
        console.log(defaultEmu.emulatorName + " is a match")
        //if it does, then look back in the rejected emus for those named the same except for the ()
        const nesRegex = defaultEmu.emulatorName.replace(/ \/ Famicom /,``)
        const snesRegex = nesRegex.replace(/ \/ Super Famicom /,``)
        const megadriveRegex = snesRegex.replace(/Genesis/,`Mega Drive`)
        const regex1 = megadriveRegex.replace(/PAL|NTSC only/,``)
        
        const regex = new RegExp(regex1.replace(/\(.*\)/,`(.*)`))//only relace first occurance
        console.log(regex)
        R.map(rejected => !!rejected.emulatorName.match(regex)? (
          console.log(`---->>>> matches ${rejected.emulatorName}`)
            //add them to a key "regions", but filter by softlist name otherwise Atari 800 (NTSC) -SOFTLIST a800 matches Atari 800 (PAL) -SOFTLIST a800_flop
          , defaultEmu.name === rejected.name ? (  regionals.push(rejected.emulatorName) 
          , console.log(regionals)): null
        )
        : null , rejectedEmus)
        regionals[0]? (
            //add the original emu name to the list here, it does help the picker logic later, even though NTSC is generally the default
            regionals.push(defaultEmu.emulatorName)
            //put the list in the default emulators object
          , defaultEmu.regions = regionals 
        ): null
        return defaultEmu
      }
  },defaultEmus)

  return defaultEmus //note this now keyed by softlist name, but it functions just the same.
}


function makeParams(emulator) {
  
  const //I like forward slashes in system type. System doesn't...
      systemType     = emulator.systemType?
      emulator.systemType.replace(/\//g, `-`) : console.log(`TYPE PROBLEM: ${emulator.displayMachine} doesn't have a system type to use as a potential folder name`) 
      //I like forward slashes in system names. System doesn't...and bloody apple again
      //(The apple specifics are only needed if the machine name is in any way going to be part of the filepath, so a temporary mesaure)
    , displayMachine1= emulator.displayMachine.replace(/\/\/\//g, `III`)
    , displayMachine2= displayMachine1.replace(/\/\//g, `II`)
    , displayMachine = displayMachine2.replace(/\//g, `-`)
    , name1          = emulator.name.replace(/\/\/\//g, `III`)
    , name2          = name1.replace(/\/\//g, `II`)

    , name           = name2.replace(/\//g, `-`)

    , thisEmulator   = emulator
    , stream         = fs.createReadStream(`inputs/hash/${name}.xml`)
    , xml            = new XmlStream(stream)
    , outRootDir     = `outputs/quickplay_softlists/`
    , outTypePath    = `${outRootDir}/${systemType}`
    , outNamePath    = `${outTypePath}/${name}` //to print out all systems you'd do ${displayMachine}/${name}`/
    , outFullPath    = `${outNamePath}/romdata.dat`
       
  return  ({ systemType, name, thisEmulator, stream, xml, outRootDir, outTypePath, outNamePath, outFullPath })

}  


function makeASoftlist(xml, callback){

  const softlist = []

  xml.collect(`info`)
  xml.collect(`sharedfeat`)
  xml.collect(`feature`)
  xml.on(`updateElement: software`, function(software) {
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
      node.call = software.$.name
      node.cloneof = software.$.cloneof
      node.name = software.description
      node.year = software.year
      node.company = software.publisher
      node.info = software.info
      node.sharedfeature = software.sharedfeat
      node.feature = software.part.feature
      node.loadsWith = software.part.$.interface //reserved js word
      softlist.push(node)
    }
  })
  xml.on(`end`, function(){
    // console.log(JSON.stringify(softlist, null, '\t')); process.exit()
    callback(softlist)
  })

}


/* I don't like working with a messy tree, lots of $ and needless repetition...With softlists it tuned
 *   out that we have three identically keyed objects, so a generic function will clean them all up
 */
function cleanSoftlist(softlist){
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
  const replacedFeature = replaceIfKey(`feature`, softlist)
  const replacedInfo    = replaceIfKey(`info`, replacedFeature)
  const replacedSharedFeat = replaceIfKey(`sharedFeat`, replacedInfo)

  return replacedSharedFeat
}

 
function printARomdata(softlist, softlistParams) {
  const romdataHeader = `ROM DataFile Version : 1.1`
  const path = `./qp.exe` //we don't need a path for softlist romdatas, they don't use it, we just need to point to a valid file
  const romdataLine = ({name, MAMEName, parentName, path, emu, company, year, comment}) =>
    ( `${name}¬${MAMEName}¬${parentName}¬¬${path}¬MESS ${emu}¬${company}¬${year}¬¬¬¬¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬` )

  /*  1)  Display name, 2) _MAMEName, 3) _ParentName, 4) _ZipName, //Used Internally to store which file inside a zip file is the ROM
   *  5) _rom path //the path to the rom, 6) _emulator,7) _Company, 8) _Year, 9) _GameType, 10) _MultiPlayer, 11)  _Language
   * 12)  _Parameters : String, 13)  _Comment, 14)  _ParamMode : TROMParametersMode; //type of parameter mode
   * 15)  _Rating, 16)  _NumPlay, 17)  IPS start, 18)  IPS end, 19)  _DefaultGoodMerge : String; //The user selected default GoodMerge ROM */

  //for a system, takes the simple and homomorphic arrays of feature, info and sharedFeat and turns them into an array of comments to be printed
  const createComment = (commentCandidates) => {
    const comments = []  
    R.map(commentCandidate => {
      commentCandidate? R.map(item => 
      comments.push(item.name + ":" + item.value)  , commentCandidate) : ''
    }, commentCandidates)
      
    return comments
  }
 
  /*because we often need the right regional machine for a game,  
   * MAME usually considers NTSC as the default, so we do too */
  //Logice for Euro and PAL are converse - Euro wants to come before all of its regions else one of those will get chosen at random? If there's no
  //Euro machine THEN look for regions. PAL however is always trumped by any region, its the last check
  const testRegion = R.cond([

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
    //we also need to say "if you find America but no USA game, look for a PAL game

  const whichRegionIsThisCountryFor = R.cond([
      [ country => country.match(
        /^(UK|French|Spanish|German|Spanish|Swedish|Finish|Danish|Hungarian|Norweigian|Netherlandic|Italian)$/
      ), region => `European` ]
    , [ country => country.match(/^(Japanese|Korean|Taiwanese)$/), region => `Asiatic` ]
  ])

  const whichStandardIsThisCountryFor = R.cond([
      [ country => country.match(/^(US|Asiatic)$/)  , standard => `NTSC` ]
    , [ country => country.match(/^(European|Arabian|Brazilian|Australian)$/), standard => `PAL` ]
  ])


  const setRegionalEmu = (gameName, emuName, emuRegionalNames) => {

    //choose emu on a game-by-game basis
    const gameRegion = testRegion(gameName) 
    gameRegion? (
      emuRegionalNames? (
      //  console.log(`${gameName} is ${gameRegion} so use one of ${emuRegionalNames}`)
         chooseRegionalEmu(gameRegion, emuRegionalNames)
      ): ''//console.log(`${gameName} only has one emu so use default ${emuName}`)
    ) : ''//console.log(`${gameName} doesnt need a regional emu, use default ${emuName}`)

    //look at the emus that could run this region
    //console.log(softlistParams.thisEmulator.emulatorName)
    //const emuResult = whichCountryIsThisEmuFor(softlistParams.thisEmulator.emulatorName)
    //emuResult? console.log(emuResult) : console.log(softlistParams.thisEmulator.emulatorName + " has no region")

  }


  const chooseRegionalEmu = (gameRegion, emuRegionalNames) => {
    //first get my region names for each of the regional emus
    const regions = R.map(obj => getEmuRegion(obj) , emuRegionalNames)
    const emuRegions = R.map( emu => R.keys(emu), regions) 
    //so now we have the basics of a decision node: LHS=region code RHS=region code choices
    console.log(`Game is ${gameRegion}, possible emus are ${emuRegions}` )
    //first: do we find a match?
    //then: do we have a regional match for a country?
    //then: fallback to PAL/NTSC - all regions/countries need this setting
    //lastly give up and choose default
  }

  const getEmuRegion = emuName => {
    const node = {}
    const tagRegion = whichCountryIsThisEmuFor(emuName)
    node[tagRegion] = emuName
    return node
  }

  //sets the variables for a line of romdata entry for later injection into a romdata printer
  const applyRomdata = obj => R.map( obj => {

setRegionalEmu(obj.name, softlistParams.thisEmulator.emulatorName, softlistParams.thisEmulator.regions)

        const romParams = {
        name : obj.name
      , MAMEName : obj.call
      , parentName : obj.cloneof?  obj.cloneof : ``
      , path : path
      , emu : softlistParams.thisEmulator.emulatorName //here's where we need to change this, it currently comes from the outside scope and its the sole reason why we pass softlistParams in
      , company : obj.company
      , year : obj.year
      , comment : createComment({ //need to loop through all three of feaures, info and shared feat to make comments, see the DTD    
          feature : obj.feature
        , info : obj.info
        , sharedFeat: obj.sharedFeat
      })
      
    }
   return romdataLine(romParams) 
  }, softlist)

  const romdata = applyRomdata(softlist)
  const romdataToPrint = R.prepend(romdataHeader, romdata) 

  mkdirp.sync(softlistParams.outNamePath)
  fs.writeFileSync(softlistParams.outFullPath, romdataToPrint.join(`\n`), `latin1`) //utf8 isn't possible at this time
  //console.log(JSON.stringify(softlist, null, '\t'))
  return softlist

}

