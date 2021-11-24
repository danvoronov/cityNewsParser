const {getNewsText, directURL, urlExist} = require('../parsers/get_news_text')
const {getStems} = require('../api/airtable_db');
// ====================================================================
const { SentimentManager, NlpUtil } = require('node-nlp');
const sentiment = new SentimentManager(); // ru uk

const { StemmerRu, StopwordsRu } = require('@nlpjs/lang-ru');
const { StemmerUk, StopwordsUk } = require('@nlpjs/lang-uk');
let stemmer = {
    "ru": new StemmerRu(),
    "uk": new StemmerUk()
}
stemmer['ru'].stopwords = new StopwordsRu();
stemmer['uk'].stopwords = new StopwordsUk();

let {detect} = require('tinyld'); 

function unique(arr) { if (!arr) return []
    var hash = {}, result = [];
    for ( var i = 0, l = arr.length; i < l; ++i ) {
        if ( arr[i] && !hash.hasOwnProperty(arr[i]) && !parseInt(arr[i])>0  ) { 
            hash[ arr[i] ] = true;
            result.push(arr[i]);
        }
    }
    return result;
}

// ====================================================================
const urlCheker = async (ns) => {
        ns.link = await directURL(ns.link)
        if (ns.link!='' && (await urlExist(ns.link))) {
            if (ns.lng!='uk') [ns.desc, ns.text] = await getNewsText(ns.source, ns.link)
            delete ns.image
            delete ns.subtitle            
            return ns
        }
        console.log(`❌ EMPTY or 404 for ${ns.title.slice(0,100)}`)  
        return null   
    }

// ====================================================================
const sl = [3,7,13] // score limits for indicator

const tScoreAndStems = async (t,default_lng) => { 
    let clean_t = unique(t.trim().replace(/<[^>]*>/ig, '')
            .match(/[a-zA-Zа-яА-ЯЁёЇїІіЄєҐґ'-]+/g)).join(' ').trim()
    if (!clean_t) return [null,null]              
    try{
        let lng = detect(clean_t)     
        if (lng!='ru'||lng!='uk') lng=default_lng
        return [(await sentiment.process(lng, clean_t)).score,
                stemmer[lng].tokenizeAndStem(clean_t, false)]
    } catch(err){ 
        console.log('ERR score and stems ON', clean_t, err)
        return [null,null]  
    }                     
}

const elScoring = async (e) => {
        let H_lems = [],D_lems = [],T_lems = [];

        [e.HS, H_lems] = await tScoreAndStems(e.title, e.lng);         
        if (e.desc) [e.DS, D_lems] = await tScoreAndStems(e.desc, e.lng);
        if (e.text) [e.TS, T_lems] = await tScoreAndStems(e.text, e.lng);
        
        let sc = e.HS+(e.DS?e.DS*0.45:0)+(e.TS?e.TS*0.05:0)

        e.stems = unique([].concat(H_lems, D_lems).map(w=>w.match(/[a-zA-Zа-яА-ЯЁёЇїІіЄєҐґ'-]+/g)))
        e.stmlink=[]
        e.tags=[]
        if (StemsWghts && StemsWghts[e.lng])
            sc += e.stems.reduce((acc,wrd)=>{
                    let s = StemsWghts[e.lng][wrd], add = 0;
                    if(s) {e.stmlink.push(s.id); e.tags.push(s.tag); add = s.W}
                    return acc+add
                }, 0);
        if (sc<-16) { //del not to cluttering DB
            console.log(`❌ DEL negative (${sc|0}): "${e.title.slice(0,120)}"`)
            return null
        }  

        e.score = sc.toFixed(1)
        e.stems = e.stems.join(', ')
        e.tags = unique(e.tags).join(' ')
        e.indicator = (sc<=0?(sc==0?'⚪️':'🔴'):(sc<=sl[0]?'🟡':(sc<=sl[1]?'💛':(sc<=sl[2]?'🟢':'💚'))))
        e.fresh = (e.time.includes('минут')?3:(e.time.includes('час')?2:(e.time.includes('дней')?0:1)))  
        return e
    }

// ========================================================================
let StemsWghts

module.exports = async(all_news)=>{  

    console.log('🤝 checking for sites status...')
    let filtred = (await Promise.all(all_news.map(urlCheker))).filter(Boolean)

    console.log('💈 geting additional weights...');
    StemsWghts = await getStems()
    
    console.log('⚖️ scoring the news...')
    return (await Promise.all(filtred.map(elScoring))).filter(Boolean)

}