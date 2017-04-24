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



//program flow
R.pipe(
    callSheet
  , filterSoftlists
  , processSoftlists
  , R.map(emu => {
      const softlistParams = makeParams(emu)
      makeASoftlist(softlistParams.xml, function(softlist){
        const cleanedSoftlist = cleanSoftlist(softlist)
        printARomdata(cleanedSoftlist, softlistParams)
      })
    })
)(systems)


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
   *  a2600 doesn't have a cass, but there exists a cass softlist, which will silently fail  if called. 
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
  
  //we forgot to use cloneof, let's get it out now. What we need is to say "if this machine has a cloneof, follow it and use that instead. This will HAVE to move AFTER the pal and ntsc checks for an individual game. It should probably form part of the rating process, for now just kill any objects that have a cloneof to see what the result is like
  const alertClones = R.map( obj => obj.cloneof? console.log(`${obj.displayMachine} is a clone of ${obj.cloneof}`) :  obj , addedRatings)
  const isClone = obj => !obj.cloneof
  const removedClones = R.filter(isClone, addedRatings)
  
  //process.exit()
return removedClones
  // a problem we now have is some machines encode useful info Atari 2600 (NTSC) where some encode none Casio MX-10 (MSX1)
  // i think all those that do have a FILTER key...nope, turns out the filter key can't be relied on, atari 400 doen't have it
  // but clearly has a (NTSC) variant, let's just parse the emu or display name for (NTSC)
}

/* We need to say 'before you write, check if you've already written a softlist with an emu
 *  that had a higher rating. if so don't write. We can achieve this by writing a `written` key in the object
 *  but that's not good enough we can't just have a bool because we need to know what the previous rating was for the softlist
 *  so we need to store an object structure liks "a2600" : "80" to know that for each softlist) */
function processSoftlists(softlistEmus) {

    const softlistRatings = {}, defaultEmus = {} , rejectedEmus = {}
  const decideWhetherToMakeMeOne = R.map( obj => {
  const decide = (rating, accum) => rating > accum? defaultEmus[obj.name] = obj : rejectedEmus[obj.name] = `${obj.emulatorName}  rating: ${rating}` 
 //TODO: its all side effects? but i use the return of this? 
    softlistRatings[obj.name]? decide(obj.rating, softlistRatings[obj.name]) : (
        defaultEmus[obj.name] = obj 
      , softlistRatings[obj.name] = obj.rating
    )
  }, softlistEmus)
  
  return defaultEmus
}




function makeParams(emulator) {
  
  const //I like forward slashes in system type. System doesn't...
      systemType     = emulator.systemType?
      emulator.systemType.replace(/\//g, `-`) : console.log(`TYPE PROBLEM: ${emulator.displayMachine} doesn't have a system type to use as a potential folder name`) 
      //I like forward slashes in system names. System doesn't...and bloody apple again
      //This is only needed if the machine name is in any way going to be part of the filepath, so a temporary mesaure
    , displayMachine1= emulator.displayMachine.replace(/\/\/\//g, `III`)
    , displayMachine2= displayMachine1.replace(/\/\//g, `II`)
    , displayMachine = displayMachine2.replace(/\//g, `-`)
    , name1          = emulator.name.replace(/\/\/\//g, `III`)
    , name2          = name1.replace(/\/\//g, `II`)
    , name           = name2.replace(/\//g, `-`)
    , emulatorName   = emulator.emulatorName
    , stream         = fs.createReadStream(`inputs/hash/${name}.xml`)
    , xml            = new XmlStream(stream)
    , outRootDir     = `outputs/quickplay_softlists/`
    , outTypePath    = `${outRootDir}/${systemType}`
    , outNamePath    = `${outTypePath}/${name}` //to print out all systems you'd do ${displayMachine}/${name}`/
    , outFullPath    = `${outNamePath}/romdata.dat`
       
  return  ({ systemType, name, emulatorName, stream, xml, outRootDir, outTypePath, outNamePath, outFullPath })
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

  //sets the variables for a line of romdata entry for later injection into a romdata printer
  const applyRomdata = obj => R.map( obj => {
    const romParams = {
        name : obj.name
      , MAMEName : obj.call
      , parentName : obj.cloneof?  obj.cloneof : ``
      , path : path
      , emu : softlistParams.emulatorName //here's where we need to change this, it currently comes from the outside scope and its the sole reason why we pass softlistParams in
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
  console.log(JSON.stringify(softlist, null, '\t'))
  return softlist

}

