'use strict'

module.exports = (xml, callback) => {

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

