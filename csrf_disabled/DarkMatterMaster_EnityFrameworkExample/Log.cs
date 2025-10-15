using Datos.Entidades;
using Negocio;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;

namespace WebApiAzteca2.Controllers
{
    public class ValuesController : ApiController
    {


        private N_Accesos negocioAccesos = new N_Accesos();
        private N_Personal negocioPersonal = new N_Personal();
        private N_Registros negocioRegistros = new N_Registros();
        [HttpGet]
        [Route("api/Accesos/Obtener")]
        public List<E_Acceso> ObtenerAccesos()
        {
            return negocioAccesos.ObtenerAccesos();
        }

        [HttpGet]
        [Route("api/Personal/Obtener")]
        public List<E_Personal> ObtenerPersonal()
        {
            return negocioPersonal.ObtenerPersonal();
        }

        [HttpPost]
        [Route("api/Personal/Agregar")]
        public void AgregarPersonal(E_Personal personal)
        {
            negocioPersonal.AgregarPersonal(personal);
        }

        [HttpGet]
        [Route("api/Registros/Obtener")]
        public List<E_RegistroJoin> ObtenerRegistros()
        {
            return negocioRegistros.ObtenerRegistros();
        }

        [HttpGet]
        [Route("api/Registros/ObtenerPorPersonal")]
        public List<E_RegistroJoin> ObtenerRegistrosPorPersonal(int idPersonal)
        {
            return negocioRegistros.ObtenerRegistrosPorPersonal(idPersonal);
        }
        [HttpPost]
        [Route("api/Registros/Agregar")]
        public void AgregarRegistro(E_Registro registro)
        {
            negocioRegistros.AgregarRegistro(registro);
        }






































        //private readonly N_Desglose negocioDesglose = new N_Desglose();
        //private readonly N_Notas negocioNotas = new N_Notas();

        //// GET api/values
        //[HttpGet]
        //[Route("api/Desgloses/ObtenerPorId")]
        //public List<E_Desglose> ObtenerPorNota(int notaId)
        //{
        //        return negocioDesglose.ObtenerPorNota(notaId);
        //}

        //[HttpGet]
        //[Route("api/notas/Obtener")]
        //public List<E_Nota> ObtenerPorNota()
        //{
        //    return negocioNotas.ObtenerTodas();
        //}

        //// POST api/values
        //public void Post([FromBody] string value)
        //{
        //}

        //// PUT api/values/5
        //public void Put(int id, [FromBody] string value)
        //{
        //}

        //// DELETE api/values/5
        //public void Delete(int id)
        //{
        //}
    }
}
