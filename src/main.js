const {getBZHrss} = require('./parsers/getRSS');
const getNews = require('./parsers/googleNews')
const {getNewsText, directURL, urlExist} = require('./parsers/get_news_text')

// ====================================================================
const { SentimentManager } = require('node-nlp');
const sentiment = new SentimentManager();

let natural = require('natural'); 

// ====================================================================
const {admNotify} = require('./api/telegram_api');
const {saveNews, exclOldNews, getStems} = require('./api/airtable_db');

// ====================================================================
// MAIN code
// =========

async function processData(filtred){
    // получаем веса слов из таблицы чтобы доп сокрить
    let [StemsWght, StemsID] = await getStems()
    if (!StemsWght || !StemsID) return [] 

    for (var i = filtred.length - 1; i >= 0; i--) {
    
        filtred[i].link = await directURL(filtred[i].link)
        if (filtred[i].link=='' || !(await urlExist(filtred[i].link)))  { 
            console.log(`❌ ${filtred[i].title} don't exist`)
            delete filtred[i]; continue 
        }

        filtred[i].stmlink=[] 
        let stems = await natural.PorterStemmerRu.tokenizeAndStem(filtred[i].title)
        filtred[i].stems = stems.join(' ')

        //==================

        let {score} = await sentiment.process('ru', filtred[i].title)
        filtred[i].sentiment = score

        score += stems.reduce((acc,wrd)=>{
            if(StemsID[wrd]) filtred[i].stmlink.push(StemsID[wrd])
            return acc+(StemsWght[wrd]?StemsWght[wrd]:0)
        },0);

        if (score<-5) { 
            await admNotify(`del: ${filtred[i].title} — ${score}`)
            delete filtred[i]; continue 
        } // оч негативные удаляем        

        // ==============================

        const [desc, txt] = await getNewsText(filtred[i].source, filtred[i].link)

        filtred[i].desc = desc
        filtred[i].text = txt

        if (filtred[i].text && filtred[i].text.length>140) 
            filtred[i].TS = (await sentiment.process('ru', filtred[i].text)).score        
        
        if (filtred[i].desc) {
            try{
                filtred[i].DS = (await sentiment.process('ru', filtred[i].desc)).score
            } catch(err){ console.log('ERR DS for', i) }
        }

        // ==============================

        filtred[i].score = score
        filtred[i].indicator = (score<=0?'🔴':(score<=3?'🟡':(score<=7?'💛':(score<=13?'🟢':'💚'))))
        if (score==0) filtred[i].indicator = '⚪️' // для теста серый
        
        await saveNews(filtred[i]);

        // проритет близости к сейчс
        filtred[i].fresh = (filtred[i].time.includes('минут')?3:(filtred[i].time.includes('час')?2:(filtred[i].time.includes('дней')?0:1)))         
    }

    return filtred
}

module.exports.getData = async()=>{  
    
    let news = await getNews()
    console.log('News from Google API = '+news.length) 
    if (news.length===0) return []    

    let BZHnews = await getBZHrss()
    console.log('News from BZH = '+BZHnews.length) 

    let unicNews = await exclOldNews([...news, ...BZHnews])    
    console.log('[old dub] Remain news = '+unicNews.length)
    if (unicNews.length===0) return [] 

    await admNotify(`FETCH: ${news.length} w/oDUB:${unicNews.length}`)

    return await processData(unicNews)
}