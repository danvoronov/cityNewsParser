const googleNewsScraper = require('google-news-scraper');
// ====================================================================
// https://devcenter.heroku.com/articles/scheduler
// https://www.npmjs.com/package/google-news-scraper
// ====================================================================
let ss, tf, DF;
const days_and_src = fl=>( fl.time==tf.ystrd || fl.time.includes(tf.ago) ) // фильтр по дням
            &&( ( fl.time.includes('дн')||fl.time.includes('день') )?(parseInt(fl.time)<=DF):true)
            &&( !ss.includes(fl.source) )

module.exports = async ({StopSrc, timeFltr, sCity, sExclude, hl, gl, timeframe, daysFrame})=>{ 
    console.log('NEWS for',sCity.toUpperCase())
    ss = StopSrc;  tf = timeFltr; DF = daysFrame, lcode = hl.split('-')[0];

    try{   
        return (await googleNewsScraper({ timeframe,
            searchTerm: encodeURIComponent(sCity+" "+sExclude), prettyURLs: false,
            queryVars: { hl, gl}, // hl:"ru-RU" <== lang // gl:"UA" <=== location
            puppeteerArgs: [ '--no-sandbox', '--disable-setuid-sandbox'] 
            // need to pass flags 4 Heroku
        })).filter(days_and_src).map(n=>{n.lng=lcode; return n}) 

    } catch (err){ console.error('Scraper ERR!', err); return []} 

}