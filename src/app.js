const {StopSrc, sCity, sExclude, hl, gl, timeframe, maxPost} = require('../filter_params');

const {getTGugaga} = require('./telegram_chnl');
const {postNews} = require('./telegram_api');
const {saveNews , isFromLastRun, exclOldNews, getStems} = require('./airtable_db');

const SREZ_DNEI = 5;

// ====================================================================
const { SentimentManager } = require('node-nlp');
const sentiment = new SentimentManager();
let natural = require('natural'); 

// ====================================================================
// https://devcenter.heroku.com/articles/scheduler
// https://www.npmjs.com/package/google-news-scraper
// ====================================================================
const googleNewsScraper = require('google-news-scraper');
const getNews4Google = async ()=>{
    try{   /// == забераем новости с гугла   
        var newsScr = await googleNewsScraper({ timeframe,
            searchTerm: encodeURIComponent(sCity+" "+sExclude), prettyURLs: false,
            queryVars: { hl, gl}, // hl:"ru-RU" <== lang // gl:"UA" <=== location
            puppeteerArgs: [ '--no-sandbox', '--disable-setuid-sandbox'] // need to pass flags 4 Heroku
        })
    } catch (err){ console.error('Scraper ERR!', err); return []} 

    return newsScr.filter(fl=>fl.time=='Вчера'||fl.time.includes('назад')).filter(fl=> !StopSrc.includes(fl.source) && !fl.title.startsWith('В Киеве тысячи людей') && !fl.title.includes(' може') && !fl.title.includes(' могу') && !fl.title.startsWith('Диван подождет')).filter(fl=>(fl.time.includes('дн')||fl.time.includes('день'))?(parseInt(fl.time)<=SREZ_DNEI):true)    
}

// ====================================================================
// MAIN code
// =========
(async()=>{   console.log('NEWS for',sCity.toUpperCase())

    if (!process.env.DEBUG && !(await isFromLastRun(process.env.HOURS_BETWEEN))) 
        return console.log(`< ${process.env.HOURS_BETWEEN} hours!`);      

    let news = await getNews4Google()
    console.log('News from Google API = '+news.length) // оставляем еще 5 дней тому
    if (news.length===0) return

    let filtred
    if (!process.env.DEBUG) {
        filtred = await exclOldNews(news)    
        console.log('[old dub] Remain news = '+filtred.length)
        if (filtred.length===0) return  
    } else filtred = news


    // получаем веса слов из таблицы чтобы доп сокрить
    let [StemsWght, StemsID] = await getStems()
    if (!StemsWght || !StemsID) return

    for (var i = 0; i < filtred.length; i++) {
            let {score} = await sentiment.process('ru', filtred[i].title)

            let stems = natural.PorterStemmerRu.tokenizeAndStem(filtred[i].title)

            filtred[i].stmlink=[] 
            score += stems.reduce((acc,wrd)=>{
                if(StemsID[wrd]) filtred[i].stmlink.push(StemsID[wrd])
                return acc+(StemsWght[wrd]?StemsWght[wrd]:0)
            },0);
            filtred[i].score = score
            filtred[i].stems = stems.join(' ')

            if (!process.env.DEBUG) await saveNews(filtred[i]);

            // проритет близости к сейчс
            filtred[i].fresh = (filtred[i].time.includes('минут')?3:(filtred[i].time.includes('час')?2:(filtred[i].time.includes('дней')?0:1)))         
        }
    
    let pozitiv = filtred.filter(e=>e.score>0) // фильтруем только больше 0
    console.log('[>0 score] Remain news = '+pozitiv.length)

    pozitiv.sort((a, b) => b.score-a.score || b.fresh-a.fresh ).slice(0,maxPost).forEach(postNews) // певые maxPost шлем в паблик

    if (!process.env.DEBUG) await getTGugaga()   

})()