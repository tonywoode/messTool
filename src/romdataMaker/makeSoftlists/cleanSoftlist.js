'use strict'

const R = require('ramda')

/* I don't like working with a messy tree, lots of $ and needless repetition...With softlists it tuned
 *   out that we have three identically keyed objects, so a generic function will clean them all up
 *   TODO: you should be able to clean this up in the xml-stream pipeline
 */
module.exports = softlist => {
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
  const replacedFeature    = replaceIfKey(`feature`, softlist)
  const replacedInfo       = replaceIfKey(`info`, replacedFeature)
  const replacedSharedFeat = replaceIfKey(`sharedFeat`, replacedInfo)

  return replacedSharedFeat
}
