const {maxPost} = require('../filter_params');
const {postNews, admNotify} = require('./api/telegram_api');
// const {isFromLastRun} = require('./api/airtable_db');

const {getTGugaga} = require('./kyivpasstrans');
const {getData} = require('./main');

// ====================================================================
const { SentimentManager } = require('node-nlp');
const sentiment = new SentimentManager();
let natural = require('natural'); 

// ====================================================================
// MAIN code
// =========
(async()=>{  
    
    // if (!process.env.DEBUG && !(await isFromLastRun(process.env.HOURS_BETWEEN))) {
    //     await admNotify('↔️ Parser halt due to time restriction.')
    //     return console.log(`< ${process.env.HOURS_BETWEEN} hours!`);   
    // }

    getTGugaga()   

    let pozitiv = (await getData()).filter(e=>e.score>0) // фильтруем только больше 0
    console.log('[>0 score] = '+pozitiv.length)   

    // проритет близости к сейчс
    //filtred[i].fresh = (filtred[i].time.includes('минут')?3:(filtred[i].time.includes('час')?2:(filtred[i].time.includes('дней')?0:1)))    

    await admNotify(`<b>🆗 ${pozitiv.length}</b>`)
    pozitiv.sort((a, b) => b.score-a.score || b.fresh-a.fresh ).slice(0,maxPost).forEach(postNews) // певые maxPost шлем в паблик

})()