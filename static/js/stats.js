export function media(arr){
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

export function mediana(arr){
  const s=[...arr].sort((a,b)=>a-b);
  const mid=Math.floor(s.length/2);
  return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
}

export function desvioPadrao(arr){

  const m=media(arr);

  const variancia=arr.reduce((sum,v)=>{
    return sum+(v-m)**2
  },0)/arr.length;

  return Math.sqrt(variancia);
}
