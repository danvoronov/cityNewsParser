let Parser = require('rss-parser');
let parser = new Parser();

let TimeAgo = require('javascript-time-ago')
TimeAgo.addDefaultLocale(require('javascript-time-ago/locale/ru'))
const timeAgo = new TimeAgo('ru-RU')

const onlyKyiv = news => news.filter(({title})=>!title.includes('Львов')&&!title.includes('Винниц')&&!title.includes('Харьков')&&!title.includes('Одесс')&&!title.includes('Николаев')&&!title.includes('Мариуполь')&&!title.includes('Полтав')&&!title.includes('Чернигов')&&!title.includes('Тернопол')&&!title.includes('Славутич')&&!title.includes('учшее за неделю'))

module.exports.getBZHrss = async t => {
  console.log('Getting RSS from bzh.life/feed')
  try {       
    let {items} = await parser.parseURL('https://bzh.life/feed');
    // {item:{title,link,categories,isoDate}}
    return onlyKyiv(items).map(({title,link,categories,isoDate}) => ({title,link,
      "time":timeAgo.format(new Date(isoDate)),
      "source":"БЖ"
    }))
  } catch (er) { console.error(`bzh.life RSS problem: ${er}`); return [] }
};




