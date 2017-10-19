'use strict'

const XmlStream     = require('xml-stream')

//Parse the mame xml pulling out the fields we need but only from systems which actually work
module.exports = (mameXMLStream, callback) => {
  const systems = []
  
  const xml     = new XmlStream(mameXMLStream)
  //xml stream 'collects' these meaning it deals with repeating xml keys rather than overwriting each time
  xml.collect('device')
  xml.collect('softwarelist')
  xml.collect(`extension`) //turns out xml stream is just regexing these keys, so this is deeply-nested
  console.log(`Reading a very large xml file, patience...`) 
  xml.on(`updateElement: machine`, machine => {
    if ( //machine.softwarelist // we used to do this when doing retroarch, but it turned out life wasn't that simple after all....
         machine.device //this helps to narrow down on MESS machines vs Arcade games (lack of coin slots isn't quite enough, but this isn't enough either as many arcade machines had dvd drives)
      && machine.$.isdevice         === `no` //see the mame.exe (internal)  DTD which defaults to no: <!ATTLIST machine isdevice (yes|no) "no"> TODO: some home consoles didn't have devices...
      && machine.$.isbios           === `no` 
      && machine.$.ismechanical     === `no`
      && machine.$.runnable         === `yes`
      && !machine.input.$.coins
      //&& machine.driver.$.status  === `good` //I think this is some kind of intersection of the some or all of the below
      && machine.driver.$.emulation === `good`
      //&& machine.driver.$.color   === `good`
      //&& machine.driver.$.sound   === `good`
      //&& machine.driver.$.graphic === `good` //you want nes? don't turn this on....
    ) {
      const node    = {}
      node.company  = machine.manufacturer
      node.system   = machine.description 
      node.call     = machine.$.name
      node.cloneof  = machine.$.cloneof
      node.softlist = machine.softwarelist
      node.device   = machine.device
      systems.push(node)
    }
  })

  xml.on(`end`, () => {
    //fs.writeFileSync(`inputs/systems.json`, JSON.stringify(systems, null, `\t`)); process.exit()
    callback(systems)
  })

}
