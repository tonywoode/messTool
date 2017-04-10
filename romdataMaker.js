"use strict"

const 
    fs             = require(`fs`)
  , path           = require(`path`)
  , XmlStream      = require(`xml-stream`)
  , R              = require(`Ramda`)

const
    rootDir        = `inputs/hash/`
  , filesInRoot    = fs.readdirSync(rootDir, 'utf8')
  , stream         = fs.createReadStream(`inputs/hash/gamegear.xml`)
  , xml            = new XmlStream(stream)
  , romdataOutDir  = `outputs/`
  , romdataOutPath = `${romdataOutDir}/romdata.dat`
  , systemsJsonFile= fs.readFileSync(`outputs/systems.json`)
  , systems        = JSON.parse(systemsJsonFile)
//TODO - you can append the DTD at the top of the file if it isn't being read correctly

//First task is to read the json for softlists and make ourselves a list of those xmls to find. We need to grab
//the emulator name at this point too and pass it all the way down our pipeline
function callSheet(systems) {
 const isSoftlist = obj => !!obj.softlist
 const filtered = R.pipe (
  R.filter(isSoftlist)
 //the only props that we need are the softlists obj, devices, systemType and emulatorName, call might be useful later, display machine
   //I took because when we split the softlists up to individual it won't be clear that a2500_cass and a2600_cart are both a2600
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

  //problem: softlist params are still array-ed to each machine
  //let's flatten the lot, but introduce 'displayMachine' back to the object should we still need to tell what's affiliated
  const flattenedSoftlist = R.unnest(softlistKeyed)
  

  /*
   * A problem we now have is that sometimes a softlist exists for a device that isn't supported in the version of mess
   * For instance in mess 0.163, a2600 doesn't have a cass, but there exists a cass softlist, which will silently fail
   * if called. That's why we carried devices down to here: try and get the device from the softlist name and check
   * Issues here are
   *   1) There's no point in lookiing in a softlist xml for devices it's about, unless you want to try and parse the free text 'name' field
   *   2) Some softlist names don't have a postfix, we can assume cart I think
   *   3) some postfixes are not about the device - we've got _a1000, _workbench, _hardware, with a bit of luck most of these are unsupported
   *   or not games anyway, we'll need to make a list
   */ 

  const addDeviceType = R.map(
    obj => (
       R.assoc(`deviceTypeFromName`,obj.name.split('_')[1]? obj.name.split('_')[1] : `cart`, obj)
    )
    ,flattenedSoftlist)

  //return a list of devices without the number in their briefname, so that we can tell if the machine
  //  for a 'cart' softlist actually has a working 'cart' device§
  const supportedDevices = (deviceList) => R.map(
   device => (
    R.head(device.split(/[0-9].*/))
   )
  , deviceList)

  //make a k-v in the object to tell us if the softlist we've made can actually run
  const deviceExists = R.map(
    obj => (
       R.assoc(`doesSoftlistExist`, R.contains(obj.deviceTypeFromName, supportedDevices(obj.device)) , obj)
    )
    , addDeviceType)


  // next job is to make an exception or remove those softlists that say that the softlist device deosn't actually exist
  //maybe we should name those which don't have a device at this point?
  const problemDevices = R.map(
    obj =>
      obj.doesSoftlistExist? null : console.log( `PROBLEM: ${obj.displayMachine} has a softlist for ${obj.deviceTypeFromName} but doesn't have a ${obj.deviceTypeFromName}`)
    , deviceExists)
  //TODO: lost of these are HDD - how does HDD load, perhaps it isn't a mess 'device'?
  //for now return the unfiltered list
  //
  return deviceExists
 // console.log(JSON.stringify(deviceExists, null,`\t`))
 // process.exit()
}

//program flow
callSheet(systems)
makeSoftlists(function(softlist){
  R.pipe(
    cleanSoftlist
    , print
  )(softlist)

})


//function mockSoftlists(callback){
//  const 
//      input   = fs.readFileSync(`inputs/mockGamegearHashScrape.json`)
//   ,  systems = JSON.parse(input)
//  
//  callback(softlist, callback)
//}
//

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

function makeSoftlists(callback){
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


//I don't like working with a messy tree, lots of $ and needless repetition...
// With softlists it tuned out that we have three identically keyed objects, so a generic
// function will clean them all up

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

function print(softlist){

  const romdataHeader = `ROM DataFile Version : 1.1`
  const path = `./qp.exe` //we don't need a path for softlist romdatas, they don't use it, we just need to point to a valid file

  const romdataLine = ({name, MAMEName, parentName, path, emu, company, year, comment}) =>
  ( `${name}¬${MAMEName}¬${parentName}¬¬${path}¬${emu}¬${company}¬${year}¬¬¬¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬` )

  /*  
   *  1) _name, //this is the name used for display purposes
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
      , emu : `fake`
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

  
  fs.writeFileSync(romdataOutPath, romdataToPrint.join(`\n`))
  process.exit()

}
