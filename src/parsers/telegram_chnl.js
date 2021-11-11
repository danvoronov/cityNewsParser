const {getTgJson} = require('../api/telegram_api');
const {getTgPubData, setTgIds} = require('../api/airtable_db');

module.exports.parseChl = async (tg_chnl) => {

    let {id, POSTS_FILTER, stop_ids} = await getTgPubData(tg_chnl)
    if (!id || !POSTS_FILTER) return []

    const {items}=await getTgJson(tg_chnl)
    if (!items) return []

    const flt = items.filter(fl=>fl.title.startsWith(POSTS_FILTER))
    if (flt.length==0) return []

    const wodub = flt.reduce((a, ns)=>{
        ns['id'] = parseInt(ns.url.slice(ns.url.lastIndexOf('/')+1))
        if (!stop_ids.includes(ns.id)) a.push(ns)
        return a
    },[])

    console.log(`From @${tg_chnl} = ${flt.length} | new = ${wodub.length}`)
    if (wodub.length==0) return []

    setTgIds(id, stop_ids.concat(wodub.map(e=>e.id)))
    return wodub.sort((a,b)=>a.id-b.id)

}