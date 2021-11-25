let Parser = require('rss-parser');
let parser = new Parser();

const {ru:{excludeCities}} = require('../config/filter');

let TimeAgo = require('javascript-time-ago')
TimeAgo.addDefaultLocale(require('javascript-time-ago/locale/ru'))
const timeAgo = new TimeAgo('ru-RU')

// ========================================================================
const BZHurl = 'https://bzh.life/feed';
const onlyKyiv = ({title, link})=>!title.includes('учшее за неделю')
            &&!excludeCities.some(city=>title.toLowerCase().includes(city))
            &&(link.startsWith('https://bzh.life/plany/')||link.startsWith('https://bzh.life/gorod/'))

module.exports.getBZHrss = async t => { console.log('Getting RSS from bzh.life')

  try {       

    let {items} = await parser.parseURL(BZHurl);

    return items.filter(onlyKyiv).map(({title,link,categories,isoDate}) => (
      {title,link,
        "time":timeAgo.format(new Date(isoDate)),
        "source":"БЖ",
        "lng": "ru"
      }))

  } catch (er) { console.error(`bzh.life RSS problem: ${er}`); return [] }

};





