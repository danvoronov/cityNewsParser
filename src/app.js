const {StopSrc, sCity, sExclude, hl, gl, timeframe, maxPost} = require('./filter_params');
const MAX_OLD_NEWS = 300 
const FL_POROG = .65

let StemsWght = {}
let StemsID = {}

StemsWght[sCity] = 1 // поднимем если в заголовке есть город
console.log(sCity.toUpperCase())
// ====================================================================
// https://devcenter.heroku.com/articles/scheduler
// https://www.npmjs.com/package/google-news-scraper
// ====================================================================
const info_chanel = 'kyivpasstrans';

const airauth = {baseID: process.env.AIRTABLE_BASE,
    apiKey: process.env.AIRTABLE_KEY}

const AirtablePlus = require('airtable-plus');
const tgChnl = new AirtablePlus({ ...airauth, tableName: info_chanel,
    transform: ({fields})=>fields.postURL // делаем из этого список урл
});
const cityData = new AirtablePlus({  ...airauth, tableName: sCity,
    transform: ({fields})=>fields.title // делаем из этого архив заголовков
});
const stemsData = new AirtablePlus({  ...airauth, tableName: 'StemsWght',
    transform: ({id,fields})=>{StemsWght[fields.Stem]=fields.Weight; StemsID[fields.Stem]=id}
});

const googleNewsScraper = require('google-news-scraper');
const { SentimentManager } = require('node-nlp');
const sentiment = new SentimentManager();
let natural = require('natural'); 
const wuzzy = require('wuzzy')
// ====================================================================
const cheerio = require('cheerio')
const fetch = require('node-fetch');
const {sendLink, sendWoLink, getTgJson} = require('./telegram_api');

const toTelegram = async (el)=>{ 
    if (el.score<=0 || el.title =='' || el.link =='') return    
    try{ 
        const getURL = cheerio.load(await fetch(el.link).then(res => res.text()))
        newsUrl = getURL('c-wiz a[rel=nofollow]').attr('href')
    } catch (err){ newsUrl = el.link } // если не можем заресолвить полную

    let indicator = (el.score<=3?'🟡':(el.score<=7?'💛':(el.score<=13?'🟢':'💚')))
    await sendLink(`${indicator} | ${el.time} |  <a href="${newsUrl}">🌐 ПЕРЕЙТИ</a>`)
    console.log(`✅ to TG ${el.title}`)
}

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

const UVAGA = `<div class=\"tgme_widget_message_text js-message_text\" dir=\"auto\"><b><i class=\"emoji\" style=\"background-image:url('//telegram.org/img/emoji/40/E280BC.png')\"><b>‼️</b></i>Увага<i class=\"emoji\" style=\"background-image:url('//telegram.org/img/emoji/40/E280BC.png')\"><b>‼️</b></i>`;


async function getTGugaga(){

    const {items}=await getTgJson(info_chanel)
    if (!items) return

    const flt = items.filter(fl=>fl.title.startsWith('‼️Увага‼️'))
    console.log(`С @${info_chanel} новостей = `+flt.length)
    if (flt.length==0) return

    try{   var stop_urls = await tgChnl.read({ 
        maxRecords: 10,  sort: [{field: 'Created', direction: 'desc'}]
    }) } catch (err){ return console.log('бд тг паблика ОШИБКА! '+err); }  

    for (var i = 0; i < flt.length; i++) {
        if (stop_urls.includes(flt[i].url)) continue // если уже запостили
        let clean_text = '<b>'+flt[i].content_html.replace(UVAGA, "").replace('</div>', "").replace('<br/>Перепрошуємо за незручності.', "").replace('<br/><br/>Перепрошуємо', "").replace(' за  тимчасові  незручності', "").replace(/<br\/>/g, "\n")
        
        sendWoLink(`<a href="${flt[i].url}">🚌   Київпастранс</a>\n\n${clean_text}`) // отключаем привью
        try{ await tgChnl.create({"postURL":flt[i].url});
        } catch (err){ return console.log('бд тг запись ОШИБКА! '+err); }
    }  
}

(async()=>{  getTGugaga()      
    try{   /// == забераем новости с гугла   
        var news = await googleNewsScraper({ timeframe,
            searchTerm: encodeURIComponent(sCity+" "+sExclude), prettyURLs: false,
            queryVars: { hl, gl}, // hl:"ru-RU" == язык // gl:"UA", === локация
            puppeteerArgs: [ '--no-sandbox', '--disable-setuid-sandbox'] // need to pass flags 4 Heroku
        })
    } catch (err){ return console.log('Пюпитр ОШИБКА! '+err); }    
      
    news = news.filter(fl=> !StopSrc.includes(fl.source) && !fl.title.startsWith('В Киеве тысячи людей') && !fl.title.includes('могу') && !fl.title.startsWith('Диван подождет') && (fl.time=='Вчера'||fl.time.includes('назад'))).filter(fl=>!fl.time.endsWith('дней назад') || fl.time.startsWith('5'))
    console.log('С API новостей = '+news.length) // оставляем еще 5 дней тому
    if (news.length===0) return

    try{   
        var oldNS = await cityData.read({ maxRecords: MAX_OLD_NEWS,
            fields: ['title'], filterByFormula: 'score>0',
            sort: [{field: 'Created', direction: 'desc'}]
        })
    } catch (err){ return console.log('Доступ к старым заголовкам ОШИБКА! '+err); }   

    let filtred = news.filter(e=>{        
        for (var i = 0; i < oldNS.length; i++) if(wuzzy.levenshtein(oldNS[i], e.title)>FL_POROG) return false
        return true  
    })
    console.log('[airtable dub] Осталось = '+filtred.length)
    if (filtred.length===0) return
 
    try{ await stemsData.read(); 
    } catch (err){ return console.log('Доступ к стемам ОШИБКА! '+err); }     

    for (var i = 0; i < filtred.length; i++) await toDB(filtred[i])
    
    let pozitiv = filtred.filter(e=>e.score>0)
    console.log('[pozitiv] Осталось = '+pozitiv.length)

    pozitiv.sort((a, b) => b.score-a.score || b.fresh-a.fresh ).slice(0,maxPost).forEach(toTelegram)

})()