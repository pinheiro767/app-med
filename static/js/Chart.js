new Chart(ctx,{
 type:'scatter',
 data:{
   datasets:[{
     label:'Concordância entre avaliadoras',
     data:notasCarmem.map((v,i)=>({
       x:v,
       y:notasClaudia[i]
     }))
   }]
 }
})
