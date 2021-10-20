const {StopSrc, sCity, sExclude, hl, gl, timeframe, maxPost} = require('./filter_params');
const MAX_OLD_NEWS = 500 
const FL_POROG = .65
const TIME_POROG = 1000*60*60*4

let StemsWght = {}
let StemsID = {}

StemsWght[sCity] = 1 // поднимем если в заголовке есть город
console.log(sCity.toUpperCase())
// ====================================================================
// https://devcenter.heroku.com/articles/scheduler
// https://www.npmjs.com/package/google-news-scraper
// ====================================================================
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

const googleNewsScraper = require('google-news-scraper');
const { SentimentManager } = require('node-nlp');
const sentiment = new SentimentManager();
let natural = require('natural'); 
const wuzzy = require('wuzzy')

const {postNews} = require('./telegram_api');
const {getTGugaga} = require('./telegram_chnl');

// ====================================================================

const toDB = async (el)=>{
            let {score} = await sentiment.process('ru', el.title)

            let stems = natural.PorterStemmerRu.tokenizeAndStem(el.title)

            el.stmlink=[] 
            score += stems.reduce((acc,wrd)=>{
                if(StemsID[wrd]) el.stmlink.push(StemsID[wrd])
                return acc+(StemsWght[wrd]?StemsWght[wrd]:0)
            },0);
            el.score = score
            el.stems = stems.join(' ')

            if (el.image) el.img = [{'url': el.image}]
            delete el.image
            delete el.subtitle

            await cityData.create(el);

            // проритет близости к сейчс
            el.fresh = (el.time.includes('минут')?3:(el.time.includes('час')?2:(el.time.includes('дней')?0:1)))            
        }

(async()=>{   
     try{   
        var getDate = new Date((await lastDate.read({ maxRecords: 1, 
            fields: ['Created'], 
            sort: [{field: 'Created', direction: 'desc'}]
        }))[0])
    } catch (err){ return console.log('Запрос на airtable ОШИБКА! '+err); }

    console.log('Время прошлого запроса:', getDate);
    if (Math.abs(getDate-new Date())<TIME_POROG) return console.log('< 4 часов');    

    getTGugaga()    

    try{   /// == забераем новости с гугла   
        var news = await googleNewsScraper({ timeframe,
            searchTerm: encodeURIComponent(sCity+" "+sExclude), prettyURLs: false,
            queryVars: { hl, gl}, // hl:"ru-RU" == язык // gl:"UA", === локация
            puppeteerArgs: [ '--no-sandbox', '--disable-setuid-sandbox'] // need to pass flags 4 Heroku
        })
    } catch (err){ return console.log('Scraper ОШИБКА! '+err); }    
      
    news = news.filter(fl=> !StopSrc.includes(fl.source) && !fl.title.startsWith('В Киеве тысячи людей') && !fl.title.includes(' може') && !fl.title.includes(' могу') && !fl.title.startsWith('Диван подождет') && (fl.time=='Вчера'||fl.time.includes('назад'))).filter(fl=>!fl.time.endsWith('дней назад') || fl.time.startsWith('5'))
    console.log('С Gogole шт = '+news.length) // оставляем еще 5 дней тому
    if (news.length===0) return

    try{   
        var oldNS = await cityData.read({ maxRecords: MAX_OLD_NEWS,
            fields: ['title'], // filterByFormula: 'score>0',
            sort: [{field: 'Created', direction: 'desc'}]
        })
    } catch (err){ return console.log('Доступ к старым заголовкам ОШИБКА! '+err); }   
    // тут сравниваем нечетко с прошлыми заголовками
    let filtred = news.filter(e=>{        
        for (var i = 0; i < oldNS.length; i++) if(wuzzy.levenshtein(oldNS[i], e.title)>FL_POROG) return false
        return true  
    })
    console.log('[> old dub] осталось шт = '+filtred.length)
    if (filtred.length===0) return
 
    // получаем веса слов из таблицы чтобы доп сокрить
    try{ await stemsData.read(); 
    } catch (err){ return console.log('Доступ к стемам ОШИБКА! '+err); }     

    for (var i = 0; i < filtred.length; i++) await toDB(filtred[i]) // скорим
    
    let pozitiv = filtred.filter(e=>e.score>0) // фильтруем только больше 0
    console.log('[> pozitiv] осталось шт = '+pozitiv.length)

    pozitiv.sort((a, b) => b.score-a.score || b.fresh-a.fresh ).slice(0,maxPost).forEach(postNews) // певые maxPost шлем в паблик

})()