const config = require('./config/filter');

const getNewsFromGoogle = require('./parsers/googleNews')
const {getBZHrss} = require('./parsers/getRSS');
const reformator  = require('./processData/reformat2db')

const {saveNews, exclOldNews} = require('./api/airtable_db');
const {admNotify} = require('./api/telegram_api');

// ====================================================================

module.exports.getData = async()=>{  

    let news = await Promise.all([
        getNewsFromGoogle(config.ru), 
        getBZHrss()])
    console.log(`RES: from GoogleNS = ${news[0].length}, from RSS = ${news[1].length}`)
    news = news.flat() // mix all results to one arr
    if (news.length===0) return [] 

    let unicNews = await exclOldNews(news)    
    console.log('RES: without dub = '+unicNews.length)
    await admNotify(`🆕 <b>IN:</b> ${news.length} w/oDUB:${unicNews.length}`)
    if (unicNews.length===0) return [] 

    let enr = await reformator(unicNews)
    await saveNews(enr);

    return enr
}