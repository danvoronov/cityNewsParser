const got = require('got');
const $ = require('cheerio')

const urlExist= async checkUrl => {
    const response = await got.head(checkUrl,{throwHttpErrors: false, retryCount:1})
    return response !== undefined && !/4\d\d/.test(response.statusCode) // !== 401 402 403 404
}


module.exports.postNews = async el => { if (el.score<=0 || el.title =='' || el.link =='') return  
    let newsUrl = el.link  
    try{ 
        const {body} = await got(el.link)
        const getRealURL = $.load(body)('c-wiz a[rel=nofollow]').attr('href') 
        if (getRealURL.startsWith('http')) {
            if (await urlExist(getRealURL)) newsUrl = getRealURL
                else return console.log(`❌ 404 on ${getRealURL}`)
        } else console.log(`❌ ${getRealURL} not url`)
    } catch (err){ 
        console.log(i,`Some ERR on getting real URL from ${el.link}`) 
    } 

    let indicator = (el.score<=3?'🟡':(el.score<=7?'💛':(el.score<=13?'🟢':'💚')))
    if (!process.env.DEBUG) 
        await sendToBot(`${indicator} | ${el.time} |  <a href="${newsUrl}">🌐 ПЕРЕЙТИ</a>`)
    console.log(`✅ Send to TG "${el.title}"`)
}


module.exports.getTgJson = async chanel_name => { 
    const tg_bridge = `https://wtf.roflcopter.fr/rss-bridge/?action=display&bridge=Telegram&username=${chanel_name}&format=Json`
    try {       
        return await got.get(tg_bridge).json();
    } catch (er) { return console.error(`${chanel_name} JSON problem: ${er}`)}
};

// ================================================================

const chat_id = process.env.TELEGRAM_CHANEL_ID  // ID канала начинается с -
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

module.exports.sendWoLink = async t => await sendToBot(t, true)
