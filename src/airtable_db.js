const {sCity} = require('../filter_params');

const AirtablePlus = require('airtable-plus');
const airAuth = {baseID: process.env.AIRTABLE_BASE,
    apiKey: process.env.AIRTABLE_KEY}

const lastDate = new AirtablePlus({  ...airAuth, tableName: sCity,
    transform: ({fields})=>fields.Created // делаем из этого архив заголовков
});
const cityData = new AirtablePlus({  ...airAuth, tableName: sCity,
    transform: ({fields})=>fields.title // делаем из этого архив заголовков
});
const stemsData = new AirtablePlus({  ...airAuth, tableName: 'StemsWght',
    transform: ({id,fields})=>{StemsWght[fields.Stem]=fields.Weight; StemsID[fields.Stem]=id}
});


const MAX_OLD_NEWS = 300 
const FL_POROG = .8 

const natural = require('natural'); 
module.exports.exclOldNews = async(news)=> {
    try{   
        var oldNS = await cityData.read({ maxRecords: MAX_OLD_NEWS,
            fields: ['title'], // filterByFormula: 'score>0',
            sort: [{field: 'Created', direction: 'desc'}]
        })
    } catch (err){ console.error('Airtable for old news ERR', err); return []}   
    
    // тут сравниваем нечетко с прошлыми заголовками    
    return news.filter(e=>{                
        for (var i = 0; i < oldNS.length; i++) if(natural.DiceCoefficient(oldNS[i], e.title)>FL_POROG) return false
        return true  
    })
}

let StemsWght = {}
let StemsID = {}
module.exports.getStems = async()=> {
    StemsWght = {}
    StemsID = {}
    try{ await stemsData.read(); 
    } catch (err){ console.error('Airtable for stems ERR', err); return []}  
    return [StemsWght, StemsID]
}


module.exports.saveNews = async(ns)=> {
    delete ns.image
    delete ns.subtitle
    await cityData.create(ns)
}

module.exports.isFromLastRun = async(hours)=> {
     try{   
        var getDate = new Date((await lastDate.read({ maxRecords: 1, 
            fields: ['Created'], 
            sort: [{field: 'Created', direction: 'desc'}]
        }))[0])
    } catch (err){ console.error('Airtable for lastrun ERR', err);  return false}

    console.log('Time of last run:', getDate);

    return (Math.abs(getDate-new Date())>1000*60*60*hours)
}