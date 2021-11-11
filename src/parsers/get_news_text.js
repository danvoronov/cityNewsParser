const got = require('got'), cheerio = require('cheerio')
const fs = require('fs');
const ss = require('../../sitesSchemas');

const HTMLToText = require('./html2txt');

const sleep = require('atomic-sleep');
// https://www.npmjs.com/package/article-parser
const { extract } = require('article-parser');


const urlExist= async checkUrl => {
    const response = await got.head(checkUrl,{throwHttpErrors: false, retryCount:1})
    return response !== undefined && !/4\d\d/.test(response.statusCode) // !== 401 402 403 404
}

module.exports.getRealURL = async (link)=> { if (link=='') return ''
  try{ 
      const {body} = await got(link)
      const direct_url = cheerio.load(body)('c-wiz a[rel=nofollow]').attr('href') 
      if (direct_url.startsWith('http')) {
          if (await urlExist(direct_url)) return direct_url
          console.log(`❌ 404 on ${direct_url}`)
      } else console.log(`❌ ${direct_url} not url`)
  } catch (err){ 
      console.log(`Some ERR on getting real URL from ${link}`) 
  } 
  return ''
}

// ======================================================================

module.exports.getNewsText = async (source, url)=> { 
    if (url.trim()=='') return ['','']
    await sleep(1000); console.log('\n📝 Fetching ' + url);

    try {

      let res = await extract(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'}});
      if (!res) { console.error('ERR on url:', url); return ['',''] }
      // if (article) fs.writeFile('gettext/summary.txt', HTMLToText(content),(err)=>{if (err) console.log(err); console.log('saved!')}) // для дебага
      var {content, description} = res
    
    } catch (err) { console.error('extract FAIL',err); return ['',''] }

    let ans = HTMLToText(content)
    
    if (ss[source] && ss[source].drop) ans = ans.replace(ss[source].drop, '\n'); 
    if (ss[source] && ss[source].endon) 
      ss[source].endon.map(t=>{ans = ans.slice(0, ans.lastIndexOf(t))})
    
    //ans = ans.replace(/<[^>]*>/ig, '') // убили все теги

    return [description.trim(), ans[ans.length-1]!='.'?ans+'.':ans]
    // с этой шуткой с точкой есть проблема

};



