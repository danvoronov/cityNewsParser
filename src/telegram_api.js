const got = require('got');
const chat_id = process.env.TELEGRAM_CHANEL_ID  // ID канала начинается с -

module.exports.sendLink = async (t)=> await sendToBot(t, false)
module.exports.sendWoLink = async(t)=> await sendToBot(t, true)

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