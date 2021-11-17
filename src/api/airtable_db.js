const MAX_OLD_NEWS = 500 
const FL_POROG = .56 

const {sCity} = require('../../filter_params');

const AirtablePlus = require('airtable-plus');
const airAuth = {baseID: process.env.AIRTABLE_BASE,
    apiKey: process.env.AIRTABLE_KEY}

const cityTbl = sCity+(process.env.DEBUG?' DEBUG':'')

const lastDate = new AirtablePlus({  ...airAuth, tableName: cityTbl,
    transform: ({fields})=>fields.Created // делаем из этого архив заголовков
});
const cityData = new AirtablePlus({  ...airAuth, tableName: cityTbl,
    transform: ({fields})=>fields.title // делаем из этого архив заголовков
});
const stemsData = new AirtablePlus({  ...airAuth, tableName: 'StemsWght',
    transform: ({id,fields})=>{StemsWght[fields.Stem]=fields.Weight; StemsID[fields.Stem]=id}
});

// ===========================================================================

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

//=========================================================
const excludeStarts = ['Клубный Киев', 'В Киеве тысячи людей', 'Курс валют', 'Диван подождет']

const natural = require('natural'); 
module.exports.exclOldNews = async(news)=> {
    try{   
        var oldNS = await cityData.read({ maxRecords: MAX_OLD_NEWS,
            fields: ['title'], // filterByFormula: 'score>0',
            sort: [{field: 'Created', direction: 'desc'}]
        })
    } catch (err){ console.error('Airtable for old news ERR', err); return []}   
       
    return news.filter(e=>{    
        if(e.title.endsWith('(ФОТО)')) e.title = e.title.split('(ФОТО)')[0]            
        if(e.title.endsWith('(ВИДЕО)')) e.title = e.title.split('(ВИДЕО)')[0]  

        for (var i = 0; i < oldNS.length; i++) // тут сравниваем нечетко с прошлыми заголовками 
            if(natural.DiceCoefficient(oldNS[i], e.title)>FL_POROG) return false
        if (!excludeStarts.some(st=>e.title.startsWith(st))) return false
        
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
    let by10 = ns.map(news=>({"fields":news}));
    try{  // API пишет только по 10 шт за раз
        for (var s = 0; s < by10.length; s+=10)
            await cityData.create( by10.slice(s,s+10) )
    } catch (err){ console.error('Airtable saveNews ERR', err); }   
}



//=====================================================

const tgChnl = new AirtablePlus({ baseID: process.env.AIRTABLE_BASE,
    apiKey: process.env.AIRTABLE_KEY, tableName: 'tgFilter'
})
module.exports.getTgPubData = async(tg_public)=> {
    try{   
        const res = await tgChnl.read({ maxRecords: 1, filterByFormula: `{chanel}='${tg_public}'`}),
        {id, fields} = res[0]
        return ({id, POSTS_FILTER: fields['start'], 
                    stop_ids: fields['ids']?fields['ids'].split(',').map(e=>+e):[]})
    } catch (err){ console.error('Airtable tgChnl ERR', err); return []}   
}
module.exports.setTgIds = async(_id, ids)=> {
    try{ await tgChnl.update(_id, {ids: ids.join(',')})
    } catch (err){ console.error('Airtable tgChnl update ERR', err); }     
}