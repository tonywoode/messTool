'use strict'

const R = require('ramda')

module.exports = (systems) => {

  const spaceIsSeparator = ` `
  const oneWord = 1
  //the first two of these regexs are unique to this script. That's because, to describe a generic 
  //'space invaders' hardware,  it seems you have no option but to get company name in there
  const systemsAugmented = R.pipe(
      R.map(obj => R.assoc(`system`, obj.system.replace(
          new RegExp(`\\W\\(${obj.company.split(spaceIsSeparator, oneWord)}\\)`, `i`), ``
        ), obj //`Casio Game (Casio)` -> `Casio Game` 
      ))
    , R.map(obj => R.assoc(`system`, obj.system.replace(
          new RegExp(`${obj.company.split(spaceIsSeparator, oneWord)}\\W\\s`, `i`), ``
        ), obj  //`Casio Game (Casio, v12)` -> `Casio Game`
      )) 
    , R.map(obj => R.assoc(`system`, obj.system.replace(
          new RegExp(`${obj.company.split(spaceIsSeparator, oneWord)}\\W`, `i`), ``
        ), obj // `Casio Casio Mk3` ->`Casio Mk3`
      )) 
  )(systems)


  const compRep = (oldCompany, newCompany) => R.map( 
    obj => R.assoc(`company`, obj.company.replace(oldCompany, newCompany), obj) 
  )

  const systRep = (thisCompany, oldsystem, newsystem) => R.map( 
    obj => R.assoc(`system`, (obj.company.match(thisCompany) && obj.system.match(oldsystem))? 
      newsystem : obj.system, obj
    )
  )

 //transforms  
  const mungedSystems = R.pipe(

      compRep(/(<unknown>|<generic>)/, ``)
    , systRep(`Acorn`, /BBC/, `BBC`), systRep(`Acorn`, /Electron/, `Atom`)
    , compRep(`Hegener & Glaser Muenchen`, `Hegener & Glaser`)
    , compRep(`John L. Weinrich`, `Weinrich`)
    , compRep(`JAKKS Pacific Inc / HotGen Ltd`, `JAKKS / Hotgen`)
    , compRep(`Commodore Business Machines`, `Commodore`)
    , compRep(`Elector Electronics`, `Elektor`)
    , compRep(`APF Electronics Inc.`, `APF`)
    , compRep(`VEB Elektronik`, `VEB`)
    , compRep(`San Bergmans & Izabella Malcolm`, `Bergmans & Malcolm`)
    )(systemsAugmented)

  return mungedSystems
}
