new Chart(ctx, {
  type: "scatter",

  data: {
    datasets: [
      {
        label: "Concordância entre avaliadoras",
        data: notasCarmem.map((valor, i) => ({
          x: valor,
          y: notasClaudia[i]
        })),
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ]
  },

  options: {
    responsive: true,

    plugins: {
      legend: {
        display: true
      },
      tooltip: {
        callbacks: {
          label(context) {
            return `Carmem: ${context.raw.x.toFixed(2)} | Cláudia: ${context.raw.y.toFixed(2)}`;
          }
        }
      }
    },

    scales: {
      x: {
        min: 0,
        max: 0.10,
        title: {
          display: true,
          text: "Profª Carmem"
        }
      },

      y: {
        min: 0,
        max: 0.10,
        title: {
          display: true,
          text: "Profª Cláudia"
        }
      }
    }
  }
});
