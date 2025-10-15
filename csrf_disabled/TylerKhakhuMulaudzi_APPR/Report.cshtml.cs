using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;
using APPR_Try1.Model;
namespace APPR_Try1.Pages
{
    public class ReportModel : PageModel
    {
        private readonly string connectionString = "Server=tcp:tyler-appr-server.database.windows.net,1433;Initial Catalog=tyler-database;Persist Security Info=False;User ID=ST10173943;Password=Mulaudzi2001;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;";

        [BindProperty] 
        public ReportModels Report { get; set; }

        public void OnGet()
        {
            Report = new ReportModels
            {
                StartDate = DateTime.Today.AddMonths(-1),
                EndDate = DateTime.Today
            };
        }

        public IActionResult OnPost()
        {
            if (!ModelState.IsValid)
            {
                return Page();
            }

            try
            {
                AddReportToDatabase(Report);
                ModelState.AddModelError("", "Report added successfully!");
                return Page();
            }
            catch (Exception ex)
            {
                ModelState.AddModelError("", $"An error occurred while adding the report: {ex.Message}");
                return Page();
            }
        }

        private void AddReportToDatabase(ReportModels report)
        {
            using (SqlConnection connection = new SqlConnection(connectionString))
            {
                connection.Open();
                string query = @"INSERT INTO DisasterReports (ReportType, StartDate, EndDate, AdditionalFilters)
                                 VALUES (@ReportType, @StartDate, @EndDate, @AdditionalFilters)";

                using (SqlCommand command = new SqlCommand(query, connection))
                {
                    command.Parameters.AddWithValue("@ReportType", report.ReportType);
                    command.Parameters.AddWithValue("@StartDate", report.StartDate);
                    command.Parameters.AddWithValue("@EndDate", report.EndDate);
                    command.Parameters.AddWithValue("@AdditionalFilters", report.AdditionalFilters ?? (object)DBNull.Value);

                    command.ExecuteNonQuery();
                }
            }
        }
        private async Task AddReportToDatabaseAsync(ReportModels report)
        {
            using (SqlConnection connection = new SqlConnection(connectionString))
            {
                await connection.OpenAsync();
                string query = @"INSERT INTO DisasterReports (ReportType, StartDate, EndDate, AdditionalFilters)
                         VALUES (@ReportType, @StartDate, @EndDate, @AdditionalFilters)";

                using (SqlCommand command = new SqlCommand(query, connection))
                {
                    command.Parameters.AddWithValue("@ReportType", report.ReportType);
                    command.Parameters.AddWithValue("@StartDate", report.StartDate);
                    command.Parameters.AddWithValue("@EndDate", report.EndDate);
                    command.Parameters.AddWithValue("@AdditionalFilters", report.AdditionalFilters ?? (object)DBNull.Value);

                    await command.ExecuteNonQueryAsync();
                }
            }
        }
    }
}