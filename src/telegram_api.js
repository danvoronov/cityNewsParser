const got = require('got');
const chat_id = process.env.TELEGRAM_CHANEL_ID  // ID канала начинается с -

module.exports = async (text) => { 
    const json = { chat_id, text, 'parse_mode': 'Markdown'}
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