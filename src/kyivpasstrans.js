const info_chanel = 'kyivpasstrans';
const NS_POROG = 430

const {parseChl} = require('./parsers/telegram_chnl');
const simpleHTML = require('./parsers/html2txt');
const {sendWoLink} = require('./api/telegram_api');

const countIn = (str, cnt) => (str.length - str.replace(new RegExp(cnt,"g"), "").length) / cnt.length

module.exports.getTGugaga = async () => { 

    let newPosts = await parseChl(info_chanel)

    for (var i = 0; i < newPosts.length; i++) {

        let clean_text = simpleHTML('<b>'+newPosts[i].content_html.replace(`<div class=\"tgme_widget_message_text js-message_text\" dir=\"auto\"><b><i class=\"emoji\" style=\"background-image:url('//telegram.org/img/emoji/40/E280BC.png')\"><b>‼️</b></i>Увага<i class=\"emoji\" style=\"background-image:url('//telegram.org/img/emoji/40/E280BC.png')\"><b>‼️</b></i>`, ""))

        clean_text = clean_text.slice(0,clean_text.indexOf("Перепрошуємо"))
        if(clean_text.indexOf("буде організовано")>-1) 
            clean_text = clean_text.slice(0,clean_text.indexOf("буде організовано"))+'...'
        else if (clean_text.length>NS_POROG) clean_text = clean_text.slice(0,NS_POROG)+'...'

        let b_closed = countIn(clean_text,"<b>")-countIn(clean_text,"</b>")
        clean_text += '</b>'.repeat(b_closed) // закрываем все теги что срезали
  
        // отключаем привью        
        sendWoLink(`<a href="${newPosts[i].url}">🚌   Київпастранс</a>\n\n${clean_text}`) 
    }

};