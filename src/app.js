const {getBZHrss} = require('./parsers/getRSS');
const getNews = require('./parsers/googleNews')
const {getNewsText, getRealURL} = require('./parsers/get_news_text')

const {getTGugaga} = require('./kyivpasstrans');

const {maxPost} = require('../filter_params');
const {postNews, admNotify} = require('./api/telegram_api');
const {saveNews , isFromLastRun, exclOldNews, getStems} = require('./api/airtable_db');

// ====================================================================
const { SentimentManager } = require('node-nlp');
const sentiment = new SentimentManager();
let natural = require('natural'); 

// ====================================================================
// MAIN code
// =========
(async()=>{  
    
    if (!process.env.DEBUG && !(await isFromLastRun(process.env.HOURS_BETWEEN))) {
        await admNotify('↔️ Parser halt due to time restriction.')
        return console.log(`< ${process.env.HOURS_BETWEEN} hours!`);   
    }

    getTGugaga()   

    let news = await getNews()
    console.log('News from Google API = '+news.length) 
    if (news.length===0) return    
    let BZHnews = await getBZHrss()
    console.log('News from BZH = '+BZHnews.length) 

    filtred = await exclOldNews([...news, ...BZHnews])    
    console.log('[old dub] Remain news = '+filtred.length)
    if (filtred.length===0) return  

    // получаем веса слов из таблицы чтобы доп сокрить
    let [StemsWght, StemsID] = await getStems()
    if (!StemsWght || !StemsID) return


    for (var i = filtred.length - 1; i >= 0; i--) {

        if (filtred[i].source!='БЖ') filtred[i].link = await getRealURL(filtred[i].link)
        if (filtred[i].link=='') { delete filtred[i]; continue }

        const [desc, txt] = await getNewsText(filtred[i].source, filtred[i].link)

        filtred[i].desc = desc
        filtred[i].text = txt

        if (filtred[i].text && filtred[i].text.length>140) 
            filtred[i].TS = (await sentiment.process('ru', filtred[i].text)).score

        let {score} = await sentiment.process('ru', filtred[i].title)
        filtred[i].sentiment = score

        let stems = await natural.PorterStemmerRu.tokenizeAndStem(filtred[i].title)
        filtred[i].stems = stems.join(' ')

        filtred[i].stmlink=[] 
        score += stems.reduce((acc,wrd)=>{
            if(StemsID[wrd]) filtred[i].stmlink.push(StemsID[wrd])
            return acc+(StemsWght[wrd]?StemsWght[wrd]:0)
        },0);
        filtred[i].score = score
        filtred[i].indicator = (score<=0?'🔴':(score<=3?'🟡':(score<=7?'💛':(score<=13?'🟢':'💚'))))
        if (score==0) filtred[i].indicator = '⚪️' // для теста серый

        if (score<-5) { delete filtred[i]; continue } // оч негативные удаляем
        
        await saveNews(filtred[i]);

        // проритет близости к сейчс
        filtred[i].fresh = (filtred[i].time.includes('минут')?3:(filtred[i].time.includes('час')?2:(filtred[i].time.includes('дней')?0:1)))         
    }

    let pozitiv = filtred.filter(e=>e.score>0) // фильтруем только больше 0
    console.log('[>0 score] Remain news = '+pozitiv.length)    

    await admNotify(`API:${news.length} w/oDUB:${filtred.length} <b>_OK: ${pozitiv.length}</b>`)
    pozitiv.sort((a, b) => b.score-a.score || b.fresh-a.fresh ).slice(0,maxPost).forEach(postNews) // певые maxPost шлем в паблик

})()