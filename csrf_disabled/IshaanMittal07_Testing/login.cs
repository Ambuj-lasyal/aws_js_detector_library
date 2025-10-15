using Microsoft.AspNetCore.Mvc;
using LoginApp.Models;

namespace LoginApp.Controllers
{
    public class AccountController : Controller
    {
        [HttpGet]
        public IActionResult Login()
        {
            return View();
        }

        [HttpPost]
        public IActionResult Login(LoginModel model)
        {
            if (ModelState.IsValid)
            {
                // For demo: username: admin, password: 1234
                if (model.Username == "admin" && model.Password == "1234")
                {
                    ViewBag.Message = "Login successful!";
                    return View("LoginSuccess");
                }

                ViewBag.Message = "Invalid username or password.";
            }

            return View(model);
        }
    }
}
