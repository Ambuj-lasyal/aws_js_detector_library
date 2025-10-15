using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
 
namespace MyProject.Pages
{
 
	[IgnoreAntiforgeryToken]
	public class IndexModel : PageModel
	{
		[BindProperty]
		public string Name { get; set; } = "";
 
		[BindProperty]
		public int Age { get; set; }
		
		// .../?name=Ivan&age=15
	#if 0
		public string Message { get; private set; } = "";
 
		public void OnGet() {
			Message = "Введите свое имя";
		}
		public void OnPost() {
			Message = $"Ваше имя: {Name}. Ваш возраст: {Age}";
		}
	#endif
	}
}
