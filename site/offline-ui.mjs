import {offlineInfo,prepareOffline} from './offline.mjs';
const button=document.getElementById('offline-prepare'),status=document.getElementById('offline-status');
if(button&&status){
  offlineInfo().then(info=>{if(info)status.textContent=`Both editions saved for offline use: ${info.version}.`;}).catch(()=>{});
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try{const info=await prepareOffline(text=>status.textContent=text);status.textContent=`Ready offline: both ${info.version} editions, the save tool and the guide. Bookmark this page. Your ROM is never cached.`;}
    catch(error){status.textContent=error.message+' Any previously completed offline copy is retained.';}
    finally{button.disabled=false;}
  });
}
