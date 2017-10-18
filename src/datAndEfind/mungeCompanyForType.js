'use strict'

const R = require('ramda')

module.exports = systems => {

  const systemsWithDisplayComp = R.pipe(

      //we need a new field to capture the name to display rather than munge to system type
      R.map(obj => R.assoc(`displayCompany`, obj.mungedCompany, obj))
      //get rid of company name for msx and call it msx
    , R.map(obj => R.assoc(`mungedCompany`, obj.mungedSystem.match(/MSX1/)? ``     : obj.mungedCompany, obj))
    , R.map(obj => R.assoc(`mungedSystem`,  obj.mungedSystem.match(/MSX1/)? `MSX`  : obj.mungedSystem,  obj))
      //MSX2 is similar but we want to keep its name
    , R.map(obj => R.assoc(`mungedCompany`, obj.mungedSystem.match(/MSX2/)? ``     : obj.mungedCompany, obj))
    , R.map(obj => R.assoc(`mungedSystem`,  obj.mungedSystem.match(/MSX2/)? `MSX2` : obj.mungedSystem,  obj))
      //now MSX has gone, every bracketed item is unnecessary
    , R.map(obj => R.assoc(`mungedSystem`,  obj.mungedSystem.replace(/\W\(.*\)/, ``), obj))
  )(systems)

  return systemsWithDisplayComp

}


