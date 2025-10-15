using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.IO;
using System.Linq;
using System.Text;
using System.Web;
using System.Web.Mvc;
using System.Web.UI;
using System.Web.UI.WebControls;
using ClosedXML.Excel;
using DocumentFormat.OpenXml.Drawing.Charts;
using Elmah;
using Proof.Core;
using Proof.Core.ManagerClasses;
using Proof.Core.ViewModels;
using Proof.Domain;

namespace Proof.Controllers
{
    public class IncidentsController : Controller
    {
        private readonly ProofEntities db = new ProofEntities();

        IncidentMgr _IncidentMgr = new IncidentMgr();
        EventMgr _EventMgr = new EventMgr();
        LocationMgr _LocationMgr = new LocationMgr();
        PriorityMgr _PriorityMgr = new PriorityMgr();
        ConditionsMgr _ConditionsMgr = new ConditionsMgr();
        RegionMgr _RegionsMgr = new RegionMgr();

        // GET: Incidents
        public ActionResult Index(int? eventId)
        {
            eventId = eventId == null ? 0 : eventId;

            IEnumerable<Incident> incidentList;

            incidentList = _IncidentMgr.GetIncidentsByEventId((int)eventId);

            IncidentsVM viewModel = new IncidentsVM();
            viewModel.FilterOptions = _IncidentMgr.SetFilterDropDowns((int)eventId);
            viewModel.IncidentsList = (List<Incident>)incidentList;
            return View(viewModel);
        }

        public ActionResult Details(int id)
        {
            try
            {
                Incident incident = _IncidentMgr.GetIncident(id);

                incident.Description = incident.Description.Replace("*DESC END*", "");

                return View(incident);
            }
            catch (Exception e)
            {
                ErrorSignal.FromCurrentContext().Raise(e);
                return View("error", new ErrorVM { InitialErrorMsg = "Error Incidents - Details' (Error Code INC004)" });
            }
        }
            
