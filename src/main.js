const {getBZHrss} = require('./parsers/getRSS');
const getNews = require('./parsers/googleNews')
const {getNewsText, directURL, urlExist} = require('./parsers/get_news_text')

// ====================================================================
const { SentimentManager } = require('node-nlp');
const sentiment = new SentimentManager();

let natural = require('natural'); 
let {detect} = require('tinyld'); 

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
            filtred.splice(i, 1); continue 
        }

        try{
            filtred[i].stmlink=[] 
            let stems = await natural.PorterStemmerRu.tokenizeAndStem(filtred[i].title)
            filtred[i].stems = stems.join(' ')

            //==================

            let {score} = await sentiment.process('ru', filtred[i].title)
            filtred[i].HS = score

            score += stems.reduce((acc,wrd)=>{
                if(StemsID[wrd]) filtred[i].stmlink.push(StemsID[wrd])
                return acc+(StemsWght[wrd]?StemsWght[wrd]:0)
            },0);

            if (score<-6.5) { // оч негативные удаляем    
                console.log(`❌ DEL negative (${score}): "${filtred[i].title}"`)
                filtred.splice(i, 1); continue 
            }     
            filtred[i].score = score

            filtred[i].indicator = (score<=0?'🔴':(score<=3?'🟡':(score<=7?'💛':(score<=13?'🟢':'💚'))))
            if (score==0) filtred[i].indicator = '⚪️' // для теста серый

            delete filtred[i].image
            delete filtred[i].subtitle
            // ==============================

            const [desc, txt] = await getNewsText(filtred[i].source, filtred[i].link)

            if (txt) {
                filtred[i].TS = (await sentiment.process('ru', txt)).score
                filtred[i].text = txt
            }
            
            if (desc) {
                filtred[i].DS = (await sentiment.process(detect(desc), desc)).score
                filtred[i].desc = desc    
            }

        } catch(err){ console.log('ERR DS for', i) }      
    }

    return filtred.filter(Boolean)
}

module.exports.getData = async()=>{  

    let news = await getNews()
    console.log('News from Google API = '+news.length) 
    if (news.length===0) return []    

    let BZHnews = await getBZHrss()
    console.log('News from BZH = '+BZHnews.length) 

    let unicNews = await exclOldNews([...news, ...BZHnews])    
    console.log('[without dub] = '+unicNews.length)
    if (unicNews.length===0) return [] 

    await admNotify(`🆕 <b>IN:</b> ${news.length} w/oDUB:${unicNews.length}`)
    let enr = await processData(unicNews)

    await saveNews(enr);

    return enr
}