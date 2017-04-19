"use strict"

const 
    fs             = require(`fs`)
  , path           = require(`path`)
  , XmlStream      = require(`xml-stream`)
  , R              = require(`Ramda`)
  ,  mkdirp        = require('mkdirp')

const
    rootDir        = `inputs/hash/`
  , filesInRoot    = fs.readdirSync(rootDir, 'utf8')

  , systemsJsonFile= fs.readFileSync(`outputs/systems.json`)
  , systems        = JSON.parse(systemsJsonFile)
//TODO - you can append the DTD at the top of the file if it isn't being read correctly

//program flow
const softlists = callSheet(systems)
const filteredSoftlists = filterSoftlists(softlists)
const processing = processSoftlists(filteredSoftlists)

//read the json for softlists and make a list of those xmls to find. Need to grab emu name also and pass it all the way down our pipeline
function callSheet(systems) {
  const isSoftlist = obj => !!obj.softlist
  const filtered = R.pipe (
      R.filter(isSoftlist)
    //make a softlist subset of json: obligatory are obj/devices/systemType/emulatorName, call might be useful later, 
     // and display machine because when we split the softlists up to individual it won't be clear that a2600_cass and a2600_cart are both a2600
    , R.map(obj => ({
        displayMachine: obj.displayMachine
      , systemType    : obj.systemType
      , softlist      : obj.softlist
      , device        : obj.device
      , call          : obj.call
    }) )
  )(systems) 

  //we only need the device shortnames from device
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

      })
    , obj.softlist)
  , replaceDevice)

  //problem: softlist params are still array-ed to each machine: flatten the lot (rely on 'displayMachine' to link)
  const flattenedSoftlist = R.unnest(softlistKeyed)

  /* A problem we now have is that sometimes a softlist exists for a device that isn't supported in the version of mess
   * For instance in mess 0.163, a2600 doesn't have a cass, but there exists a cass softlist, which will silently fail
   * if called. That's why we carried devices down to here: try and get the device from the softlist name and check
   * Considerations  here are
   *   1) There's no point in looking in a softlist xml for devices it's about, unless you want to try and parse the free text 'name' field
   *   2) Some softlist names don't have a postfix, but we're assuming we don't 'need' the device name (we can, we think, always call
   *    'nes smb' and we never need to 'nes -cart smb'). This needs confirming
   *   3) some postfixes are not about the device - we've got _a1000, _workbench, _hardware, with a bit of luck most of these are unsupported
   *   or not games anyway, we'll need to make a list
   */ 
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
  )(flattenedSoftlist)

  
  //return a list of devices without the number in their briefname, so we can tell if the machine for a 'cart' softlist actually has a working 'cart' device
  const supportedDevices = deviceList => R.map(
    device => (
      R.head(device.split(/[0-9].*/))
    )
  , deviceList)

  //make a k-v in the object to tell us if the softlist we've made can actually run. If the softlist has no postfix, we assume it will run
  // (an example is a2600.xml as the softlist name, which if you read the text description says its for 'cart')
  const deviceExists = R.map(
    obj => (
        R.assoc(`doesSoftlistExist`, obj.deviceTypeFromName === `no_postfix`? true : R.contains(obj.deviceTypeFromName, supportedDevices(obj.device)) , obj)
    )
    , addDeviceType)


  //make exception or remove those softlists that say that the softlist device deosn't actually exist
  const alertProblemDevices = R.map( 
    obj => obj.doesSoftlistExist? 
      obj : 
      console.log(
        `DEVICE PROBLEM: ${obj.displayMachine} has a softlist called ${obj.name} but doesn't have a ${obj.deviceTypeFromName}`
      )
    , deviceExists)//TODO: lost of these are HDD and ROM - how does HDD load, perhaps it isn't a mess 'device'?
 
  
  // now remove them
  const removedProblemDevices = R.filter( obj => obj.doesSoftlistExist === true, deviceExists)

  //make a k-v telling us if list exists on disk - is the softlist found in the softlist directory
  const softlistFileExists = R.map(
    obj => (
        R.assoc(`doesSoftlistFileExist`, fs.existsSync("inputs/hash/" + obj.name + ".xml")? true : false , obj)
    )
    , removedProblemDevices)
//TODO: alert those that dont exist, as you've done above
  

  const alertNonExistentSoftlistFile = R.map( 
    obj => obj.doesSoftlistFileExist==true? 
      obj : 
      console.log(
        `FILE PROBLEM: ${obj.displayMachine} has a softlist called ${obj.name} but there's no file called "inputs/hash/${obj.name}.xml`
      )
    , softlistFileExists)
 
  //remove softlists with no softlist file in hashes dir
  const removedNonExistingLists = R.filter( obj => obj.doesSoftlistFileExist === true, softlistFileExists)

  //console.log(JSON.stringify(softlistFileExists, null,`\t`))
  //process.exit()
  
  return removedNonExistingLists
}

