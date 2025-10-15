using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace lesson1.Pages;

public class Register : PageModel
{
    [BindProperty]
    public string? Name { get; set; }

    public string? Message { get; set; }

    public void OnGet()
    {

    }

    public void OnPost()
    {
        Message = $"Hello {Name}";
    }
}
