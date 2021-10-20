const info_chanel = 'kyivpasstrans';

const AirtablePlus = require('airtable-plus');
const tgChnl = new AirtablePlus({ baseID: process.env.AIRTABLE_BASE,
    apiKey: process.env.AIRTABLE_KEY, tableName: info_chanel,
    transform: ({fields})=>fields.postURL // делаем из этого список урл
})

const UVAGA = `<div class=\"tgme_widget_message_text js-message_text\" dir=\"auto\"><b><i class=\"emoji\" style=\"background-image:url('//telegram.org/img/emoji/40/E280BC.png')\"><b>‼️</b></i>Увага<i class=\"emoji\" style=\"background-image:url('//telegram.org/img/emoji/40/E280BC.png')\"><b>‼️</b></i>`;


const {sendWoLink, getTgJson} = require('./telegram_api');

module.exports.getTGugaga = async (chanel_name) => { 
    const {items}=await getTgJson(info_chanel)
    if (!items) return

    const flt = items.filter(fl=>fl.title.startsWith('‼️Увага‼️'))
    console.log(`С @${info_chanel} новостей = `+flt.length)
    if (flt.length==0) return

    try{   var stop_urls = await tgChnl.read({ 
        maxRecords: 10,  sort: [{field: 'Created', direction: 'desc'}]
    }) } catch (err){ return console.log('бд тг паблика ОШИБКА! '+err); }  

    for (var i = 0; i < flt.length; i++) {
        if (stop_urls.includes(flt[i].url)) continue // если уже запостили
        console.log(`С @${info_chanel} запостили = `+flt[i].url)
        let clean_text = '<b>'+flt[i].content_html.replace(UVAGA, "").replace('</div>', "").replace('<br/>Перепрошуємо за незручності.', "").replace('<br/><br/>Перепрошуємо', "").replace(' за  тимчасові  незручності', "").replace(/<br\/>/g, "\n")
        
        sendWoLink(`<a href="${flt[i].url}">🚌   Київпастранс</a>\n\n${clean_text}`) // отключаем привью
        try{ await tgChnl.create({"postURL":flt[i].url});
        } catch (err){ return console.log('бд тг запись ОШИБКА! '+err); }
    }  
};