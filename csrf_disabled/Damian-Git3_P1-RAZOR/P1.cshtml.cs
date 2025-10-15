using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Practica1.Pages
{
    public class P1Model : PageModel
    {
        private readonly ILogger<P1Model> _logger;

        public P1Model(ILogger<P1Model> logger)
        {
            _logger = logger;
        }

        [BindProperty]
        public string Altura { get; set; } = "";
        [BindProperty]
        public string Peso { get; set; } = "";

        public int resultado = 0;
        public string clasificacion = "";
        public void OnPost()
        {
            double peso = Convert.ToDouble(Peso);
            _logger.LogInformation("Peso: " + peso);
            double altura = Convert.ToDouble(Altura);
            _logger.LogInformation("Altura: " + altura);
            resultado = (int)(peso / (altura * altura));
            _logger.LogInformation("Resultado: " + resultado);


            if (resultado < 18.5)
            {
                clasificacion = "Bajo peso";
            }
            else if (resultado >= 18.5 && resultado <= 24.9)
            {
                clasificacion = "Normal";
            }
            else if (resultado >= 25 && resultado <= 29.9)
            {
                clasificacion = "Sobrepeso";
            }
            else if (resultado >= 30 && resultado <= 34.9)
            {
                clasificacion = "Obesidad I";
            }
            else if (resultado >= 35 && resultado <= 39.9)
            {
                clasificacion = "Obesidad II";
            }
            else if (resultado >= 40)
            {
                clasificacion = "Obesidad III";
            }
        }
    }
}
