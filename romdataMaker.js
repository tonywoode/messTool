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
function makeWishList(systems) {
//console.log(JSON.stringify(systems, null, '\t'))
 const isSoftlist = obj => !!obj.softlist
 const filtered = R.pipe (
  R.filter(isSoftlist)
 //the only props that we need are the softlists obj, devices, systemType and emulatorName
  , R.map(obj => ({ 
        systemType    : obj.systemType
      , softlist      : obj.softlist
      , device        : obj.device
  }) )
 )(systems) 


  //we only need the device shortnames from device
  const replaceDevice = R.map(
    obj => R.assoc(`device`, R.map(
      obj => obj.briefname, obj.device) 
    , obj)
  , filtered)

//  //merge the emu name into the softlist that it is representing
//  const mergeSoftlist = R.map(
//    obj => R.assoc(`emulatorName`, obj.emulatorNames, obj)
//    , replaceDevice)

  
  
  //convert that structure into one keyed by soflist (atm the machine is the organisational unit
  //const soflistKeyed = R.map(
  //  obj => R.map(
   //   emulatorName => ({
    ////    emulatorName  : obj.softlist.emulatorName
      //, systemType    : obj.systemType
     // , softlist      : obj.softlist
     // , device        : obj.device

    //  })
   // , obj.emulatorNames)
   // , replaceDevice)

  console.log(JSON.stringify(replaceDevice, null,`\t`))
  process.exit()
}

//program flow
makeWishList(systems)
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
