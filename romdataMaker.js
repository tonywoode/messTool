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
      node.interface = software.part.$.interface
      softlist.push(node)
  }
  })
  xml.on(`end`, function(){
    console.log(JSON.stringify(softlist, null, '\t'))
process.exit()
    callback(softlist)
  })

}


//function print(systems){
//// there doesn't seem to be a way to get multiple softlists in the output for a single system, and print their properties nicely against the object. So we'll do it oursleves...
//const printMe = R.map( ({ system, call, cloneof, softlist }) => ({ softlist: 
//  R.map( ({ $ }) => ( ({ name:$.name, status:$.status, filter:$.filter }) ), softlist )
//}),  systems)
//console.log(JSON.stringify(printMe, null, '\t'))
//process.exit()
//}
