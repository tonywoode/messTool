'use strict'

const R = require('ramda')

module.exports = systems => {

   //before we replace the clone systems with the system type they are cloned from, we need to get our type property together
  const systemsWithType = R.map(obj => 
    R.assoc(`systemType`, (obj.mungedCompany === `` || obj.mungedSystem === ``)? 
      `${obj.mungedSystem}`:`${obj.mungedCompany} ${obj.mungedSystem}`, obj
    ), systems 
  ) 
  // now our objects have something like the following keys  ({company, system, call, cloneof, mungedCompany, displayCompany, mungedSystem, systemType})

  //a function we'll pass in later that calls the clone system or reports a problem
  const lookupCall = (cloneof, call) =>  {
    const referredSystem = R.find( R.propEq(`call`, cloneof) )(systemsWithType)
    const originalSystem = R.find( R.propEq(`call`, call)    )(systemsWithType)
    
    return referredSystem === undefined ? ( 
        console.log(`PROBLEM: ${call} says its a (working) cloneof ${cloneof} but ${cloneof} is emulated badly. Setting system type to ${originalSystem.systemType}`) 
      , originalSystem.systemType
    ): referredSystem.systemType
  }

  //change the munged system of every machine that has a cloneof property to be the system that points to: should come at the end of munging system names
  const systemsDeCloned = R.map(obj => R.assoc(`systemType`, obj.cloneof? 
    lookupCall(obj.cloneof, obj.call) : obj.systemType, obj), systemsWithType)
  
  return systemsDeCloned

}
