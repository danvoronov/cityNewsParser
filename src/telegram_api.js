module.exports.postNews = async el => { 
    if (el.score<=0 || el.title =='' || el.link =='') return  
    if (await sendToBot(process.env.TELEGRAM_CHANEL_ID, `${el.indicator} | ${el.time} |  <a href="${el.link}">🌐 ПЕРЕЙТИ</a>`))
        console.log(`✅ Send to TG "${el.title}"`)
}

module.exports.getTgJson = async chanel_name => { 
    const tg_bridge = `https://wtf.roflcopter.fr/rss-bridge/?action=display&bridge=Telegram&username=${chanel_name}&format=Json`
    try {       
        return await got.get(tg_bridge).json();
    } catch (er) { return console.error(`${chanel_name} JSON problem: ${er}`)}
};

// ================================================================
const got = require('got');
async function sendToBot (chat_id, text, disable_web_page_preview) { 
    
    if (process.env.DEBUG) return console.log(`TG: ${chat_id} TEXT: ${text}`)

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

module.exports.admNotify = async t => await sendToBot(process.env.TELEGRAM_ADMIN_ID, t)
module.exports.sendWoLink = async t => await sendToBot(process.env.TELEGRAM_CHANEL_ID, t, true)
