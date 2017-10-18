'use strict'

module.exports = (xml, callback) => {
  const systems = []
  
  xml.collect('device')
  xml.on(`updateElement: machine`, machine => {
    if ( 
         !machine.device 
      && machine.$.isdevice         === `no` 
      && machine.$.isbios           === `no` 
      && machine.$.ismechanical     === `no`
      && machine.$.runnable         === `yes`
      && !machine.input.$.coins
      //&& machine.driver.$.status  === `good` //I think this is some kind of intersection of the some or all of the below
      && machine.driver.$.emulation === `good`
      //&& machine.driver.$.color   === `good`
      //&& machine.driver.$.sound   === `good`
      //&& machine.driver.$.graphic === `good` 
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
    callback(systems)
  })

}

