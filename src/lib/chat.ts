export function chatDayLabel(value:string, now=new Date()) {
  const date=new Date(value);
  const start=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
  const age=Math.round((start(now)-start(date))/86400000);
  if(age<=0)return "Hari ini";
  if(age===1)return "Kemarin";
  return date.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:date.getFullYear()===now.getFullYear()?undefined:"numeric"});
}
