const {StopSrc, sCity, sExclude, hl, gl, timeframe} = require('../filter_params');
// ====================================================================
// https://devcenter.heroku.com/articles/scheduler
// https://www.npmjs.com/package/google-news-scraper
// ====================================================================
const googleNewsScraper = require('google-news-scraper');
module.exports.getNews4Google = async ()=>{
    
    console.log('NEWS for',sCity.toUpperCase())
    
    try{   /// == забераем новости с гугла   
        var newsScr = await googleNewsScraper({ timeframe,
            searchTerm: encodeURIComponent(sCity+" "+sExclude), prettyURLs: false,
            queryVars: { hl, gl}, // hl:"ru-RU" <== lang // gl:"UA" <=== location
            puppeteerArgs: [ '--no-sandbox', '--disable-setuid-sandbox'] 
            // need to pass flags 4 Heroku
        })
    } catch (err){ console.error('Scraper ERR!', err); return []} 

    const SREZ_DNEI = 5; // оставляем еще 5 дней тому

    return newsScr.filter(fl=>fl.time=='Вчера'||fl.time.includes('назад')).filter(fl=> !StopSrc.includes(fl.source) && !fl.title.startsWith('В Киеве тысячи людей') && !fl.title.startsWith('Курс валют') && !fl.title.includes(' може') && !fl.title.includes(' могу') && !fl.title.startsWith('Диван подождет')).filter(fl=>(fl.time.includes('дн')||fl.time.includes('день'))?(parseInt(fl.time)<=SREZ_DNEI):true)    
    
}