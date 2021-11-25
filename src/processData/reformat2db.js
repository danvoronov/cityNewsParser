const {getNewsText, directURL, urlExist} = require('../parsers/get_news_text')
const {getStems} = require('../api/airtable_db');

const {dbSntThreshold, indBins, D_COEF, T_COEF} = require('../config/params');
const {stopWords} = require('../config/sentiment/stopWords');
// ====================================================================
const { SentimentManager, NlpUtil, Language } = require('node-nlp');
const sentiment = new SentimentManager(), language = new Language();

const { StemmerRu, StopwordsRu } = require('@nlpjs/lang-ru');
const { StemmerUk, StopwordsUk } = require('@nlpjs/lang-uk');
let stemmer = { "ru": new StemmerRu(), "uk": new StemmerUk() }

stemmer['ru'].stopwords = new StopwordsRu();
stemmer['uk'].stopwords = new StopwordsUk();
for (ln in stemmer) stemmer[ln].stopwords.dictionary =  // inject own stopwords
    Object.fromEntries(stopWords.sg.concat(stopWords[ln]).map(w=>[w,true]))

// ====================================================================
function unique(arr) { if (!arr) return []
    var hash = {}, result = [];
    for ( var i = 0, l = arr.length; i < l; ++i ) {
        if ( arr[i] && !hash.hasOwnProperty(arr[i]) && !parseInt(arr[i])>0  ) { 
            let e = (arr[i]=='ки'||arr[i]=='киевск'||arr[i]=='київск')?'К':arr[i]
            hash[ e ] = true;
            result.push(e);
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

const tScoreAndStems = async (t,default_lng) => {  
    let clean_t = t.replace(/<[^>]*>|"|“|”|«|»/ig, '').trim() // remove HTML tags and "
    if (!clean_t) return [null,null]          
    try{
        let {score, alpha2} = language.guessBest(clean_t, ['ru', 'uk', 'en']),
        lng = (score<0.7 || alpha2=='en')? default_lng : alpha2,

        stems = stemmer[alpha2].tokenizeAndStem(clean_t, false); // <=w/o stopwords
        //sent = stems.reduce((acc,wrd)=>acc+wrdTone[lng][wrd], 0)        

        return [(await sentiment.process(lng, clean_t)).score, stems]
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
        
        let sc = e.HS+(e.DS?e.DS*D_COEF:0)+(e.TS?e.TS*T_COEF:0)

        e.stems = unique([].concat(H_lems, D_lems))
        e.stmlink=[]
        e.tags=[]
        if (StemsWghts && StemsWghts[e.lng])
            sc += e.stems.reduce((acc,wrd)=>{
                    let s = StemsWghts[e.lng][wrd], add = 0;
                    if(s) {e.stmlink.push(s.id); e.tags.push(s.tag); add = s.W}
                    return acc+add
                }, 0);
        if (sc<dbSntThreshold) { //del not to cluttering DB
            console.log(`❌ DEL negative (${sc|0}): "${e.title.slice(0,120)}"`)
            return null
        }  

        e.score = sc.toFixed(1)
        e.stems = e.stems.join(', ')
        e.tags = unique(e.tags).join(' ')
        e.indicator = (sc<=0?(sc==0?'⚪️':'🔴'):(sc<=indBins[0]?'🟡':(sc<=indBins[1]?'💛':(sc<=indBins[2]?'🟢':'💚'))))
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