function filterSoftlists(softlists) {
  //first let's do the rating stuff, add a rating to each object and give it a default of 50
  const addedRatings =  R.map( obj => (R.assoc(`rating`, 50, obj)), softlists)
  
  
  /* next an unfortunately tricky bit. The best match for many softlists will that the display machine name contains the 
   *  largest consequtive substring of the first bit of the softlist name, so we need to find all permutations of the softlist
   *  name and see how many matches we get when comparing them all. Even a single char might be important (the 2 in msx2) but obv
   *  the more chars that match the better
   */

  //first we need to get all the substrings of the first bit of the softlist name
  function getAllSubstrings(str) {
    var i, j, result = [];

    for (i = 0; i < str.length; i++) {
      for (j = i + 1; j < str.length + 1; j++) {
        result.push(str.slice(i, j));
      }
    }
    return result;
  }

  //so for each object, we need to generate the possible substrings of systemTypeFromName
   
  const withSubstrings =  R.map( obj => (R.assoc(`substrings`, getAllSubstrings(obj.systemTypeFromName), obj)), softlists)

  //then compare that to displayMachine and simply count how many matches there are, and ffs that's a reduce!
  function howManyMatches(string, substringArray) {
    const contains = (accum, item ) => {
    const system = "ibm5150"
    const result =  system.includes(item)
      if (result) accum++
      return accum
    }
      const thingy =(R.reduce(contains, 0, substringArray))
   console.log(thingy) 
  }
  const array = (getAllSubstrings("ibm5150"))
  //a problem because a large word will get more matches, an exact match trumps anything else but then a nearly exact match does too
  howManyMatches("ibm5150", array)
 // console.log(JSON.stringify(withSubstrings, null,`\t`))

    process.exit()


  console.log(JSON.stringify(addedRatings, null,`\t`))
  process.exit()

  //the current array of system types from dataAndEfindMaker isn't an object, easier to just make one...
  const systemTypes = R.map( ({systemType}) => ({systemType}), softlists)
  const uniqueTypes = R.uniq(systemTypes)

  //make me a list of all machines that have this type
  const type = obj => obj.systemType === "Atari 400/600/800/1200/XE"
  const filterMePlease = R.filter( type, softlists)

  //of those machines, what softlists are supported?
  const listsOfThisType = R.map( ({name}) => ({name}), filterMePlease)
  const uniqListsOfThisType = R.uniq(listsOfThisType)

  //which machines from this type run the a400 softlist?
  const a800 = obj => obj.name === "a800"
  const whichRuns = R.filter( a800, filterMePlease)

  //a problem we now have is some machines encode useful info Atari 2600 (NTSC)
  //where some encode none Casio MX-10 (MSX1)
  //i think all those that do have a FILTER key...
  //nope, turns out the filter key can't be relied on, atarti 400 doen't have it
  //but clearly has a (NTSC) variant, let's just parse the emu or display name for (NTSC)
  

  //the ideal start of the tests for suitability for a softlist is that the largest subset of the name
  //of the softlist is included in the system so ie: the softlist a800 would match "Atari 800" over "Atari 400"
  // so we split 'a800' into an array, and we divide and conquer - we look for every subset ie a, 8, 0, 0, a8, 80, 00, a80, 800, a800 
  // and in this case finding 800 will rate something higher....
  //
  console.log(JSON.stringify(whichRuns, null,`\t`))
  process.exit()
}

