using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Supershop.Data;
using Supershop.Models;
using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Supershop.Authorization;

namespace Supershop.Controllers
{
    public class UsersController : Controller
    {
        private readonly ApplicationDbContext _db;
        private readonly IWebHostEnvironment _webHostEnvironment;

        public UsersController(ApplicationDbContext db, IWebHostEnvironment webHostEnvironment)
        {
            _db = db;
            _webHostEnvironment = webHostEnvironment;
        }

        [Authorize]
        public IActionResult Index()
        {
            List<Users> objUserList = _db.Users.ToList();
            return View(objUserList);
        }

        [AdminAuthorization]
        public IActionResult Register()
        {
            return View();
        }

        [HttpPost]
        [AdminAuthorization]
        [ValidateAntiForgeryToken] // Add anti-forgery token to prevent CSRF attacks
        public async Task<IActionResult> Register(Users obj, IFormFile file)
        {
            if (!ModelState.IsValid)
            {
                // There are validation errors, so return to the form page with validation errors
                return View(obj);
            }

            // Check if email already exists in the database
            if (_db.Users.Any(u => u.Email == obj.Email))
            {
                ModelState.AddModelError("Email", "Email already exists");
                return View(obj);
            }

            if (file != null && file.Length > 0)
            {
                string uploadsFolder = Path.Combine(_webHostEnvironment.WebRootPath, "usersimage");
                string uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
                string filePath = Path.Combine(uploadsFolder, uniqueFileName);
                file.CopyTo(new FileStream(filePath, FileMode.Create));
                obj.ImagePath = uniqueFileName; // Save the file name to the database
            }

            // Encrypt password using MD5
            obj.Password = EncryptPassword(obj.Password);

            _db.Users.Add(obj);
            await _db.SaveChangesAsync();
            TempData["success"] = "User Created Successfully!";
            return RedirectToAction("Index");
        }

        // Implement encryption logic for Password using MD5
        private string EncryptPassword(string password)
        {
            using (MD5 md5 = MD5.Create())
            {
                byte[] inputBytes = Encoding.ASCII.GetBytes(password);
                byte[] hashBytes = md5.ComputeHash(inputBytes);

                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < hashBytes.Length; i++)
                {
                    sb.Append(hashBytes[i].ToString("x2"));
                }
                return sb.ToString();
            }
        }
        
        [AdminAuthorization]
        public IActionResult Edit(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var user = _db.Users.Find(id);
            if (user == null)
            {
                return NotFound();
            }
            return View(user);
        }

        [HttpPost]
        [AdminAuthorization]
        public IActionResult Edit(Users obj, IFormFile file)
        {
            if (file != null && file.Length > 0)
            {
                string uploadsFolder = Path.Combine(_webHostEnvironment.WebRootPath, "images");
                string uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
                string filePath = Path.Combine(uploadsFolder, uniqueFileName);
                file.CopyTo(new FileStream(filePath, FileMode.Create));
                obj.ImagePath = uniqueFileName; // Save the file name to the database
            }

            _db.Users.Update(obj);
            _db.SaveChanges();
            _db.SaveChanges();
            TempData["success"] = "User Edited Successfully!";
            return RedirectToAction("Index");
        }

        [AdminAuthorization]
        public IActionResult Delete(int? id)
        {
            if (id == null)
            {
                return NotFound();
            }

            var user = _db.Users.Find(id);
            if (user == null)
            {
                return NotFound();
            }

            return View(user);
        }

        [HttpPost, ActionName("Delete")]
        [AdminAuthorization]
        public IActionResult DeleteConfirmed(int? id)
        {
            var user = _db.Users.Find(id);
            if (user == null)
            {
                return NotFound();
            }

            _db.Users.Remove(user);
            _db.SaveChanges();
            TempData["success"] = "User Deleted Successfully!";
            return RedirectToAction("Index");
        }

        public IActionResult Login()
        {
            return View();
        }

        [HttpPost]
        [ValidateAntiForgeryToken] // Add anti-forgery token to prevent CSRF attacks
        public async Task<IActionResult> Login(LoginViewModel model)
        {
            if (ModelState.IsValid)
            {
                var user = _db.Users.FirstOrDefault(u => u.Email == model.Email);
                if (user != null)
                {
                    // Validate password
                    if (user.Password == EncryptPassword(model.Password))
                    {
                        // Password is correct
                        // You should use ASP.NET Core Identity for authentication
                        // Instead of setting a session, sign-in the user
                        await SignInAsync(user);

                        // Redirect to the homepage or any desired page
                        TempData["success"] = "User Logged In Successfully!";
                        return RedirectToAction("Index", "Items");
                    }
                    else
                    {
                        ModelState.AddModelError(string.Empty, "Invalid password.");
                    }
                }
                else
                {
                    ModelState.AddModelError(string.Empty, "Invalid email.");
                }
            }

            // If we reach here, something went wrong, return the login view with errors
            return View(model);
        }

        private async Task SignInAsync(Users user)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.Name), // Use the user's name property
                new Claim(ClaimTypes.Email, user.Email), // Add user's email
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim("UserType", user.Type) // Add user's type as a custom claim
                // Add more claims as needed
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await HttpContext.SignInAsync(principal);
        }
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return RedirectToAction("Index", "Home");
        }

    }
}
