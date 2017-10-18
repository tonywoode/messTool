'use strict'

const R = require('ramda')

module.exports = systems => {
  //not all devices have media, so we must check for null. Time to introduce maybe
  const flattenExtensions = extensions => {
    if (extensions) return R.map(extension => extension.$.name, extensions)
    return null
  }

  //note applySpec is currying in the device object without. You might want to key these by 'name' - see applySpec doc
  const template = R.applySpec({
    type       : R.path(['$', 'type']),
    tag        : R.path(['$', 'tag']),
    name       : R.path(['instance', '$', 'name']),
    briefname  : R.path(['instance', '$', 'briefname']),
    extensions : R.pipe(R.prop('extension'), flattenExtensions )
  })

  //Note that we fundamentally scrape the MAME xml for things that have devices so we don't need to check if they have a device element again
  //systems list -> system object -> device in object - nested looping into the devices key of one of the system objects
  const replaceDevice = R.map(
    obj => R.assoc(`device`, R.map(
      template, obj.device) //(you can always replace device => template(device) with just template)
    , obj)
  , systems)

  const removeUninterestingDevices = R.map(
    obj => R.assoc(`device`, R.filter(
      device => 
           device.type !== "printer" 
        && device.type !== "midiout" 
        && device.type !== "midiin" 
        && device.type !== "serial"
      , obj.device)
    , obj)
  , replaceDevice)
  
  return removeUninterestingDevices 

}
