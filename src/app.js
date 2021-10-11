const {StemsWght, StopSrc, sCity, sExclude, hl, gl, ceid, timeframe, maxPost} = require('./filter_params');

StemsWght[sCity] = 1 // поднимем если в заголовке есть город
console.log(sCity.toUpperCase())
// ====================================================================
// https://devcenter.heroku.com/articles/scheduler
// https://www.npmjs.com/package/google-news-scraper
// ====================================================================

const googleNewsScraper = require('google-news-scraper');
const { SentimentManager } = require('node-nlp');
const sentiment = new SentimentManager();
let natural = require('natural'); 

const Airtable = require('airtable');
Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: process.env.AIRTABLE_KEY
});
const base = Airtable.base(process.env.AIRTABLE_BASE);

// ====================================================================
const cheerio = require('cheerio')
const fetch = require('node-fetch');
const sendToBot = require('./telegram_api');

const toTelegram = async (el)=>{ if (el.score<=0) return    
    try{ 
        const getURL = cheerio.load(await fetch(el.link).then(res => res.text()))
        newsUrl = getURL('c-wiz a[rel=nofollow]').attr('href')
    } catch (err){ newsUrl = el.link }

    let indicator = (el.score<=3?'🟡':(el.score<=7?'🟢':(el.score<=13?'🟢🟢':'🟢🟢🟢')))
    await sendToBot(`${indicator}   ${el.time}    [👉 ПЕРЕЙТИ](${newsUrl})`)
}
// ====================================================================

const toDB = async (el)=>{
            let {score} = await sentiment.process('ru', el.title)

            let stems = natural.PorterStemmerRu.tokenizeAndStem(el.title)
            score += stems.reduce((acc,wrd)=>acc+(StemsWght[wrd]?StemsWght[wrd]:0),0);
            el.score = score
            el.stems = stems.join(' ')

            if (el.image) el.img = [{'url': el.image}]
            delete el.image
            delete el.subtitle

            base(sCity).create(el, function (err, records) { if (err) console.error(err, el);}) 
        }

(async()=>{
    try{   
        var news = await googleNewsScraper({ timeframe,
            searchTerm: encodeURIComponent(sCity+" "+sExclude), prettyURLs: false,
            queryVars: { hl, gl, ceid },
            puppeteerArgs: [ '--no-sandbox', '--disable-setuid-sandbox'] // need to pass flags 4 Heroku
        })
        // hl:"ru-RU", // язык
        // gl:"UA", // локация
        // ceid:"UA:ru" // говорят страна и язык
    } catch (err){ return console.log('Парсер ОШИБКА! '+err); }
    
    console.log('С API статей = '+news.length)
    
    let data = [];
    base(sCity).select({maxRecords: 300}).eachPage(function page(records, fetchNextPage) { records.forEach(({fields})=>data.push(fields)); fetchNextPage() }, async function done(err) { if (err) return console.log(err) 
  
        let filtred = news.filter(fl=> data.findIndex(art => (art.title===fl.title) && (art.source===fl.source))<0 && !StopSrc.includes(fl.source) && (fl.time == 'Вчера' || fl.time.includes('назад'))  )

        console.log('Осталось = '+filtred.length)

        for (var i = 0; i < filtred.length; i++) await toDB(filtred[i])

        filtred.sort((a, b) => b.score-a.score).slice(0,maxPost).forEach(toTelegram)

    }); 
})()