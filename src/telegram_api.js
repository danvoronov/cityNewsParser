const got = require('got');
const chat_id = process.env.TELEGRAM_CHANEL_ID  // ID канала начинается с -

module.exports.sendWoLink = async(t)=> await sendToBot(t, true)

const cheerio = require('cheerio')
const fetch = require('node-fetch');
const urlExist = require("url-exist"); 

module.exports.postNews = async (el)=>{ 
    if (el.score<=0 || el.title =='' || el.link =='') return  
    var newsUrl = ''  
    try{ 
        const getURL = cheerio.load(await fetch(el.link).then(res => res.text()))
        newsUrl = getURL('c-wiz a[rel=nofollow]').attr('href')
    } catch (err){ newsUrl = el.link } // если не можем заресолвить полную

    let not404 = await urlExist(newsUrl)
    if (!not404) return console.log(`❌ 404 on ${newsUrl}`)

    let indicator = (el.score<=3?'🟡':(el.score<=7?'💛':(el.score<=13?'🟢':'💚')))
    await sendToBot(`${indicator} | ${el.time} |  <a href="${newsUrl}">🌐 ПЕРЕЙТИ</a>`)
    console.log(`✅ to TG ${el.title}`)
}

async function sendToBot (text, disable_web_page_preview) { 
    const json = { chat_id, text, 'parse_mode': 'HTML', disable_web_page_preview}
    try {
        const body = await got.post('https://api.telegram.org/bot' + process.env.TBOT_API + '/sendMessage', {json}).json();
        if (body.ok) return body.result;
    } catch (error) {
      console.error('Проблема с посылкой на бота:');
      console.error(json);
      console.error(error);
      return 0;
    }
}

module.exports.getTgJson = async (chanel_name) => { 
    const url = `https://wtf.roflcopter.fr/rss-bridge/?action=display&bridge=Telegram&username=${chanel_name}&format=Json`
    try {       
        return await got.get(url).json();
    } catch (er) { return console.error('Проблема получения JSON канала:', er)}
};