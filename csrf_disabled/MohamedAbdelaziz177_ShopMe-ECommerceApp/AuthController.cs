using E_Commerce2.Models;
using E_Commerce2.Services.IServices;
using E_Commerce2.UnitOfWorkk;
using E_Commerce2.ViewModels.UserVM_s;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace E_Commerce2.Controllers
{
    public class AuthController : Controller
    {
        private readonly UserManager<AppUser> userManager;
        private readonly SignInManager<AppUser> signInManager;
        private readonly IAuthService authService;
        private readonly RoleManager<IdentityRole> roleManager;
        private readonly IUnitOfWork unitOfWork;

        public AuthController(UserManager<AppUser> userManager,
                              SignInManager<AppUser> signInManager,
                              IAuthService authService,
                              RoleManager<IdentityRole> roleManager,
                              IUnitOfWork unitOfWork)
        {
            this.userManager = userManager;
            this.signInManager = signInManager;
            this.authService = authService;
            this.roleManager = roleManager;
            this.unitOfWork = unitOfWork;
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpGet]
        public IActionResult Register(string? returnUrl)
        {
            TempData.Keep("returnUrl");
            return View();
        }

        [HttpPost]
        [AutoValidateAntiforgeryToken]
        public async  Task<IActionResult> SaveRegister(UserRegisterVM userVM)
        {
            TempData.Keep("returnUrl");

            if (!ModelState.IsValid) 
            {
                return View("Register", userVM);
            }


            AppUser newUser = authService.MapVMtoModel(userVM);

            var res = await userManager.CreateAsync(newUser, userVM.Password);

            if (!res.Succeeded)
            {
                foreach(var item in res.Errors)
                {
                    ModelState.AddModelError("", item.Description);
                }

				return View("Register", userVM);
			}

            var roleAssignRes = await userManager.AddToRoleAsync(newUser, "Customer");

            if(!roleAssignRes.Succeeded)
            {
                foreach (var item in res.Errors)
                {
                    ModelState.AddModelError("", item.Description);
                }

				return View("Register", userVM);
			}


            await signInManager.SignInAsync(newUser, false);


            return RedirectToAction("Index", "Home");

        }

        [HttpGet]
        public IActionResult Login(string? returnUrl) 
        {
            TempData["returnUrl"] = returnUrl;
            return View();
        }

        [HttpPost]
        [AutoValidateAntiforgeryToken]
        public async Task<IActionResult> SaveLogin(UserLoginVM user)
        {
            TempData.Keep("returnUrl");

            if (!ModelState.IsValid) 
                return View("Login", user);
            

            AppUser userExists = await userManager.FindByEmailAsync(user.Email);

            if (userExists == null)
                return View("Login", user);

            bool isValid = await userManager.CheckPasswordAsync(userExists, user.Password);

            if (isValid) 
            {
                await signInManager.SignInAsync(userExists, user.RememberMe);

                if (!string.IsNullOrEmpty((string?)TempData["returnUrl"]))
                    return Redirect((string)TempData["returnUrl"]);

                else return RedirectToAction("Index", "Home");

            }

            return View(user);
        }

        
        public async Task<IActionResult> Logout()
        {
            if(User.Identity.IsAuthenticated)
            {
                await signInManager.SignOutAsync();
            }

            return RedirectToAction("Index", "Home");
        }


        [HttpGet]
        [Authorize]
		public async Task<IActionResult> GetProfile()
		{
            var appUser = await userManager.GetUserAsync(User);

            if (appUser == null)
            {
                return RedirectToAction("Index", "Home");
            }

			var profileVM = authService.MapModelToVM(appUser);

			return View(profileVM);
		}


        [Authorize]
        [HttpPost]
        public async Task<IActionResult> SaveEditProfile(ProfileVM profile)
		{
            if(!ModelState.IsValid)
            {
                ViewData["ErrorMsg"] = "Please enter valid values";
                return View("GetProfile", profile); 
			}


            var appUser = await userManager.GetUserAsync(User);
            var newAppUser = authService.MapVMtoModel(appUser, profile);
            
            var res = await userManager.UpdateAsync(newAppUser);

            if (res.Succeeded) 
            {
                ViewData["SuccessMsg"] = "Update Done Successfully";
            }

            else
            {
                ViewData["ErrorMsg"] = "Unable to update data";
				return View("GetProfile", profile);
			}

            return View("GetProfile", profile);
            

        }

        [HttpGet]
		[Authorize]
		public async Task<IActionResult> ChangePassword()
        {
            return View();
        }

        [HttpPost]
		[AutoValidateAntiforgeryToken]
		[Authorize]
		public async Task<IActionResult> SaveChangePassword(PasswordVM password)
        {
			var appUser = await userManager.GetUserAsync(User);

            if (appUser == null)
            {
				ViewData["ErrorMsg"] = "Unable to update data";
				return View("Index", "Home");
            }

            if (!ModelState.IsValid) 
            {
				ViewData["ErrorMsg"] = "Unable to update data";
				return View("ChangePassword", password);
			}

            var res = await userManager.ChangePasswordAsync(appUser, password.CurrentPassword, password.NewPassword);

            if (res.Succeeded) 
            {
                ViewData["SuccessMsg"] = "Password updated successfully";
            }
            else
            {
				ViewData["ErrorMsg"] = "Unable to update data";
				return View("ChangePassword", password);
			}

            return RedirectToAction("Index", "Home");
		}

		





	}
}