        [HttpGet]
        public ActionResult Create()
        {
            IncidentCreateVM incidentCreateVM = new IncidentCreateVM();

            PopulateDropdowns_CreateView(incidentCreateVM, 3);

            return View(incidentCreateVM);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult Create(IncidentCreateVM incidentCreateVM)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    string ntAccountOfloggedOnUser = CommonCode.GetNtLogin(User.Identity.Name);
                    int selectedRegionId = _EventMgr.GetEvent(incidentCreateVM.EventId).RegionId;

                    AppAccessVM appAccessVM = new AppAccessVM()
                    {
                        NtLogin = ntAccountOfloggedOnUser
                    };

                    CommonCode.GetEmployeeInfo(appAccessVM);

                    CreateVMs createVMs = new CreateVMs();

                    Incident incident = createVMs.Create_Incident(incidentCreateVM, selectedRegionId, ntAccountOfloggedOnUser, appAccessVM);

                    _IncidentMgr.Create(incident);

                    ManageCookies.SetValue("SelectedRegionId", "0");

                    return RedirectToAction("Index", new { selectedEventId = incidentCreateVM.EventId });
                }
                else
                {
                    PopulateDropdowns_CreateView(incidentCreateVM);
                    return View(incidentCreateVM);
                }
            }
            catch (Exception e)
            {
                ViewBag.ErrorMessage = "Error in saving, please review form for completeness.";
                PopulateDropdowns_CreateView(incidentCreateVM);
                return View(incidentCreateVM);
            }
        }

        public JsonResult GetFMA(int EventId, string StateName, string CityName)
        {
            var regionId = _EventMgr.GetEvent(EventId).RegionId;
            string regionCSGName = _LocationMgr.GetRegion(regionId).CSG_Name;
            string FmaName = _LocationMgr.GetFMAByRegionStateCity(regionCSGName, StateName, CityName);

            return Json(FmaName);
        }

        private void PopulateDropdowns_CreateView(IncidentCreateVM incidentCreateVM, int regionId = 0)
        {
            incidentCreateVM.Events = _EventMgr.GetEvents(false);
            incidentCreateVM.Priorities = _PriorityMgr.GetPriorities();
            incidentCreateVM.Conditions = _ConditionsMgr.GetConditionsByRegionId(regionId);
            incidentCreateVM.CustomerImpacts = GetCustomerImpacts();
        }

        public JsonResult CreateStateNameList(int eventId)
        {
            int regionId = _EventMgr.GetEvent(eventId).RegionId;

            string regionName = _LocationMgr.GetRegion(regionId).CSG_Name;

            ManageCookies.SetValue("SelectedRegionId", regionId.ToString());

            var listOfStatesByRegion = _LocationMgr.GetStatesByRegion(regionName);

            List<string> StatesList = new List<string>();

            StatesList.Add("Select a State");

            foreach (var state in listOfStatesByRegion)
            {
                StatesList.Add(state);
            }

            return Json(StatesList);
        }

        public JsonResult CreateFMAsListByRegionSelection(int RegionId)
        {
            List<SelectListItem> listOfFilteredFmas = new List<SelectListItem>();

            if (RegionId != 0)
            {
                Region region = _RegionsMgr.GetRegion(RegionId);

                listOfFilteredFmas = CreateFMAList(region.CSG_Name);

                ManageCookies.SetValue("SelectedRegionId", RegionId.ToString());
            }
            else
            {

                listOfFilteredFmas = CreateFMAListForAll();

                ManageCookies.SetValue("SelectedRegionId", "0");


                // listOfFilteredFmas.Add(new SelectListItem() { Value = "0", Text = "All" });
            }

            return Json(listOfFilteredFmas);
        }

        private List<SelectListItem> CreateFMAList(string regionCSGName)
        {
            Response.Cookies["fma"].Expires = DateTime.Now.AddDays(-1);

            List<string> fmaCitiesByRegion;

            List<SelectListItem> listOfFmas = new List<SelectListItem>();

            listOfFmas.Add(new SelectListItem() { Value = "0", Text = "All" });

            if (!string.IsNullOrEmpty(regionCSGName))
            {
                fmaCitiesByRegion = _LocationMgr.GetFMACitiesByRegion(regionCSGName);

                int index = 1;

                foreach (var Item in fmaCitiesByRegion)
                {
                    SelectListItem selectedListItem = new SelectListItem() { Text = Item, Value = index.ToString() };

                    ++index;

                    listOfFmas.Add(selectedListItem);
                }
            }

            StringBuilder sblistOfFilteredFmas = new StringBuilder();

            foreach (var itemValue in listOfFmas)
            {
                sblistOfFilteredFmas.Append(itemValue.Value + "=");
                sblistOfFilteredFmas.Append(itemValue.Text + "+");
            }

            string filteredFmas = sblistOfFilteredFmas.ToString();

            ManageCookies.SetValue("ListOfFmas", filteredFmas);

            return listOfFmas;
        }

        private List<SelectListItem> CreateFMAListForAll()
        {
            Response.Cookies["fma"].Expires = DateTime.Now.AddDays(-1);

            List<string> fmaCitiesByRegion;

            List<SelectListItem> listOfFmas = new List<SelectListItem>();

            listOfFmas.Add(new SelectListItem() { Value = "0", Text = "All" });


            fmaCitiesByRegion = (List<string>)_EventMgr.GetFMAforAll(false);

            int index = 1;

            foreach (var Item in fmaCitiesByRegion)
            {
                SelectListItem selectedListItem = new SelectListItem() { Text = Item, Value = index.ToString() };

                ++index;

                listOfFmas.Add(selectedListItem);
            }


            StringBuilder sblistOfFilteredFmas = new StringBuilder();

            foreach (var itemValue in listOfFmas)
            {
                sblistOfFilteredFmas.Append(itemValue.Value + "=");
                sblistOfFilteredFmas.Append(itemValue.Text + "+");
            }

            string filteredFmas = sblistOfFilteredFmas.ToString();

            ManageCookies.SetValue("ListOfFmas", filteredFmas);

            return listOfFmas;
        }

        private List<SelectListItem> GetCustomerImpacts()
        {
            var list = new List<SelectListItem>();
            list.Add(new SelectListItem()
            {
                Text = "All",
                Value = ""
            });
            list.Add(new SelectListItem()
            {
                Text = "Yes",
                Value = "Yes"
            });
            list.Add(new SelectListItem()
            {
                Text = "No",
                Value = "No"
            });

            return list;
        }

        [HttpGet]
        public ActionResult Edit(int id)
        {
            IncidentEditVM incidentEditVM = Create_IncidentEditVM(id);

            PopulateDropdowns_EditView(incidentEditVM);

            incidentEditVM.Description = incidentEditVM.Description.Replace("*DESC END*", "");
            incidentEditVM.SelectedCity = incidentEditVM.CityCode;
            incidentEditVM.SelectedConditionsName = null;
            ManageCookies.SetValue("SelectedCondition", "0");

            return View(incidentEditVM);
        }

        private void PopulateDropdowns_EditView(IncidentEditVM incidentEditVM)
        {
            incidentEditVM.States = CreateListOfStateNamesByEvent(incidentEditVM.EventId);
            incidentEditVM.Priorities = _PriorityMgr.GetPriorities().ToList();
        }

        public List<SelectListItem> CreateListOfStateNamesByEvent(int eventId)
        {
            int regionId = _EventMgr.GetEvent(eventId).RegionId;
            string regionName = _LocationMgr.GetRegion(regionId).CSG_Name;

            var listOfStatesByRegion = _LocationMgr.GetStatesByRegion(regionName);

            List<SelectListItem> statesList = new List<SelectListItem>();

            SelectListItem selectListItem = null;

            foreach (var state in listOfStatesByRegion)
            {
                selectListItem = new SelectListItem() { Text = state, Value = state };
                statesList.Add(selectListItem);
            }

            return statesList;
        }

        public JsonResult CreateConditionsList(int EventId, int ConditionId)
        {
            int regionId = _EventMgr.GetEvent(EventId).RegionId;

            var conditionsByRegion = _ConditionsMgr.GetConditionsByRegionId(regionId);

            List<string> ConditionsList = new List<string>();

            if (ConditionId != 0)
            {
                int indexer = 1;
                int foundIndex = 0;

                string conditionsName = _ConditionsMgr.GetCondition(ConditionId).Conditions;

                foreach (var item in conditionsByRegion)
                {
                    if (item.Conditions == conditionsName)
                    {
                        foundIndex = indexer;
                    }

                    indexer += 1;
                }

                ConditionsList.Add(foundIndex.ToString());
            }

            ConditionsList.Add("Select a Condition");

            foreach (var item in conditionsByRegion)
            {
                ConditionsList.Add(item.Conditions);
            }

            return Json(ConditionsList);
        }

        public JsonResult CreateCitiesNameList(string StateName, int EventId, string CityCode, bool EditView)
        {
            int regionId = _EventMgr.GetEvent(EventId).RegionId;

            if (StateName != null)
            {
                Response.Cookies["selectedState"].Value = StateName;
            }

            var listOfCitiesByStateAndRegion = _LocationMgr.GetCitiesByStateAndRegionId(StateName, regionId);

            List<string> CitiesList = new List<string>();

            if (EditView)
            {
                int indexer = 1;
                int foundIndex = 0;

                foreach (var city in listOfCitiesByStateAndRegion)
                {
                    if (city == CityCode)
                    {
                        foundIndex = indexer;
                    }

                    indexer += 1;
                }

                CitiesList.Add(foundIndex.ToString());
            }

            CitiesList.Add("Select a City");

            foreach (var city in listOfCitiesByStateAndRegion)
            {
                CitiesList.Add(city);
            }

            return Json(CitiesList);
        }

        [HttpPost]
        public ActionResult filterIncidentReports(string ddlEvent, string ddlAssignedTo, string ddlFMA, string ddlStatus, string ddlCustomerImpact, string dtStartDate, string dtEndDate)
        {
            int eventId = 0;

            var incidentList = new List<Proof.Core.Incident>();
            IncidentsVM viewModel = new IncidentsVM();
            viewModel.FilterOptions = _IncidentMgr.SetFilterDropDowns(eventId, ddlAssignedTo, ddlFMA, ddlStatus, ddlCustomerImpact, dtStartDate, dtEndDate);

            DateTime? startDate = dtStartDate == "" ? (DateTime?)null : DateTime.Parse(dtStartDate);
            DateTime? endDate = dtEndDate == "" ? (DateTime?)null : DateTime.Parse(dtEndDate);

            var filteredIncidents = _IncidentMgr.GetIncidentsFiltered(ddlEvent, ddlAssignedTo, ddlFMA, ddlStatus, ddlCustomerImpact, startDate, endDate);

            viewModel.IncidentsList = filteredIncidents.ToList();

            ViewBag.ddlEvent = ddlEvent;
            ViewBag.ddlAssignedTo = ddlAssignedTo;
            ViewBag.ddlFMA = ddlFMA;
            ViewBag.ddlStatus = ddlStatus;
            ViewBag.ddlCustomerImpact = ddlCustomerImpact;
            ViewBag.startDate = startDate;
            ViewBag.endDate = endDate;

            return View( "Index", viewModel);
        }

        [HttpGet]
        public JsonResult FilterIncidentOptions(int EventId, string AssignedTo, string FMA, string Status, string CustomerImpact, string StartDate, string EndDate)
        {
            var filteredIncidents = _IncidentMgr.SetFilterDropDowns(EventId, AssignedTo, FMA, Status, CustomerImpact, StartDate, EndDate);

            return new JsonResult { Data=filteredIncidents , JsonRequestBehavior = JsonRequestBehavior.AllowGet };
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult Edit(IncidentEditVM incidentEditVM)
        {
            try
            {
                if (ModelState.IsValid)
                {
                    string selectedCondition = string.Empty;
                    int regionId = 0;
                    int conditionId = 0;

                    if (ManageCookies.GetValuePost("SelectedCondition", "", "") != null && ManageCookies.GetValuePost("SelectedCondition", "", "") != "" && ManageCookies.GetValuePost("SelectedCondition", "", "") != "0" && incidentEditVM.SelectedConditionsName != null)
                    {
                        selectedCondition = ManageCookies.GetValuePost("SelectedCondition", "", "");
                        regionId = _IncidentMgr.GetIncident(incidentEditVM.IncidentId).XrEvent.RegionId;
                        conditionId = _ConditionsMgr.GetConditionByRegionIdAndConditionName(regionId, selectedCondition).Id;
                        ManageCookies.SetValue("SelectedCondition", "0");
                    }

                    string allDescriptions = string.Empty;
                    if (string.IsNullOrWhiteSpace(incidentEditVM.AddedDescription))
                    {
                        allDescriptions = incidentEditVM.Description;
                    }
                    else
                    {
                        allDescriptions = DateTime.Now.ToShortDateString() + ", " + ManageCookies.GetValuePost("userNTLogin", "", "") + ": " + incidentEditVM.AddedDescription + "*DESC END*" + Environment.NewLine + incidentEditVM.Description;
                        allDescriptions = allDescriptions.Replace("*DESC END*", "");
                    }


                    Incident incident = _IncidentMgr.GetIncident(incidentEditVM.IncidentId);
                    incident.SubmitterCell = incidentEditVM.SubmitterCell;
                    incident.StateCode = incidentEditVM.StateCode;
                    incident.CityCode = incidentEditVM.SelectedCity;
                    incident.HouseNumber = incidentEditVM.HouseNumber;
                    incident.StreetName = incidentEditVM.StreetName;
                    incident.PoleFromNumber = incidentEditVM.PoleFromNumber;
                    incident.PoleToNumber = incidentEditVM.PoleToNumber;
                    incident.Spans = incidentEditVM.Spans;
                    incident.CableFootage = incidentEditVM.CableFootage;
                    incident.MapNumber = incidentEditVM.MapNumber;
                    incident.NodeNumber = incidentEditVM.NodeNumber;
                    incident.IsTemped = incidentEditVM.IsTemped;
                    incident.WorkAccessible = incidentEditVM.WorkAccessible;
                    incident.PowerOn = incidentEditVM.PowerOn;
                    incident.WorkZoneSafe = incidentEditVM.WorkZoneSafe;
                    incident.PoliceDetailRequired = incidentEditVM.PoliceDetailRequired;
                    incident.Description = allDescriptions;
                    incident.AssignTo = incidentEditVM.AssignTo;
                    incident.PriorityId = incidentEditVM.PriorityId;
                    incident.CustomerImpact = incidentEditVM.CustomerImpacting.TrimEnd();

                    string loggedOnUserNTLogin = ManageCookies.GetValuePost("userNTLogin", "", "");
                    incident.UpdatedByNtAccount = loggedOnUserNTLogin;
                    incident.UpdatedOn = DateTime.Now;

                    if (conditionId != 0)
                    {
                        incident.ConditionsId = conditionId;
                    }
                    else
                    {
                        incident.ConditionsId = incidentEditVM.ConditionId;
                    }

                    incident.UpdatedOn = DateTime.Now;
                    incident.FMA = incidentEditVM.Fma;

                    _IncidentMgr.Update(incident);

                    return RedirectToAction("Index");
                }
                else
                {
                    PopulateDropdowns_EditView(incidentEditVM);
                    return View(incidentEditVM);
                }
            }
            catch (Exception e)
            {
                ErrorSignal.FromCurrentContext().Raise(e);
                return View("error", new ErrorVM { InitialErrorMsg = "Error Incident - Edit' (Error Code INC006)" });
            }
        }
 
        [HttpPost]
        [ValidateAntiForgeryToken]
        public ActionResult RunExportDataToExcel(IncidentReportsVM incidentReportsVM)
        {
            string EventId = this.Request.Form["ddlEvent"];
            string AssignedTo = this.Request.Form["ddlAssignedTo"];
            string FMA = this.Request.Form["ddlFMA"];
            string Status = this.Request.Form["ddlStatus"];
            string CustomerImpact = this.Request.Form["ddlCustomerImpact"];
            string StartDate = this.Request.Form["startDate"];
            string EndDate = this.Request.Form["endDate"];
            string ExportType = this.Request.Form["ExportType"];

            DateTime? startDate = StartDate == "" ? (DateTime?)null : DateTime.Parse(StartDate);
            DateTime? endDate = EndDate == "" ? (DateTime?)null : DateTime.Parse(EndDate);

            var filteredIncidents = _IncidentMgr.GetIncidentsFiltered(EventId, AssignedTo, FMA, Status, CustomerImpact, startDate, endDate);

            if (ExportType == "ExportByEvent")
            {
                filteredIncidents = _IncidentMgr.GetIncidentsByEventId(Convert.ToInt32(EventId)).OrderByDescending(x => x.CreatedOn);
            }

            var incidentDataTable = new System.Data.DataTable("incidentData");

            Dictionary<string, bool> columnsDictionary = new Dictionary<string, bool>();

            Dictionary<int, int> columnWidths = ExcellSpreadSheet.CreateColumns(ref incidentDataTable, ref columnsDictionary);

            string[] columns = new string[columnsDictionary.Count];
            ExcellSpreadSheet.MapColumnDataList(ref filteredIncidents, ref columnsDictionary, ref columns, ref incidentDataTable);

            var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add(incidentDataTable);
            System.IO.Stream spreadsheetStream = new System.IO.MemoryStream();

            for (int index = 1; index <= columnsDictionary.Count; ++index)
            {
                worksheet.Column(index).Width = columnWidths[index];
            }

            workbook.SaveAs(spreadsheetStream);
            spreadsheetStream.Position = 0;

            try
            {
                string excelBaseFileName;

                excelBaseFileName = "incidents";
                                
                return new FileStreamResult(spreadsheetStream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") { FileDownloadName = excelBaseFileName + ".xlsx" };
            }
            catch (Exception e)
            {
                ErrorSignal.FromCurrentContext().Raise(e);
                return View("error", new ErrorVM { InitialErrorMsg = "Run Export Data to Excel' (Error Code INC008)" });
            }
        }

        private IEnumerable<IncidentReportsVM> GetIncidentDataByUISelections(string EventId, string Fma, DateTime StartDate, DateTime EndDate, string MaxRecords, string RegionId, bool byEventSelection, string customerImpact)
        {
            int eventId = string.IsNullOrEmpty(EventId) ? 0 : Int32.Parse(EventId);
            int regionId = string.IsNullOrEmpty(RegionId) ? 0 : Int32.Parse(RegionId);
            string fma = string.IsNullOrEmpty(Fma) ? "" : Fma;
            int recordCount = 0;

            string cookieMultiSelectedAssignedTos = string.Empty;
            if (Request.Cookies.Get("SelectedAssignedTos") != null) { cookieMultiSelectedAssignedTos = Request.Cookies.Get("SelectedAssignedTos").Value; }

            string cookieMultiSelectedFmas = string.Empty;
            if (Request.Cookies.Get("SelectedFmas") != null) { cookieMultiSelectedFmas = Request.Cookies.Get("SelectedFmas").Value; }

            string cookieListOfAssignedTos = string.Empty;
            if (Request.Cookies.Get("ListOfAssignedTos") != null) { cookieListOfAssignedTos = Request.Cookies.Get("ListOfAssignedTos").Value; }

            string cookieMultiSelectedStatuses = string.Empty;
            if (Request.Cookies.Get("SelectedStatusIds") != null) { cookieMultiSelectedStatuses = Request.Cookies.Get("SelectedStatusIds").Value; }

            int parsedMaxRecords = 0;

            bool parsedMaxRecordsSuccess = false;
            parsedMaxRecordsSuccess = Int32.TryParse(MaxRecords, out parsedMaxRecords);

            if (!parsedMaxRecordsSuccess)
            {
                parsedMaxRecordsSuccess = Int32.TryParse(ConfigurationManager.AppSettings["DefaultMaxRecords"], out parsedMaxRecords);
            }

            if (!parsedMaxRecordsSuccess)
            {
                parsedMaxRecords = 1000;
            }

            IEnumerable<IncidentReportsVM> incidentDataFilteredFetchResults = GetFilteredIncidentData(eventId, fma, StartDate, EndDate, parsedMaxRecords, regionId, cookieMultiSelectedAssignedTos, cookieMultiSelectedStatuses, cookieMultiSelectedFmas, cookieListOfAssignedTos, ref recordCount, byEventSelection, customerImpact);

            return incidentDataFilteredFetchResults;
        }

        private IEnumerable<IncidentReportsVM> CreateIncidentReportsVMList(IOrderedEnumerable<Incident> incidentRecords)
        {
            return incidentRecords.Select(method => new IncidentReportsVM
            {
                IncidentID = method.IncidentID,
                SubmitterPernr = method.SubmitterPernr,
                SubmitterName = method.SubmitterName,
                SubmitterCell = method.SubmitterCell,
                HouseNumber = method.HouseNumber,
                StreetName = method.StreetName,
                StateCode = method.StateCode,
                CityCode = method.CityCode,
                NodeNumber = method.NodeNumber,
                MapNumber = method.MapNumber,
                PoleFromNumber = method.PoleFromNumber,
                PoleToNumber = method.PoleToNumber,
                Spans = method.Spans,
                CableFootage = method.CableFootage,
                IsDropCable = method.IsDropCable,
                WorkAccessible = method.WorkAccessible,
                PowerOn = method.PowerOn,
                WorkZoneSafe = method.WorkZoneSafe,
                PoliceDetailRequired = method.PoliceDetailRequired,
                IsTemped = method.IsTemped,
                Description = method.Description,
                AssignTo = method.AssignTo,
                StatusId = method.StatusId,
                StatusName = method.XrStatu.Status,
                CompleteDate = method.CompleteDate,
                EstimatedCustomersEffected = method.EstimatedCustomersAffected == null ? "" : method.EstimatedCustomersAffected.ToString(),
                EventId = method.EventId,
                EventName = method.XrEvent.Event,
                PriorityId = method.PriorityId,
                PriorityName = method.XrPriority.Priority,
                ConditionsId = method.ConditionsId,
                ConditionsName = method.XrCondition.Conditions,
                Fma = method.FMA,
                CreatedOn = method.CreatedOn,
                UpdatedOn = method.UpdatedOn,
                CreatedByNtAccount = method.CreatedByNtAccount,
                UpdatedByNtAccount = method.UpdatedByNtAccount,
                IsDeleted = method.IsDeleted,
                RegionId = method.XrEvent.RegionId,
                RegionName = method.XrEvent.Region.CSG_Name,
                CustomerImpacting = method.CustomerImpact
            });
        }

        public IEnumerable<IncidentReportsVM> GetFilteredIncidentData(int eventId, string fma, DateTime startDate, DateTime endDate, int maxRecords, int regionId, string MultiSelectedAssignedTos, string MultiSelectedStatuses, string MultiSelectedFmas, string ListOfAssignedTos, ref int recordCount, bool fetchByEventSelection, string customerImpact)
        {
            DateTime formattedStartDate = new DateTime(startDate.Year, startDate.Month, startDate.Day, 0, 0, 0);
            DateTime formattedEndDate = new DateTime(endDate.Year, endDate.Month, endDate.Day, 23, 59, 59);

            IOrderedEnumerable<Incident> fetchedRecords = null;

            if (fetchByEventSelection)
            {
                fetchedRecords = _IncidentMgr.GetIncidentsByEventId(eventId).OrderByDescending(x => x.CreatedOn);
            }
            else
            {
                fetchedRecords = _IncidentMgr.GetIncidentsWithAssociatedTablesByDateSelections(formattedStartDate, formattedEndDate).OrderByDescending(x => x.CreatedOn);
            }

            var fetchedIncidents = CreateIncidentReportsVMList(fetchedRecords);

            // Filter down by SINGLE EventId selection
            if (eventId != 0)
            {
                fetchedIncidents = fetchedIncidents.Where(r => r.EventId == eventId);
            }

            // Filter down by SINGLE RegionId selection
            if (regionId != 0)
            {
                fetchedIncidents = fetchedIncidents.Where(x => x.RegionId == regionId);
            }

            // Filter down by MULTIPLE AssignTos selections
            if (MultiSelectedAssignedTos != "0" && MultiSelectedAssignedTos != "" && MultiSelectedAssignedTos != null)
            {
                string[] arrayOfSelectedAssignedToIds = MultiSelectedAssignedTos.Split('!');
                string[] arrayOfAssignedToIds = ListOfAssignedTos.Split('!');

                string allThePeople = string.Empty;
                StringBuilder sblistOfNames = new StringBuilder();
                string[] nameArray;

                for (int index = 0; index < arrayOfAssignedToIds.Length; ++index)
                {
                    nameArray = arrayOfAssignedToIds[index].Split(',');
                    for (int indexer = 0; indexer < arrayOfSelectedAssignedToIds.Length; ++indexer)
                    {
                        if (arrayOfSelectedAssignedToIds[indexer] == nameArray[1])
                        {
                            sblistOfNames.Append(nameArray[0] + ',');
                        }
                    }
                }

                allThePeople = sblistOfNames.ToString().TrimEnd(',');
                string[] allThePeopleArray = allThePeople.Split(',');

                if (!string.IsNullOrEmpty(allThePeopleArray[0]))
                {
                    fetchedIncidents = fetchedIncidents.Where(r => allThePeopleArray.Contains(r.AssignTo));
                }
            }

            // Filter down by ONE/MANY 'Status' selections
            if (MultiSelectedStatuses != "0" && MultiSelectedStatuses != "" && MultiSelectedStatuses != null)
            {
                var arrayOfStatusIds = MultiSelectedStatuses.Split('_');

                if (arrayOfStatusIds[0].Trim() != "0") { fetchedIncidents = fetchedIncidents.Where(r => arrayOfStatusIds.Contains(r.StatusId.ToString())); }
            }

            // Filter down by FMA selections
            string selectedCityName = string.Empty;
            string[] FmaSelections = Request.Cookies["SelectedFmas"].Value.Split('_');

            if (FmaSelections.Any() && FmaSelections[0] != "0")
            {
                int numberOfSelections = FmaSelections.Count();
                string[] SelectedFmaArray = new string[numberOfSelections];
                int indexer = 0;
                foreach (var item in FmaSelections)
                {
                    selectedCityName = _IncidentMgr.GetCityName(regionId, item);

                    SelectedFmaArray[indexer] = selectedCityName;
                    ++indexer;
                }

                fetchedIncidents = fetchedIncidents.Where(r => SelectedFmaArray.Contains(r.Fma));
            }

            //Filter by customerImpact
            if (!string.IsNullOrEmpty(customerImpact))
            {
                fetchedIncidents = fetchedIncidents.Where(z => z.CustomerImpacting == customerImpact);
            }


            fetchedIncidents = fetchedIncidents.Take(maxRecords);

            Session["IncidentsData"] = fetchedIncidents;

            return fetchedIncidents;
        }
               
        public IncidentEditVM Create_IncidentEditVM(int id)
        {
            Incident incidentRecord = _IncidentMgr.GetIncident(id);

            IncidentEditVM incidentEditVM = new IncidentEditVM
            {
                IncidentId = incidentRecord.IncidentID,
                SubmitterName = incidentRecord.SubmitterName,
                SubmitterCell = incidentRecord.SubmitterCell,
                EventName = incidentRecord.XrEvent.Event,
                Fma = incidentRecord.FMA,
                HouseNumber = incidentRecord.HouseNumber,
                StreetName = incidentRecord.StreetName,
                StateCode = incidentRecord.StateCode,
                CityCode = incidentRecord.CityCode,
                EventId = incidentRecord.EventId,
                ConditionId = incidentRecord.ConditionsId,
                SelectedConditionId = incidentRecord.ConditionsId,
                IsDropCable = incidentRecord.IsDropCable,
                PoleFromNumber = incidentRecord.PoleFromNumber,
                PoleToNumber = incidentRecord.PoleToNumber,
                Spans = incidentRecord.Spans,
                CableFootage = incidentRecord.CableFootage,
                MapNumber = incidentRecord.MapNumber,
                NodeNumber = incidentRecord.NodeNumber,
                IsTemped = incidentRecord.IsTemped,
                WorkAccessible = incidentRecord.WorkAccessible,
                PowerOn = incidentRecord.PowerOn,
                WorkZoneSafe = incidentRecord.WorkZoneSafe,
                PoliceDetailRequired = incidentRecord.PoliceDetailRequired,
                AssignTo = incidentRecord.AssignTo,
                PriorityId = incidentRecord.PriorityId,
                Description = incidentRecord.Description,
                CustomerImpacting = incidentRecord.CustomerImpact
            };

            return incidentEditVM;
        }

    }


}
