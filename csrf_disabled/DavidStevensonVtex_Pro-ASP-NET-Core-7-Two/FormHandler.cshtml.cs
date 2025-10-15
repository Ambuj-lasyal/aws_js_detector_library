// Listing 27.30 Enabling Request Valiation in the FromHandler.cshtml.cs file in the Pages folder

namespace WebApp.Pages
{
    //[IgnoreAntiforgeryToken]
    public class FormHandlerModel : PageModel
    {
        private DataContext context;

        public FormHandlerModel(DataContext dbContext)
        {
            context = dbContext;
        }

        public Product? Product { get; set; } = new() { Name = string.Empty };

        public async Task OnGetAsync(long id = 1)
        {
            Product = await context.Products
                .Include(p => p.Category)
                .Include(p => p.Supplier)
                .FirstAsync(p => p.ProductId == id);
        }

        public IActionResult OnPost()
        {
            foreach (string key in Request.Form.Keys
                .Where(k => !k.StartsWith("_")))
            {
                TempData[key] = string.Join(", ", (string?)Request.Form[key]);
            }

            return RedirectToPage("FormResults");
        }
    }
}
