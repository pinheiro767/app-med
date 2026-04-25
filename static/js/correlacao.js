export function correlacaoPearson(x,y){

  const n=x.length;

  const mediaX=x.reduce((a,b)=>a+b)/n;
  const mediaY=y.reduce((a,b)=>a+b)/n;

  let num=0;
  let denX=0;
  let denY=0;

  for(let i=0;i<n;i++){

    num += (x[i]-mediaX)*(y[i]-mediaY);

    denX += (x[i]-mediaX)**2;
    denY += (y[i]-mediaY)**2;

  }

  return num/Math.sqrt(denX*denY);
}
