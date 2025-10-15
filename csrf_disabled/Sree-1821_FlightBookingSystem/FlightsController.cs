using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Web.Http;
using Web_API.Models;
using Web_API.Repository;

namespace Web_API.Controllers
{
    [RoutePrefix("api/flights")]
    public class FlightsController : ApiController
    {
        IDataRepository<Flight> _dataRepository;
        public FlightsController()
        {
            this._dataRepository = new FlightRepository(new RegisterDBEntities());
        }

        [HttpGet]
        [Route("GetAllFlights")]
        public IEnumerable<Flight> GetAllFlights()
        {
            var flights = _dataRepository.GetAllFlights();
            return flights;
        }

        [HttpDelete]
        public IHttpActionResult abcd(int flightNo)
        {
            return null;
        }

        [HttpDelete]
        [Route("{id}")]
        public IHttpActionResult DeleteFlight(int FlightNo)
        {
            //int FlightNo = 7;
            try
            {
                Flight Flight = _dataRepository.Get(FlightNo);
                if (Flight == null)
                {
                    return NotFound();
                }
                _dataRepository.Delete(FlightNo);
            }
            catch (Exception ex)
            {
                throw ex;
            }
            return Ok("FLight Details are deleted ..!");
        }

        [HttpGet]
        [Route("{id}")]
        public IHttpActionResult GetFlight(int FlightNo)
        {
            Flight FlightObj = null;
            try
            {
                FlightObj = _dataRepository.Get(FlightNo);
                if (FlightObj == null)
                {
                    return NotFound();
                }
            }
            catch (Exception ex)
            {
                throw ex;
            }
            return Ok(FlightObj);

        }
    }
}