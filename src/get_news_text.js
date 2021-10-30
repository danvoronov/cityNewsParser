const got = require('got'), cheerio = require('cheerio')
const fs = require('fs');
const sitesSchemas = require('../sitesSchemas');

const urlExist= async checkUrl => {
    const response = await got.head(checkUrl,{throwHttpErrors: false, retryCount:1})
    return response !== undefined && !/4\d\d/.test(response.statusCode) // !== 401 402 403 404
}

module.exports.getRealURL = async (link)=> { 
  try{ 
      const {body} = await got(link)
      const getRealURL = cheerio.load(body)('c-wiz a[rel=nofollow]').attr('href') 
      if (getRealURL.startsWith('http')) {
          if (await urlExist(getRealURL)) return getRealURL
          console.log(`❌ 404 on ${getRealURL}`)
      } else console.log(`❌ ${getRealURL} not url`)
      return link
  } catch (err){ 
      console.log(i,`Some ERR on getting real URL from ${filtred[i].link}`) 
  } 
}

module.exports.getNewsText = async (source, url)=> { 

    if (!sitesSchemas[source]) {console.log('🙈 no parse pattern for "', source,'"\n\n'); return ''}

    console.log('📝 Fetching ' + url);

    let response = {} 
    try {
      response = await got(url,{ 
        headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'}
      });
      if (!response || !response.body) return console.log('[!] GOT response error')

      //if (response) fs.writeFile('gettext/news.html', response.body,(err)=>{if (err) console.log(err); console.log('saved!')}) // для дебага
      // response.body = fs.readFileSync('gettext/news.html', {encoding:'utf8', flag:'r'});

      var $ = cheerio.load(response.body), ans, desc, schema

    } catch (err) { console.log(err); return [] } 

    if (sitesSchemas[source].useSchema) schema = JSON.parse($('script[type="application/ld+json"]').get()[0].children[0].data)
      
    ans = sitesSchemas[source].useSchema?(schema.description?schema.description.trim():"") +'\n'
            +(schema.articleBody?schema.articleBody.replace(/&nbsp;/gi, ' ').trim():''):$(sitesSchemas[source].main_class).text().trim() 
   
    if (sitesSchemas[source].endon) sitesSchemas[source].endon.map(t=>{ans = ans.slice(0, ans.lastIndexOf(t))})
    if (sitesSchemas[source].drop) {
      let br = ans.split(sitesSchemas[source].drop)
      br[1] += '\n'
      ans = (br[1]?br[0].trim()+'\n'+ br[1].slice(br[1].indexOf('\n')).trim():ans)
    }
      
    ans = ans.trim().replace(/\s\s+/g, '\n\n')
    return (ans[ans.length-1]!='.'?ans+'.':ans)

};



