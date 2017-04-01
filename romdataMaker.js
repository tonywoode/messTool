"use strict"

const 
    fs         = require(`fs`)
  , XmlStream  = require(`xml-stream`)
  , R          = require(`Ramda`)

const 
    stream     = fs.createReadStream(`inputs/hash/gamegear.xml`)
  , xml        = new XmlStream(stream)
  , romdataOutPath = (`outputs/romdata.dat`)

//program flow
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

function makeSoftlists(callback){
  const softlist = []

  xml.collect(`info`)
  xml.collect(`sharedfeat`)
  xml.collect(`feature`)
  xml.on(`updateElement: software`, function(software) {
    if (
        software.$.supported !== `no` 
      //these crap the list out after the dollar. perhaps path length + key may not exist...
//    &&  software.part.dataarea.rom.$.status  !== `baddump`
//    &&  software.part.dataarea.rom.$.status  !== `nodump`
 //   &&  software.part.diskarea.disk.$.status !== `baddump`
  //  &&  software.part.diskarea.disk.$.status !== `nodump`
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
      node.interfacer = software.part.$.interface
      softlist.push(node)
  }
  })
  xml.on(`end`, function(){
 //   console.log(JSON.stringify(softlist, null, '\t'))
//process.exit()
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

//console.log(JSON.stringify(softlist, null, '\t'))
//process.exit()
  const romdataHeader = `ROM DataFile Version : 1.1
  `
  const path = `./qp.exe` //we don't need a path for softlist romdatas, they don't use it, we just need to point to a valid file

  const romdataLine = (name, MAMEName, parentName, path, emu, company, year, comment) =>
  ( `${name}¬${MAMEName}¬${parentName}¬¬${path}¬${emu}¬${company}¬${year}¬¬¬¬${comment}¬0¬1¬<IPS>¬</IPS>¬¬¬` )
  
  var name, MAMEName, parentName, emu, company, year, comment
  
  const romdata = obj => R.map ( obj => {
  var name, MAMEName, parentName, emu, company, year, comment
        name = obj.name
      , MAMEName = obj.call
      , obj.cloneof?  parentName = obj.cloneof : parentName = ``
      , company = obj.company
      , year = obj.year
    //we'll need to loop through all three of feaures, info and shared feat to make comments, prob better as a separate function, or even bake into the object
     
   return romdataLine( name, MAMEName, parentName, path, `fake`, company, year, `fake`) 
  
  }, softlist)
  const romdataToPrint = romdata(softlist)
  
  console.log(romdataToPrint)
process.exit()

}
//console.log(JSON.stringify(printMe, null, '\t'))
//process.exit()
//}
//    _name, //this is the name used for display purposes
//  _MAMEName, //Used Internally mainly for managing MAME clones.
//  _ParentName, //Used Internally for storing the Parent of a Clone.
//  _ZipName, //Used Internally to store which file inside a zip file is the ROM
//  _path, //the path to the rom.
//  _emulator, //the Emulator this rom is linked to
//  _Company, //The company who made the game.
//  _Year,     //the year this ROM first came out
//  _GameType, //The type of game
//  _MultiPlayer,  //The type of Multiplayer game.
//  _Rating,   //A user rating.
//  _Language, //The language of this ROM
//  _Comment, //Any miscellaneous comments you might want to store.
//  _Parameters : String; //Any additional paramters to be used when running
//  _ParamMode : TROMParametersMode; //type of parameter mode
//  _NumPlay : integer;   //The amount of times this rom has been played
//  _DefaultGoodMerge : String; //The user selected default GoodMerge ROM
//

//and a few random lines of a real romdata:
//CD-Rom System Card (v2.1)¬cdsys¬¬¬F:\MESS\Mess\roms\pce\cdsys.zip¬MESS PC Engine -CART¬Hudson¬19??¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬
//CD-Rom System Card (v2.0)¬cdsysa¬cdsys¬¬F:\MESS\Mess\roms\pce\cdsysa.zip¬MESS PC Engine -CART¬Hudson¬19??¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬
//CD-Rom System Card (v1.0)¬cdsysb¬cdsys¬¬F:\MESS\Mess\roms\pce\cdsysb.zip¬MESS PC Engine -CART¬Hudson¬19??¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬
//Champion Wrestler¬champwrs¬¬¬F:\MESS\Mess\roms\pce\champwrs.zip¬MESS PC Engine -CART¬Taito¬1990¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬
//Taito Chase H.Q.¬chasehq¬¬¬F:\MESS\Mess\roms\pce\chasehq.zip¬MESS PC Engine -CART¬Taito¬1990¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬

