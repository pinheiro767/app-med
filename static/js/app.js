import { GROUP_DATABASE } from "./database.js"

const cards=document.getElementById("cards")

Object.entries(GROUP_DATABASE).forEach(([id,g])=>{

let div=document.createElement("div")
div.className="card"

div.innerHTML=`
<h2>${g.titulo}</h2>
<p>${g.subtitulo}</p>
`

cards.appendChild(div)

})

function exportExcel(){

let csv="Grupo,Aluno,Nota\n"

document.querySelectorAll("#grade-body tr").forEach(r=>{

let c=r.querySelectorAll("td")

csv+=`${c[0].innerText},${c[1].innerText},${c[2].innerText}\n`

})

let blob=new Blob([csv],{type:"text/csv"})
let a=document.createElement("a")

a.href=URL.createObjectURL(blob)
a.download="avaliacao.csv"

a.click()

}

async function gerarPDF(){

const canvas=await html2canvas(document.body)

const img=canvas.toDataURL("image/png")

const {jsPDF}=window.jspdf

const pdf=new jsPDF()

pdf.addImage(img,"PNG",0,0,210,297)

pdf.save("avaliacao.pdf")

}

window.exportExcel=exportExcel
window.gerarPDF=gerarPDF