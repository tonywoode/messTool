'use strict'

const R = require('ramda')

//I don't like working with a messy tree, lots of $ and needless repetition...
module.exports = function cleanSoftlists(systems) {

  //I removed the destructuring elsewhere but here the object isn't going to grow
  const flattenSoftlist = softlist  => 
    R.map( ({ $ }) => 
     ( ({ name:$.name, status:$.status, filter:$.filter }) )
    , softlist )

  //if the system has a softlist, clear up its object: the thing we scraped wasn't nice
  const replaceIfSoftlist = R.map(obj => obj.softlist? 
    obj.softlist = R.assoc(`softlist`, flattenSoftlist(obj.softlist), obj) : obj
  , systems )

  return replaceIfSoftlist
}

