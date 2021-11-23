const MAX_OLD_NEWS = 500 
const FL_POROG = .56 

const {DB_table} = require('../config/params');
const cityTbl = DB_table+(process.env.DEBUG?' DEBUG':'')

const AirtablePlus = require('airtable-plus');
const airAuth = {baseID: process.env.AIRTABLE_BASE,
    apiKey: process.env.AIRTABLE_KEY}

const lastDate = new AirtablePlus({  ...airAuth, tableName: cityTbl,
    transform: ({fields})=>fields.Created // делаем из этого архив заголовков
});
const cityData = new AirtablePlus({  ...airAuth, tableName: cityTbl,
    transform: ({fields})=>fields.title // делаем из этого архив заголовков
});
const stemsData = new AirtablePlus({  ...airAuth, tableName: 'StemsWght'});

const Airtable = require('airtable');
Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: process.env.AIRTABLE_KEY
});
const base = Airtable.base(process.env.AIRTABLE_BASE);

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
        if(e.title.endsWith('(ФОТО)')) e.title = e.title.split('(ФОТО)')[0].trim()            
        if(e.title.endsWith('(ВИДЕО)')) e.title = e.title.split('(ВИДЕО)')[0].trim()  

        for (var i = 0; i < oldNS.length; i++) // тут сравниваем нечетко с прошлыми заголовками 
            if(natural.DiceCoefficient(oldNS[i], e.title)>FL_POROG) return false
        if (excludeStarts.some(st=>e.title.startsWith(st))) return false
        
        return true  
    })
}

module.exports.getStems = async()=> {
    let fields = ['ru','uk','W', 'tag']
    try{         
        stm = await stemsData.read({fields}); 
        return stm.reduce((a,{id, fields:{ru, uk, W, tag}})=>{
            if (ru) {
                a['ru'][ru] = {W, id}
                if (tag) a['ru'][ru]['tag'] = '#'+tag
            }
            if (uk) {
                a['uk'][uk] = {W, id}
                if (tag) a['uk'][uk]['tag'] = '#'+tag
            }
            return a
        },{'ru':{},'uk':{}})

    } catch (err){ console.error('Airtable for stems ERR', err);}  
}

module.exports.saveNews = async(ns)=> {
    let by10 = ns.map(news=>({"fields":news}));
    try{  // API пишет только по 10 шт за раз
        for (var s = 0; s < by10.length; s+=10)
            await base(cityTbl).create(  by10.slice(s,s+10) , {typecast: true});
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