function processSoftlists(softlists) {

  const makeMeOne = softlistNode => {
    //console.log("printing" + softlistNode.name
    //console.log(JSON.stringify(softlistNode,null,'\t'))
     // process.exit()

    const   
        //I like forward slashes in system type. System doesn't...
        systemType     = softlistNode.systemType?
          softlistNode.systemType.replace(/\//g, `-`) : console.log(`TYPE PROBLEM: ${softlistNode.displayMachine} doesn't have a system type to use as a potential folder name`) 
        //I like forward slashes in system names. System doesn't...and bloody apple again
        //This is only needed if the machine name is in any way going to be part of the filepath, so a temporary mesaure
      , displayMachine1= softlistNode.displayMachine.replace(/\/\/\//g, `III`)
      , displayMachine2= displayMachine1.replace(/\/\//g, `II`)
      , displayMachine = displayMachine2.replace(/\//g, `-`)
      , name1          = softlistNode.name.replace(/\/\/\//g, `III`)
      , name2          = name1.replace(/\/\//g, `II`)
      , name           = name2.replace(/\//g, `-`)
      , emulatorName   = softlistNode.emulatorName 
      , stream         = fs.createReadStream(`inputs/hash/${name}.xml`)
      , xml            = new XmlStream(stream)
      , outRootDir     = `outputs/quickplay_softlists/`
      , outTypePath    = `${outRootDir}/${systemType}`
      , outNamePath    = `${outTypePath}/${displayMachine}/${name}`
      , outFullPath    = `${outNamePath}/romdata.dat`
       
      const softlistParams = { 
        systemType     
      , name           
      , emulatorName           
      , stream         
      , xml           
      , outRootDir    
      , outTypePath   
      , outNamePath   
      , outFullPath   
       }
      
      //this reads and prints a softlist
      makeSoftlists(xml, function(softlist){
      const cleanedSoftlist = cleanSoftlist(softlist)
      const printed =  print(cleanedSoftlist, softlistParams)
      })
}
R.map(obj => makeMeOne(obj), softlists)
}

//File operations on the hash folder
function doFileOps(system) {

  const 
      getExtension = file => path.extname(file)
    , isXml = file => !!getExtension(file) === `.xml`
    , hashFiles = R.filter(isXml, filesInRoot)
    , getSystem = file => file.split(`_`)
    , hashesSplit = R.map(getSystem, hashFiles)
    , eachSystem = R.map(R.head, hashesSplit)//note for systems without a _ we are getting the whole filename still, need to drop after the dot
  console.log(eachSystem)

}

//function mockSoftlists(callback){
//  const 
//      input   = fs.readFileSync(`inputs/mockGamegearHashScrape.json`)
//   ,  systems = JSON.parse(input)
//  
//  callback(softlist, callback)
//}
//


function makeSoftlists(xml, callback){
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

function print(softlist, softlistParams){
  const romdataHeader = `ROM DataFile Version : 1.1`
  const path = `./qp.exe` //we don't need a path for softlist romdatas, they don't use it, we just need to point to a valid file

  const romdataLine = ({name, MAMEName, parentName, path, emu, company, year, comment}) =>
  ( `${name}¬${MAMEName}¬${parentName}¬¬${path}¬${emu}¬${company}¬${year}¬¬¬¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬` )

  /*  1) _name, //this is the name used for display purposes
   *  2) _MAMEName, //Used Internally mainly for managing MAME clones.
   *  3) _ParentName, //Used Internally for storing the Parent of a Clone.
   *  4) _ZipName, //Used Internally to store which file inside a zip file is the ROM
   *  5) _path, //the path to the rom.
   *  5) _emulator, //the Emulator this rom is linked to
   *  6) _Company, //The company who made the game.
   *  7) _Year,     //the year this ROM first came out
   *  8) _GameType, //The type of game
   *  9) _MultiPlayer,  //The type of Multiplayer game.
   * 10)  _Language, //The language of this ROM
   * 11)  _Parameters : String; //Any additional paramters to be used when running
   * 12)  _Comment, //Any miscellaneous comments you might want to store.
   * 13)  _ParamMode : TROMParametersMode; //type of parameter mode
   * 14)  _Rating,   //A user rating.
   * 15)  _NumPlay : integer;   //The amount of times this rom has been played
   * 16)  IPS start
   * 17)  IPS end
   * 18)  ?
   * 19)  _DefaultGoodMerge : String; //The user selected default GoodMerge ROM
   */

  //for a system, takes the simple and homomorphic arrays of feature, info and sharedFeat and turns them into an array of comments to be printed
  const createComment = (commentCandidates) => {
    const comments = []  
    R.map(commentCandidate => {
      commentCandidate? R.map(item => 
      comments.push(item.name + ":" + item.value)  , commentCandidate) : ''
    }, commentCandidates)
      //if (comments[0]) { console.log(comments)}
      return comments
  }

  //sets the variables for a line of romdata entry for later injection into a romdata printer
  const applyRomdata = obj => R.map ( obj => {
    const romParams = {
        name : obj.name
      , MAMEName : obj.call
      , parentName : obj.cloneof?  obj.cloneof : ``
      , path : path
      , emu : softlistParams.emulatorName
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
  
  console.log(JSON.stringify(softlist, null, '\t'))

  mkdirp.sync(softlistParams.outNamePath) 
  fs.writeFileSync(softlistParams.outFullPath, romdataToPrint.join(`\n`))
  //process.exit()

}
