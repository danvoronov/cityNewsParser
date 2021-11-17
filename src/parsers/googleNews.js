const {StopSrc, sCity, sExclude, hl, gl, timeframe, daysFrame} = require('../config/filter_params');
// ====================================================================
// https://devcenter.heroku.com/articles/scheduler
// https://www.npmjs.com/package/google-news-scraper
// ====================================================================
const days_and_src = fl=>( fl.time=='Вчера' || fl.time.includes('назад') ) // фильтр по дням
            &&( ( fl.time.includes('дн')||fl.time.includes('день') )?(parseInt(fl.time)<=daysFrame):true)
            &&( !StopSrc.includes(fl.source) )

const googleNewsScraper = require('google-news-scraper');
module.exports = async ()=>{ console.log('NEWS for',sCity.toUpperCase())
    
    try{   /// == забераем новости с гугла   
        return (await googleNewsScraper({ timeframe,
            searchTerm: encodeURIComponent(sCity+" "+sExclude), prettyURLs: false,
            queryVars: { hl, gl}, // hl:"ru-RU" <== lang // gl:"UA" <=== location
            puppeteerArgs: [ '--no-sandbox', '--disable-setuid-sandbox'] 
            // need to pass flags 4 Heroku
        })).filter(days_and_src)   
    } catch (err){ console.error('Scraper ERR!', err); return []} 

}