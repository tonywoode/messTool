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
     print
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
    console.log(JSON.stringify(softlist, null, '\t'))
process.exit()
    callback(softlist)
  })

}
function print(softlist){
const tidyinfo = R.map( ({ call, cloneof, name, year, company, info, sharedfeature, feature, interfacer }) => ({ info:
  R.map( ({$}) => ( ({name:$.name, value:$.value  }) ),info)
}), softlist)
}
//function print(systems){
//// there doesn't seem to be a way to get multiple softlists in the output for a single system, and print their properties nicely against the object. So we'll do it oursleves...
//const printMe = R.map( ({ system, call, cloneof, softlist }) => ({ softlist: 
//  R.map( ({ $ }) => ( ({ name:$.name, status:$.status, filter:$.filter }) ), softlist )
//}),  systems)
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
  const romdataHeader = `ROM DataFile Version : 1.1`

//and a few random lines of a real romdata:
//CD-Rom System Card (v2.1)¬cdsys¬¬¬F:\MESS\Mess\roms\pce\cdsys.zip¬MESS PC Engine -CART¬Hudson¬19??¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬
//CD-Rom System Card (v2.0)¬cdsysa¬cdsys¬¬F:\MESS\Mess\roms\pce\cdsysa.zip¬MESS PC Engine -CART¬Hudson¬19??¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬
//CD-Rom System Card (v1.0)¬cdsysb¬cdsys¬¬F:\MESS\Mess\roms\pce\cdsysb.zip¬MESS PC Engine -CART¬Hudson¬19??¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬
//Champion Wrestler¬champwrs¬¬¬F:\MESS\Mess\roms\pce\champwrs.zip¬MESS PC Engine -CART¬Taito¬1990¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬
//Taito Chase H.Q.¬chasehq¬¬¬F:\MESS\Mess\roms\pce\chasehq.zip¬MESS PC Engine -CART¬Taito¬1990¬¬¬English¬pce -cart "%ROMMAME%" -now¬¬0¬1¬<IPS>¬</IPS>¬¬¬

